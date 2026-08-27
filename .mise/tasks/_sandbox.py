#!/usr/bin/env python3
"""Shared cplt sandbox invocation for every task that launches a model client.

Models escape when nothing stops them. One walked out of its workspace with an
absolute path and listed every other model's finished solution. Another invented
a CLI, then tried to `npm install -g` and `brew tap` it into existence. Both went
through a harness that trusted them to stay put.

Every client launch goes through here so the sandbox cannot be forgotten in one
place and remembered in another.
"""
import shutil
from pathlib import Path


def cplt_argv(workspace_dir: Path, repo_root: Path, server_port: str = "8080",
              extra: list[str] | None = None) -> list[str] | None:
    """Return the cplt argv prefix, or None when cplt is not installed.

    Callers append their own client arguments after the returned list.
    """
    if not shutil.which("cplt"):
        return None
    home = Path.home()
    argv = [
        "cplt",
        "--agent", "opencode",
        "--project-dir", str(workspace_dir),
        # Localhost is blocked by default to prevent SSRF, so the inference
        # server's port has to be allowed back in explicitly.
        "--allow-localhost", server_port,
        # opencode keeps its session database, logs and snapshots outside the
        # project. Without write access it dies at startup with
        # "Unexpected server error".
        "--allow-write", str(home / ".local/share/opencode"),
        "--allow-write", str(home / ".cache/opencode"),
        "--allow-read", str(home / ".config/opencode"),
        # opencode walks up the tree looking for config and reads the repo-root
        # opencode.json, one level above the sandbox boundary. A denial there is
        # fatal, not "no config here". Grant that one file rather than the repo
        # root, so sibling workspaces stay unreadable.
        "--allow-read", str(repo_root / "opencode.json"),
    ]
    argv += extra or []
    return argv


def warn_unsandboxed(stream) -> None:
    print("⚠  cplt not found — launching unsandboxed.", file=stream)
    print("   The model can read sibling workspaces and modify this machine.", file=stream)
    print("   Install it with: brew install cplt", file=stream)
