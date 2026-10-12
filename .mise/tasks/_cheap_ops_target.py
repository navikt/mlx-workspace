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
NPMRC_AUTH = "//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}"
# Every `# target-hook` line in bench-cheap-ops, exactly. All but the import and the
# hash strip are gated on a target, so with BENCH_TARGET unset none of this module's
# code runs except strip_hooks, which is what keeps the Kotlin hash on main's bytes.
# A new hook line fails the self-check until it is added here on purpose.
ALLOWED_HOOKS = [
    'import _cheap_ops_target as T',
    'if T.TARGET: CFG = T.load(ROOT, CFG)',
    'if rel == ".mise/tasks/bench-cheap-ops": h.update(T.strip_hooks(f.read_bytes())); continue',
    'if T.TARGET and rel == "bench/tasks.json": return T.harness_sha(ROOT, CFG)',
    'if T.TARGET: repo = ws / CFG["workdir"]',
    # borrowed by bench-frontier and the night preflight, which exec it without CFG
    'if globals().get("CFG", {}).get("workdir"): allowed.add(CFG["workdir"])',
    'if T.TARGET and kind == "check": return T.check(task, globals())',
    'if T.TARGET: T.install(repo, CFG, sh)',
]


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
    """Once per checkout: node_modules survives reset (git clean keeps ignored files).

    The token never touches disk: .npmrc gets a ${NODE_AUTH_TOKEN} reference and the
    token goes only into pnpm's environment. .npmrc is restored in `finally`, so a
    timed-out install leaves nothing behind either.
    """
    if not cfg.get("install") or (repo / "node_modules").is_dir():
        return
    print(f"\u2192 installing dependencies in {repo.name}")
    npmrc = repo / ".npmrc"
    orig = npmrc.read_bytes() if npmrc.exists() else None
    try:
        npmrc.write_bytes((orig or b"").rstrip(b"\n") + b"\n" + NPMRC_AUTH.encode() + b"\n")
        token = sh(["gh", "auth", "token"]).stdout.strip()
        r = sh(["bash", "-lc", cfg["install"]], cwd=repo, timeout=1800, env={"NODE_AUTH_TOKEN": token})
    finally:
        npmrc.write_bytes(orig) if orig is not None else npmrc.unlink(missing_ok=True)
    if r.returncode != 0:
        raise SystemExit(f"\u2717 install failed: {(r.stdout + r.stderr)[-400:]}")


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
    here = Path(__file__).resolve().parent
    # Borrowed the way bench-frontier and night-preflight do: exec'd alone, no CFG in scope.
    import sys; sys.path.insert(0, str(here)); import _night_workspace_clean as W
    with tempfile.TemporaryDirectory() as d:
        ns = W._borrow(); ns["ws"] = Path(d); (Path(d) / "kotlin").mkdir()
        ns["assert_workspace_is_clean"]()  # NameError on CFG before the globals() guard
        (Path(d) / "stray").touch()
        try: ns["assert_workspace_is_clean"](); raise AssertionError("stray file not caught")
        except SystemExit: pass
    hooks = [l.decode().strip() for l in (here / "bench-cheap-ops").read_bytes().splitlines(keepends=True)
             if l.endswith(HOOK)]
    hooks = [h[: -len("# target-hook")].strip() for h in hooks]
    assert hooks == ALLOWED_HOOKS, f"target-hook lines differ from ALLOWED_HOOKS: {hooks}"
    kotlin = json.loads((here.parents[1] / "bench" / "tasks.json").read_text())
    assert "workdir" not in kotlin and "install" not in kotlin, "the ungated workdir hook must stay inert for Kotlin"
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
