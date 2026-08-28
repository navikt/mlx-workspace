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


# opencode reads the personal config at ~/.config/opencode, which carries a
# nav-pilot exported AGENTS.md and 38 global skills. All of it lands in the
# system prompt: 32,754 characters measured on the wire, none of it chosen by
# the benchmark. Point XDG_CONFIG_HOME at this directory instead so a run sees
# the workspace AGENTS.md and nothing else. See issue #12.
BENCH_CONFIG_HOME = Path(__file__).resolve().parents[2] / "bench" / "opencode-home"


def bench_env(env: dict) -> dict:
    """Return env with opencode's config home pointed at the benchmark copy."""
    return {**env, "XDG_CONFIG_HOME": str(BENCH_CONFIG_HOME)}


# mlx_lm's server decides whether generation starts in reasoning state by scanning
# the rendered prompt for the last think-start against the last think-end
# (server.py:568-574). An unclosed think tag anywhere in the prompt, including in
# AGENTS.md, sends every model's output to the reasoning field, where opencode
# discards it. That cost us two models and most of a day. See issue #10.
THINK_OPEN = "<" + "think>"
THINK_CLOSE = "</" + "think>"


def check_prompt(agents_md) -> None:
    """Refuse to launch when AGENTS.md would poison the reasoning state."""
    text = agents_md.read_text()
    if text.rfind(THINK_OPEN) > text.rfind(THINK_CLOSE):
        raise SystemExit(
            f"\u2717 {agents_md} ends with an unclosed think tag.\n"
            f"  Every model's output would go to the reasoning field and be discarded.\n"
            f"  Describe reasoning blocks in words instead of writing the tags. Issue #10."
        )


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
        # opencode writes into its config home at startup (a .gitignore, and
        # auth state), so read access alone makes it exit with
        # "Unexpected error: FileSystem.writeFile".
        "--allow-write", str(BENCH_CONFIG_HOME),
    ]
    argv += extra or []
    return argv


def warn_unsandboxed(stream) -> None:
    print("⚠  cplt not found — launching unsandboxed.", file=stream)
    print("   The model can read sibling workspaces and modify this machine.", file=stream)
    print("   Install it with: brew install cplt", file=stream)
