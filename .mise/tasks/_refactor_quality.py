#!/usr/bin/env python3
"""Quality and repair measurement for the refactor experiment.

The ladder could ask "does the suite still pass". A refactor cannot: it touches
forty files, the suite on our target is red before anyone starts, and a rename that
silently changes behaviour in an untested branch passes every check we have. So the
question here is not "is it green" but "where does this differ from what the
expensive model did".

The reference is strategy C, the cloud working alone. Files where another strategy
lands on the same content are correct by construction — two independent runs agreeing
character for character is not luck. Files where they differ are the entire finding
and get read by a human. That converts "is it good" into a short list, which is the
only form of the question that scales to forty files.

What this does NOT establish, and must not be reported as if it did: the reference can
be wrong. If the cloud model misunderstood the refactor, every strategy that agrees
with it is wrong in the same way and this measure will call them all correct. It
measures agreement, not correctness. The suite result and a human reading the
disagreements are what stand behind the word "quality"; this only decides what is
worth reading.

Run `_refactor_quality.py --self-check` for the assertions that pin the behaviour.
"""
import json
import re
import subprocess
import sys
from pathlib import Path


def tracked_files(repo):
    """Every file in the working tree, tracked or not, ignoring build output.

    Untracked files count: writing a new test file is one of the tasks, and a
    strategy that creates it is not "no change".
    """
    out = subprocess.run(["git", "status", "--porcelain", "--untracked-files=all"],
                         cwd=str(repo), capture_output=True, text=True).stdout
    files = set()
    for line in out.splitlines():
        if not line.strip():
            continue
        path = line[3:].strip()
        # A rename is "old -> new"; the new name is what exists now.
        if " -> " in path:
            path = path.split(" -> ", 1)[1]
        if path.startswith(("build/", ".gradle/")):
            continue
        files.add(path)
    return files


# Trailing whitespace and blank-line runs differ between two correct edits often
# enough to bury the real disagreements. Nothing cleverer than this: normalising
# imports or reformatting would start deciding which differences are allowed to
# matter, and that judgement belongs to the person reading the short list.
def normalise(text):
    lines = [line.rstrip() for line in text.replace("\r\n", "\n").split("\n")]
    out, blank = [], False
    for line in lines:
        if line == "":
            if blank:
                continue
            blank = True
        else:
            blank = False
        out.append(line)
    return "\n".join(out).strip("\n")


def snapshot(repo, files):
    """Normalised content of each named file, or None where it does not exist."""
    snap = {}
    for rel in files:
        p = Path(repo) / rel
        try:
            snap[rel] = normalise(p.read_text(errors="replace"))
        except (OSError, IsADirectoryError):
            snap[rel] = None
    return snap


def compare(reference, candidate):
    """Agreement between two strategies' end states.

    Both arguments are {path: normalised content or None}. Returns the four
    populations a reader needs, and never collapses them into one score: "12 of 14
    agree" hides whether the other two are missing files or different content, and
    those mean opposite things.
    """
    paths = set(reference) | set(candidate)
    agree, differ, only_ref, only_cand = [], [], [], []
    for p in sorted(paths):
        r, c = reference.get(p), candidate.get(p)
        if r is None and c is None:
            continue
        if r is None:
            only_cand.append(p)
        elif c is None:
            only_ref.append(p)
        elif r == c:
            agree.append(p)
        else:
            differ.append(p)
    total = len(agree) + len(differ) + len(only_ref) + len(only_cand)
    return {
        "agree": agree,
        "differ": differ,
        "missing": only_ref,      # the reference changed it, the candidate did not
        "extra": only_cand,       # the candidate changed a file the reference left alone
        # None, not 1.0, when neither strategy changed anything. Two runs that did
        # nothing agree perfectly, and a rate of 1.0 there reads as the best
        # possible result rather than the absence of one.
        "agreement_rate": round(len(agree) / total, 3) if total else None,
    }


# ── repairs ───────────────────────────────────────────────────────────────────

# Files named inside an opencode tool call. Read off the tool input rather than the
# diff, because the question is who touched the file and in which order, which the
# final diff cannot answer.
EDIT_TOOLS = {"edit", "write", "patch", "multiedit"}


def _paths_in(value, repo_name):
    """Every plausible repo path in a tool input, however the tool nests it."""
    found = set()

    def walk(v):
        if isinstance(v, str):
            for m in re.finditer(r"[\w./-]+\.(?:kt|kts|java|ts|tsx|js|jsx|py|go|json|yaml|yml)", v):
                p = m.group(0)
                if repo_name and repo_name + "/" in p:
                    p = p.split(repo_name + "/", 1)[1]
                found.add(p.lstrip("./"))
        elif isinstance(v, dict):
            for x in v.values():
                walk(x)
        elif isinstance(v, list):
            for x in v:
                walk(x)

    walk(value)
    return found


def repairs(log_text, repo_name=""):
    """Files the cloud edited itself after dispatching work that named them.

    A repair costs a cloud round trip plus a wasted local one, so a strategy with a
    high repair rate can be more expensive than never dispatching. The spec asserts
    that; this counts it.

    Attribution is by file name and order, not by proof: the dispatch prompt names
    files in prose, and a cloud edit to one of them afterwards is counted as a
    repair. A cloud edit that was always going to happen is counted too, which
    makes this an upper bound. Reported as one, never as "the worker got N wrong".
    """
    dispatched, repaired, order = set(), set(), []
    for line in log_text.splitlines():
        line = line.strip()
        if not line.startswith("{"):
            continue
        try:
            ev = json.loads(line)
        except ValueError:
            continue
        part = ev.get("part") or {}
        if part.get("type") != "tool":
            continue
        tool = part.get("tool")
        inp = (part.get("state") or {}).get("input") or {}
        if tool == "task":
            named = _paths_in(inp, repo_name)
            dispatched |= named
            order.append(("dispatch", named))
        elif tool in EDIT_TOOLS:
            touched = _paths_in(inp, repo_name)
            repaired |= touched & dispatched
            order.append(("edit", touched))
    return {
        "dispatched_files": sorted(dispatched),
        "repaired_files": sorted(repaired),
        "repair_rate_upper_bound": round(len(repaired) / max(1, len(dispatched)), 3),
    }


def self_check():
    assert normalise("a  \n\n\n b\n") == "a\n\n b"
    assert normalise("x\r\ny") == "x\ny"

    ref = {"A.kt": "same", "B.kt": "ref", "C.kt": "only ref", "D.kt": None}
    cand = {"A.kt": "same", "B.kt": "cand", "C.kt": None, "D.kt": "only cand"}
    got = compare(ref, cand)
    assert got["agree"] == ["A.kt"], got
    assert got["differ"] == ["B.kt"], got
    assert got["missing"] == ["C.kt"], got
    assert got["extra"] == ["D.kt"], got
    assert got["agreement_rate"] == 0.25, got

    # A file neither strategy touched is not evidence of anything, and two
    # strategies that changed nothing must not score as perfect agreement.
    assert compare({"X": None}, {"X": None})["agreement_rate"] is None

    ev = [
        {"part": {"type": "tool", "tool": "task", "state": {"input": {
            "prompt": "Add kilde to src/main/kotlin/no/nav/syfo/P.kt and its mapper M.kt"}}}},
        {"part": {"type": "tool", "tool": "edit", "state": {"input": {
            "filePath": "/repo/src/main/kotlin/no/nav/syfo/P.kt"}}}},
        {"part": {"type": "tool", "tool": "edit", "state": {"input": {
            "filePath": "src/main/kotlin/no/nav/syfo/Other.kt"}}}},
    ]
    r = repairs("\n".join(json.dumps(e) for e in ev), repo_name="repo")
    assert "src/main/kotlin/no/nav/syfo/P.kt" in r["dispatched_files"], r
    assert r["repaired_files"] == ["src/main/kotlin/no/nav/syfo/P.kt"], r
    # Other.kt was never dispatched, so editing it is work, not a repair.
    assert "Other.kt" not in "".join(r["repaired_files"])

    # No dispatches means no repairs, and no division by zero.
    assert repairs("")["repair_rate_upper_bound"] == 0.0
    print("✓ self-check passed")


if __name__ == "__main__":
    if "--self-check" in sys.argv:
        self_check()
    else:
        print(__doc__)
