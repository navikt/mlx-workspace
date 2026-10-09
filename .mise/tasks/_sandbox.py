#!/usr/bin/env python3
"""Shared cplt sandbox invocation for every task that launches a model client.

Models escape when nothing stops them. One walked out of its workspace with an
absolute path and listed every other model's finished solution. Another invented
a CLI, then tried to `npm install -g` and `brew tap` it into existence. Both went
through a harness that trusted them to stay put.

Every client launch goes through here so the sandbox cannot be forgotten in one
place and remembered in another.
"""
import json
import os
import re
import shutil
import subprocess
import sys
import tomllib
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
    argv += toolchain_grants(repo_root)
    argv += extra or []
    return argv


def toolchain_grants(repo_root: Path) -> list[str]:
    """Let the sandboxed model actually build and test.

    Without these, `./gradlew` reaches a mise shim, the shim reads config
    outside the boundary, and the model gets "Operation not permitted (os error
    1)". We measured 2,672 of those across the recorded transcripts against
    2,176 mentions of gradlew: essentially every attempt to compile or run a
    test was refused by us, not by the code.

    So `verify=compile` and `verify=test` were not measuring what they claim.
    They were measuring whether a model can write correct Kotlin with no
    compiler and no test run — blind. A developer has both, which makes the
    numbers a poor guide to the thing they were collected to decide.

    These grants are deliberately toolchain-only. The isolation that has
    actually caught something stays: sibling workspaces stay unreadable, and
    the machine outside these paths stays unwritable. A model that reads a
    sibling's finished solution is the failure this sandbox exists for, and
    nothing here opens that.
    """
    home = Path.home()
    grants: list[str] = []
    for path in (home / ".local/share/mise", home / ".config/mise"):
        if path.exists():
            grants += ["--allow-read", str(path)]
    # Gradle and Maven write caches and daemon state; read access alone fails.
    for path in (home / ".gradle", home / ".m2"):
        if path.exists():
            grants += ["--allow-write", str(path)]
    # mise resolves the toolchain from config at the repo root, one level above
    # the sandbox boundary. Granted per file rather than by directory so a
    # sibling workspace does not come with it.
    for name in ("mise.toml", "mise.local.toml", ".mise.toml"):
        cfg = repo_root / name
        if cfg.exists():
            grants += ["--allow-read", str(cfg)]
    return grants

def warn_unsandboxed(stream) -> None:
    print("⚠  cplt not found — launching unsandboxed.", file=stream)
    print("   The model can read sibling workspaces and modify this machine.", file=stream)
    print("   Install it with: brew install cplt", file=stream)


def bench_cplt_config(dest: Path, src: Path | None = None) -> Path:
    """Write a benchmark-only cplt config to dest: the user's config plus
    sandbox.allow_localhost_any, for CPLT_CONFIG. Never touches the user's file.

    Gradle's client talks to its daemon (and the Kotlin daemon) over TCP on a random
    localhost port, and cplt has no narrower grant than any-port. Since 29 Sep 15:11
    the global config lacks the key, so `./gradlew` inside the bench sandbox failed
    with "Could not connect to the Gradle daemon" and invalidated create-file runs.
    """
    src = src or Path.home() / ".config/cplt/config.toml"
    text = src.read_text() if src.exists() else ""
    if not tomllib.loads(text).get("sandbox", {}).get("allow_localhost_any"):
        text, n = re.subn(r"(?m)^(allow_localhost_any\s*=\s*)false\b", r"\1true", text)
        if not n:
            text, n = re.subn(r"(?m)^\[sandbox\][^\n]*\n", lambda m: m.group(0) + "allow_localhost_any = true\n", text, count=1)
        if not n:
            text += "\n[sandbox]\nallow_localhost_any = true\n"
    if tomllib.loads(text).get("sandbox", {}).get("allow_localhost_any") is not True:
        raise SystemExit(f"\u2717 could not add allow_localhost_any to a copy of {src}")
    dest.write_text(text)
    return dest


def gradle_preflight(probe: Path, repo_root: Path) -> bool:
    """Run `./gradlew -q help` in a scratch Gradle project inside `cplt exec`, under
    whatever CPLT_CONFIG the caller exported, with the same toolchain grants as a run.
    `--version` never contacts a daemon; `help` does. False when the client cannot
    reach its daemon, so a night step fails fast instead of measuring a blocked build.
    """
    wrappers = sorted(repo_root.glob("workspaces/*/gradle/wrapper/gradle-wrapper.properties"))
    if not wrappers:
        print("\u2717 no workspaces/*/gradlew to copy for the gradle preflight")
        return False
    src = wrappers[0].parents[2]
    shutil.copytree(src / "gradle/wrapper", probe / "gradle/wrapper", dirs_exist_ok=True)
    shutil.copy2(src / "gradlew", probe / "gradlew")
    (probe / "settings.gradle.kts").write_text('rootProject.name = "probe"\n')
    # A short idle timeout, so the probe's daemon does not linger into the step.
    (probe / "gradle.properties").write_text("org.gradle.daemon.idletimeout=60000\n")
    # The bench's JDK, not the caller's: on 9 Oct 2026 this probe passed on mise's
    # ambient java while every task pointed JAVA_HOME at a deleted temurin-21 dir.
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    import _profiles
    jdk = _profiles.jdk_home(json.loads((repo_root / "bench/tasks.json").read_text()).get("jdk"))
    v = subprocess.run([str(jdk / "bin/java"), "-version"], capture_output=True, text=True) \
        if (jdk / "bin/java").exists() else None
    if not v or not re.search(r'version "21[."]', v.stderr):
        print(f"\u2717 JAVA_HOME={jdk} is not a JDK 21: {v.stderr.strip()[:200] if v else 'no bin/java'}")
        return False
    env = {**os.environ, "JAVA_HOME": str(jdk), "PATH": f"{jdk}/bin:{os.environ.get('PATH', '')}"}
    argv = ["cplt", "--project-dir", str(probe), *toolchain_grants(repo_root),
            "exec", "--", "./gradlew", "-q", "help"]
    try:
        r = subprocess.run(argv, cwd=probe, capture_output=True, text=True, timeout=300, env=env)
    except subprocess.TimeoutExpired:
        print("\u2717 gradle preflight timed out after 5 min")
        return False
    out = r.stdout + r.stderr
    print(out[-2000:], end="")
    ok = r.returncode == 0 and "Could not connect to the Gradle daemon" not in out
    mark = "\u2713" if ok else "\u2717"
    print(f"{mark} gradle preflight in cplt (JAVA_HOME={jdk}, CPLT_CONFIG={os.environ.get('CPLT_CONFIG', '-')}): exit {r.returncode}")
    return ok


if __name__ == "__main__" and sys.argv[1:2] == ["config"]:
    bench_cplt_config(Path(sys.argv[2]))
elif __name__ == "__main__" and sys.argv[1:2] == ["gradle"]:
    sys.exit(0 if gradle_preflight(Path(sys.argv[2]), Path(__file__).resolve().parents[2]) else 1)
elif __name__ == "__main__":
    import tempfile
    d = Path(tempfile.mkdtemp())
    for body in ("", "[sandbox]\nyes = true\n", "[sandbox]\nallow_localhost_any = false\n",
                 "[allow]\nread = []\n", "[sandbox]\nallow_localhost_any = true\n"):
        (d / "u.toml").write_text(body)
        out = tomllib.loads(bench_cplt_config(d / "b.toml", d / "u.toml").read_text())
        assert out["sandbox"]["allow_localhost_any"] is True, body
        assert (d / "u.toml").read_text() == body  # the user's file is never changed
    print("\u2713 _sandbox self-check passed")
