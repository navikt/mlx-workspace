"""bench-cheap-ops for a target other than bench/tasks.json (BENCH_TARGET).

Kept out of bench-cheap-ops so the Kotlin generation is untouched: the lines in
bench-cheap-ops ending in `# target-hook` only call into this file, and the
Kotlin harness_sha hashes bench-cheap-ops with those lines removed. A target run
hashes all of it, this module and the target's hidden check files instead.
"""
import hashlib
import json
import os
import shutil
from pathlib import Path

TARGET = os.environ.get("BENCH_TARGET", "").strip()
HOOK = b"  # target-hook\n"


def load(root, cfg):
    return json.loads((root / "bench" / "targets" / f"{TARGET}.json").read_text()) if TARGET else cfg


def strip_hooks(src):
    return b"".join(l for l in src.splitlines(keepends=True) if not l.endswith(HOOK))


def harness_sha(root, cfg):
    hidden = sorted(f"{cfg['fixtures']}/{s}" for t in cfg["tasks"] for s in t.get("check_files", {}))
    h = hashlib.sha256()
    for rel in (".mise/tasks/bench-cheap-ops", ".mise/tasks/_cheap_ops_target.py", ".mise/tasks/_sandbox.py",
                f"bench/targets/{TARGET}.json", "bench/agents-prompt.md", *hidden):
        h.update(rel.encode())
        h.update((root / rel).read_bytes())
    return h.hexdigest()[:12]


def install(repo, cfg, sh):
    """Once per checkout: node_modules survives reset (git clean keeps ignored files)."""
    if cfg.get("install") and not (repo / "node_modules").is_dir():
        print(f"→ installing dependencies in {repo.name}")
        r = sh(["bash", "-lc", cfg["install"]], cwd=repo, timeout=1800)
        if r.returncode != 0:
            raise SystemExit(f"✗ install failed: {(r.stdout + r.stderr)[-400:]}")


def check(task, g):
    """F1/F2 (bench/targets/frontend-melosys-web.json).

    The change must land in `touches` and stay inside `only`. `check_files` are
    hidden tests copied in after the agent is done (F1). `check_cmd` must pass,
    then each of `breaks` is planted in turn and `check_cmd` must fail under it:
    a test that passes on broken code tests nothing (F2, the T1 rule). The tasks
    were validated by reports/2026-10-10-gap-fill/ts/validate-ts.
    """
    repo, cfg = g["repo"], g["CFG"]
    paths = [l[2:].strip() for l in g["changed_files"]()]
    if not paths:
        return False, "no changes made (model did not edit anything)"
    if not any(task["touches"] in p for p in paths):
        return False, f"nothing changed in {task['touches']} (touched: {', '.join(paths)})"
    stray = [p for p in paths if not p.startswith(task["only"])]
    if stray:
        return False, f"changed outside {task['only']}: {', '.join(stray)}"
    for src, dest in task.get("check_files", {}).items():
        shutil.copy(Path(g["ROOT"]) / cfg["fixtures"] / src, repo / dest)
    run = lambda: g["sh"](["bash", "-lc", task["check_cmd"]], cwd=repo, timeout=1800).returncode == 0
    if not run():
        return False, "check failed"
    breaks = task.get("breaks", [])
    for i, b in enumerate(breaks, 1):
        f = repo / b["file"]
        text = f.read_text()
        if text.count(b["find"]) != 1:
            raise SystemExit(f"✗ {task['id']}: break {i} site not found exactly once in {b['file']}")
        f.write_text(text.replace(b["find"], b["replace"], 1))
        caught = not run()
        f.write_text(text)
        if not caught:
            return False, f"test passes with break {i} planted"
    return True, "check passes" + (f", catches {len(breaks)} breaks" if breaks else "")


if __name__ == "__main__":  # self-check: no model, no server
    import subprocess, tempfile
    sh = lambda c, cwd=None, timeout=60: subprocess.run(c, cwd=cwd, capture_output=True, text=True)
    assert strip_hooks(b"a\nx = 1" + HOOK + b"b\n") == b"a\nb\n"
    with tempfile.TemporaryDirectory() as d, tempfile.TemporaryDirectory() as fx:
        repo = Path(d); (repo / "src").mkdir(); f = repo / "src" / "a.ts"; f.write_text("good\n")
        for c in (["init", "-q"], ["add", "."], ["-c", "user.name=b", "-c", "user.email=b@b",
                  "-c", "commit.gpgsign=false", "commit", "-qm", "base"]):
            sh(["git", *c], cwd=repo)
        Path(fx, "hidden").write_text("good\n")
        changed = lambda: [l for l in sh(["git", "status", "--porcelain"], cwd=repo).stdout.strip().splitlines()]
        g = {"repo": repo, "CFG": {"fixtures": fx}, "ROOT": "/", "sh": sh, "changed_files": changed}
        t = {"id": "F2", "touches": "src/a.test.ts", "only": "src/", "check_files": {"hidden": "src/h.txt"},
             "check_cmd": "cmp -s src/h.txt src/a.ts", "breaks": [{"file": "src/a.ts", "find": "good", "replace": "bad"}]}
        assert check(t, g)[0] is False, "no changes must fail"
        (repo / "src" / "a.test.ts").write_text("y\n")
        assert check(t, g) == (True, "check passes, catches 1 breaks"), check(t, g)
        assert f.read_text() == "good\n", "a break must be undone after its run"
        t["check_cmd"] = "test -f src/h.txt"
        assert check(t, g)[0] is False, "a check that passes with the break planted must fail"
    print("✓ _cheap_ops_target self-check passed")
