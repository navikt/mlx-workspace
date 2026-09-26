#!/usr/bin/env python3
"""Preflight check: would bench-frontier's per-step assert_workspace_is_clean
refuse to start on workspaces/<key>/? On 25 Sep a model left empty .git and
.git2 directories in workspaces/qwen3.6-35b-a3b-optiq/; bench-frontier's
mid-run check caught it and failed every step, but night-run-3's own
preflight passed, so the night ran to completion in 2 seconds. This lets
night-preflight and night-run-3 catch the same thing before step 1.

Reuses assert_workspace_is_clean unchanged, via the same AST-extraction
bench-frontier's own harness() uses to borrow it from bench-cheap-ops, so a
future change to the allowed-files rule is picked up here without editing
this file. Read-only: reports the stray paths and the command to clear them,
never deletes anything.
"""
import ast
import os
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent
# Same override bench-frontier's own ROOT uses, so a selftest can point this at a
# fixture tree instead of the real workspaces/ directory.
ROOT = Path(os.environ.get("FRONTIER_ROOT") or HERE.parents[1])


def _borrow():
    """ns with assert_workspace_is_clean exec'd from bench-cheap-ops, the same
    function bench-frontier's harness() runs mid-benchmark."""
    src = HERE / "bench-cheap-ops"
    tree = ast.parse(src.read_text())
    fn = next((n for n in tree.body if isinstance(n, ast.FunctionDef)
               and n.name == "assert_workspace_is_clean"), None)
    if fn is None:
        raise SystemExit(f"{src} no longer defines assert_workspace_is_clean; "
                          f"update _night_workspace_clean.py.")
    ns = {}
    exec(compile(ast.Module([fn], []), str(src), "exec"), ns)  # noqa: S102 (our own file)
    return ns


def check(key):
    """(ok, message) for workspaces/<key>. On failure, message names the
    stray paths and an `rm -rf` to clear them (not run automatically)."""
    ns = _borrow()
    ws = ROOT / "workspaces" / key
    ns["ws"] = ws
    try:
        ns["assert_workspace_is_clean"]()
    except SystemExit as e:
        msg = str(e).splitlines()[0]
        stray = re.search(r"holds (.+?), which the agent can read", msg)
        names = [n.strip() for n in stray.group(1).split(",")] if stray else []
        paths = [str(ws / n) for n in names] or [str(ws)]
        return False, f"{msg}  ->  rm -rf {' '.join(paths)}"
    return True, f"{ws} clean"


if __name__ == "__main__":
    import sys
    fails = 0
    for key in sys.argv[1:]:
        ok, msg = check(key)
        print(f"{'PASS' if ok else 'FAIL'}  {key}: {msg}")
        fails += 0 if ok else 1
    sys.exit(1 if fails else 0)
