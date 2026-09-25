#!/usr/bin/env python3
"""Build commit-explains-why{,-no}.jsonl from hand-picked commits. Labels come from reading, see README.md.

  COPILOT_REPO=<clone of navikt/copilot> python3 bench/decide-cases/build_why.py
"""
import json, os, re, subprocess, sys
from pathlib import Path

OUT = Path(__file__).resolve().parent
REPOS = {"navikt/copilot": Path(os.environ.get("COPILOT_REPO", "../copilot")),
         "navikt/mlx-workspace": OUT.parents[1]}
MAX = 8000

Q_EN = "Does the commit message explain why the change was made, beyond describing what the diff already shows?"
Q_NO = "Forklarer commit-meldingen hvorfor endringen ble gjort, utover å beskrive det diffen allerede viser?"

C, M = "navikt/copilot", "navikt/mlx-workspace"
# real-why: the body states a reason not visible in the diff (bug, measurement, constraint, user need)
WHY = [(C, "82fd300057"), (C, "1bb4555676"), (C, "85d91cdbea"), (C, "16a967d9dc"), (C, "2460e89835"),
       (C, "5e3d3eb437"), (C, "5645c3e64f"), (C, "06f6c00d33"), (C, "d0c0363a9c"), (C, "5dcfba0094"),
       (C, "ec18952591"), (C, "0bbf58217b"), (C, "385e6f8a71"), (C, "ddb92f3499"), (C, "e010946182"),
       (C, "ba5bb16f78"), (C, "6f0374be0a"), (C, "3108eb84cc"), (M, "b5fbec9ca8"), (M, "f0c8c7739a"),
       (M, "cae99c1155"), (M, "4bbe71689e"), (M, "2a16a87f3e"), (M, "a387e4b6ce")]
# real-what: subject only, or a body that lists what the diff shows
WHAT = [(C, "068ede3967"), (C, "a7fddfee02"), (C, "a0646cb384"), (C, "8c953a9295"), (C, "d16f5b6dd1"),
        (C, "ced9a1b779"), (C, "684b88bec4"), (C, "b8eba998ff"), (C, "0aa94be68f"), (C, "5f4c4cd94c"),
        (C, "d9ef6889db"), (M, "17c6009766")]
# controlled: a real-why commit, same diff, the rationale taken out of subject and body and the body padded
# with more of what the diff shows, so length and style stay close.
CONTROLLED = {
    "16a967d9dc": """fix(copilot-api): dereference pointer in daily-metrics cache key

GetDailyMetrics built its cache key with fmt.Sprintf and %v on the
days argument. It now copies *days into a local effectiveDays, which
is 0 when days is nil, and formats the key with %d, so the key reads
'daily_metrics_<n>'.""",
    "06f6c00d33": """fix(my-copilot): set turbopack.root to "."

Change turbopack.root in apps/my-copilot/next.config.ts from "../.."
to ".". Turbopack now takes the project directory as its root instead
of the directory two levels up. The other options in next.config.ts,
cacheComponents and optimizePackageImports, are unchanged.""",
    "d0c0363a9c": """fix(agents): replace Haiku with standard-tier models

Change the model line in the frontmatter of five agent files, from
Claude Haiku 4.5 to the models below. Nothing else in the files changes:

- accessibility, aksel, auth, observability → Claude Sonnet 4.6
- research → GPT-5.3-Codex""",
    "ec18952591": """fix(my-copilot): check faro.config in the Faro init guard

The early return at the top of the useEffect in faro.tsx checked
faro.api. It now checks faro.config instead, and returns before
initializeFaro when that is set. The rest of the component and the
initializeFaro options are unchanged.""",
    "385e6f8a71": """fix(my-copilot): legg til /videos/** i autoLoginIgnorePaths

Legger til /videos/** i autoLoginIgnorePaths i .nais/app.yaml for
my-copilot, etter /demos/** og foran /*.svg. De andre stiene i
listen er uendret.""",
    "e010946182": """fix: split && chains in hack scripts into separate lines

In build.sh, check.sh, generate.sh, test.sh and update.sh under hack/,
each `echo "..." && mise run ... && echo ""` line is now three lines:
the echo, the command, and the empty echo.

The for loops and the final success lines are unchanged.""",
    "5645c3e64f": """fix(my-copilot): clarify budget card when consumed_amount is unavailable

Add a small grey BodyShort under the budget amount in subscription.tsx.
For an override budget it says that consumption data is not available;
for the default budget it says that GitHub does not report individual
consumption. The rest of the card is unchanged.""",
    "5dcfba0094": """fix(agents): use single model string instead of array

Replace the model list in the agent frontmatter with a single string,
keeping one model from each list, so each file has one `model:`
line instead of three.

Affected agents: nav-pilot, auth, code-review, observability,
research, security-champion.""",
    "6f0374be0a": """fix(my-copilot): add GitHub to outbound access policy

Adds api.github.com and avatars.githubusercontent.com to the external
hosts under accessPolicy.outbound in .nais/app.yaml, next to the
hosts already listed there.""",
    "ddb92f3499": """fix(ci): bruk go run for staticcheck i stedet for cached binary

Fjerner staticcheck fra [tools] i fem .mise.toml-filer og kjører
go run honnef.co/go/tools/cmd/staticcheck@v0.7.0 i stedet.""",
    "cae99c1155": """chore(profiles): cap nopin at 32k context like the fixed 8bit-mlx entry

MLX_OPENCODE_CONTEXT goes from 65536 to 32768 and MLX_OPENCODE_OUTPUT
from 16384 to 8192 in profiles/qwen3.8-27b-8bit-nopin.toml. The cache
settings and MLX_MAX_TOKENS are unchanged.""",
    "4bbe71689e": """bench: header timeout is optional with a default, not required per profile

MLX_OPENCODE_HEADER_TIMEOUT is removed from REQUIRED_PARAMS in
_profiles.py, so the profile check no longer lists it.""",
}
BASE_REPO = {s: r for r, s in WHY}


def git(repo, *a):
    return subprocess.run(["git", "-C", str(REPOS[repo]), *a], capture_output=True, text=True, check=True).stdout


def message(repo, sha):
    lines = git(repo, "log", "-1", "--format=%B", sha).rstrip().splitlines()
    lines = [l.rstrip() for l in lines if not re.match(r"(?i)^(co-authored-by|signed-off-by):", l)]
    return "\n".join(lines).strip()


def evidence(msg, diff):
    head = f"Commit message:\n-----\n{msg}\n-----\n\nDiff:\n-----\n"
    room = MAX - len(head) - 60
    if len(diff) > room:
        cut = diff[:room].rsplit("\n", 1)[0]
        diff = f"{cut}\n[diff truncated: {len(diff) - len(cut)} more characters]"
    return f"{head}{diff.rstrip()}\n-----"


rows = []
for kind, items in (("real-why", WHY), ("real-what", WHAT), ("controlled", [(BASE_REPO[s], s) for s in CONTROLLED])):
    for repo, sha in items:
        full = git(repo, "rev-parse", sha).strip()
        orig = message(repo, sha)
        msg = CONTROLLED[sha] if kind == "controlled" else orig
        diff = git(repo, "show", "--format=", "--no-color", full)
        ev = evidence(msg, diff)
        lang = "no" if sha in ("385e6f8a71", "ddb92f3499", "0aa94be68f", "5f4c4cd94c") else "en"
        meta = {"repo": repo, "sha": full, "construction": kind, "message_lang": lang,
                "diff_chars": len(diff), "truncated": "[diff truncated:" in ev, "message_chars": len(msg)}
        if kind == "controlled":
            meta["original_message"] = orig
            meta["subject_changed"] = msg.splitlines()[0] != orig.splitlines()[0]
        expect = "yes" if kind == "real-why" else "no"
        cid = f"{kind}-{sha[:10]}"
        rows.append({"id": f"why-en-{cid}", "set": "why-en", "question": Q_EN, "options": ["yes", "no"],
                     "evidence": ev, "expect": expect, "meta": {**meta, "lang": "en"}})
        rows.append({"id": f"why-no-{cid}", "set": "why-no", "question": Q_NO, "options": ["ja", "nei"],
                     "evidence": ev, "expect": {"yes": "ja", "no": "nei"}[expect],
                     "meta": {**meta, "lang": "no", "twin": f"why-en-{cid}"}})

for lang, suffix in (("en", ""), ("no", "-no")):
    p = OUT / f"commit-explains-why{suffix}.jsonl"
    p.write_text("".join(json.dumps(r, ensure_ascii=False) + "\n" for r in rows if r["meta"]["lang"] == lang))
    print(p, sum(r["meta"]["lang"] == lang for r in rows))
