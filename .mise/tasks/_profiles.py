#!/usr/bin/env python3
"""Shared helpers for model profile tasks (model-use, model-list, model-status)."""
import sys
import tomllib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PROFILES_DIR = ROOT / "profiles"
LOCAL_TOML = ROOT / "mise.local.toml"
HF_HUB = Path.home() / ".cache" / "huggingface" / "hub"

REQUIRED_PARAMS = [
    "MLX_MODEL",
    "MLX_CACHE_BYTES",
    "MLX_CACHE_SIZE",
    "MLX_MAX_TOKENS",
    "MLX_OPENCODE_CONTEXT",
    "MLX_OPENCODE_OUTPUT",
    "MLX_OPENCODE_CHUNK_TIMEOUT",
]

VALID_STATUS = {"recommended", "untested", "testing", "slow", "oom", "skipped", "broken", "failed"}

# Single source of truth for every optional param and its default.
# Any task that needs a profile value reads it through params_for() / OPTIONAL_DEFAULTS —
# never re-declares a default of its own, so the three copies of these values that used to
# live in model-use, server and opencode-init cannot drift apart again.
OPTIONAL_DEFAULTS = {
    # backend + prompt formatting
    "MLX_SERVER_TYPE":            "mlx-lm",
    "MLX_CHAT_TEMPLATE":          "",
    "MLX_CHAT_TEMPLATE_ARGS":     "",
    "MLX_TRUST_REMOTE_CODE":      "",       # non-empty enables --trust-remote-code
    # sampling
    "MLX_TEMP":                   "0.6",    # 0.0 (mlx-lm default) causes repetition loops
    "MLX_TOP_P":                  "1.0",
    "MLX_TOP_K":                  "0",      # 0 = disabled
    "MLX_MIN_P":                  "0.0",
    # Repetition control. These four are per request, not per server: mlx_lm 0.31.3 reads
    # them from the request body (server.py:1180-1184) and publishes no CLI flag for any of
    # them, and the same is true of mlx_vlm.server and oMLX. opencode-init writes them into
    # opencode.json instead — see PENALTY_PARAMS below. Defaults are mlx-lm's own request
    # defaults, so a profile that does not set them sends nothing and changes nothing.
    # Reach for these when a model collapses into a repetition loop: Qwen3.5-9B failed a
    # benchmark run by emitting 'DIDIDIDI...' without end (issue #4).
    "MLX_REPETITION_PENALTY":     "0.0",    # 0 = off. Sign-aware multiplicative penalty
                                            # (arXiv:1909.05858); >1.0 penalises repeats.
    "MLX_REPETITION_CONTEXT_SIZE": "20",    # tokens of history the penalty looks back over
    "MLX_PRESENCE_PENALTY":       "0.0",    # 0 = off. Additive, flat per repeated token.
    "MLX_FREQUENCY_PENALTY":      "0.0",    # 0 = off. Additive, scales with token count.
    # throughput
    "MLX_DRAFT_MODEL":            "",       # speculative decoding for mlx-lm (oMLX uses MTP instead)
    "MLX_NUM_DRAFT_TOKENS":       "",
    "MLX_PREFILL_STEP_SIZE":      "",       # lower = smaller prefill activation spike (OOM control)
    # oMLX-only
    "MLX_OMLX_MEMORY_GUARD":      "",       # off | safe | balanced | aggressive
    "MLX_OMLX_MEMORY_GUARD_GB":   "",
    "MLX_OMLX_HOT_CACHE_MAX_SIZE": "",
    "MLX_OMLX_SSD_CACHE_MAX_SIZE": "",
    # opencode client limits
    "MLX_OPENCODE_CONTEXT":       "131072",
    "MLX_OPENCODE_OUTPUT":        "16384",
    "MLX_OPENCODE_CHUNK_TIMEOUT": "600000",
}

# Params the server ignores for a given backend — warned about rather than applied,
# so a profile can never quietly claim a setting that has no effect.
IGNORED_BY_BACKEND = {
    "omlx": [
        "MLX_MAX_TOKENS", "MLX_TEMP", "MLX_TOP_P", "MLX_TOP_K", "MLX_MIN_P",
        "MLX_CHAT_TEMPLATE", "MLX_CHAT_TEMPLATE_ARGS", "MLX_CACHE_BYTES", "MLX_CACHE_SIZE",
        "MLX_DRAFT_MODEL", "MLX_NUM_DRAFT_TOKENS", "MLX_PREFILL_STEP_SIZE",
    ],
    "mlx-vlm": [
        "MLX_TEMP", "MLX_TOP_P", "MLX_TOP_K", "MLX_MIN_P", "MLX_CACHE_BYTES", "MLX_CACHE_SIZE",
        "MLX_CHAT_TEMPLATE", "MLX_CHAT_TEMPLATE_ARGS", "MLX_DRAFT_MODEL",
        "MLX_NUM_DRAFT_TOKENS", "MLX_PREFILL_STEP_SIZE",
    ],
}
# The MLX_*_PENALTY params are deliberately absent from both lists: all three backends read
# them from the request body, so all three apply them — mlx_lm/server.py:1180-1184,
# mlx_vlm/server/schemas.py:318-326, omlx/request.py:63-69.

# Repetition-control params, as (request body key, profile param, type). No backend takes
# these on the command line, so they travel in the request body that opencode sends.
PENALTY_PARAMS = [
    ("repetition_penalty",      "MLX_REPETITION_PENALTY",      float),
    ("repetition_context_size", "MLX_REPETITION_CONTEXT_SIZE", int),
    ("presence_penalty",        "MLX_PRESENCE_PENALTY",        float),
    ("frequency_penalty",       "MLX_FREQUENCY_PENALTY",       float),
]


def penalties(params: dict) -> dict:
    """Penalty body params whose value differs from the default. Empty dict = send nothing.

    Only differences are returned, so a profile that does not opt in leaves the request
    body exactly as it was before these params existed.
    """
    out = {}
    for body_key, var, cast in PENALTY_PARAMS:
        val = str(params.get(var) or OPTIONAL_DEFAULTS[var]).strip()
        if cast(val) != cast(OPTIONAL_DEFAULTS[var]):
            out[body_key] = cast(val)
    return out


def served_model_id(params: dict) -> str:
    """The id the running server answers to, which is not always MLX_MODEL.

    oMLX discovers models from the Hugging Face cache and names them by the
    cache directory, so `mvid/Huihui-...` is served as `mvid--Huihui-...`. A
    request using the slash form returns HTTP 404, and mlx-lm's 404 for an
    unknown model looks identical to a server that failed to start.
    """
    model = params.get("MLX_MODEL", "")
    if params.get("MLX_SERVER_TYPE", "mlx-lm").strip() == "omlx":
        return model.replace("/", "--")
    return model


def params_for(key: str) -> dict:
    """Profile params merged over OPTIONAL_DEFAULTS. Profile always wins."""
    params = {k: str(v) for k, v in load(key)[1].items()}
    return {**OPTIONAL_DEFAULTS, **params}


def warn_ignored(key: str, params: dict) -> list[str]:
    """Return profile params that the selected backend cannot apply."""
    declared = set(load(key)[1])
    return [p for p in IGNORED_BY_BACKEND.get(params["MLX_SERVER_TYPE"], []) if p in declared]


def list_keys() -> list[str]:
    return sorted(p.stem for p in PROFILES_DIR.glob("*.toml"))


def load(key: str) -> tuple[dict, dict]:
    """Load and validate a profile. Returns (meta, params). Exits on error."""
    path = PROFILES_DIR / f"{key}.toml"
    if not path.exists():
        available = ", ".join(list_keys())
        raise SystemExit(f"Unknown profile '{key}'. Available: {available}")
    data = tomllib.loads(path.read_text())
    meta = data.get("meta", {})
    params = data.get("params", {})
    missing = [k for k in REQUIRED_PARAMS if k not in params]
    if missing:
        raise SystemExit(f"Profile '{key}' missing required params: {', '.join(missing)}")
    unknown = sorted(set(params) - set(REQUIRED_PARAMS) - set(OPTIONAL_DEFAULTS))
    if unknown:
        raise SystemExit(
            f"Profile '{key}' declares unknown param(s): {', '.join(unknown)}. "
            f"A misspelled param is silently ignored by every backend — fix the name "
            f"or add it to OPTIONAL_DEFAULTS in _profiles.py."
        )
    if meta.get("status") not in VALID_STATUS:
        raise SystemExit(
            f"Profile '{key}' has invalid status '{meta.get('status')}'. "
            f"Must be one of: {', '.join(sorted(VALID_STATUS))}"
        )
    return meta, params


def hf_cache_dir(hf_id: str) -> Path:
    return HF_HUB / ("models--" + hf_id.replace("/", "--"))


def is_downloaded(hf_id: str) -> bool:
    snaps = hf_cache_dir(hf_id) / "snapshots"
    if not snaps.is_dir():
        return False
    # A complete download must have at least one large model weight file
    return any(snaps.rglob("*.safetensors"))


def cache_size_gib(hf_id: str) -> float:
    d = hf_cache_dir(hf_id)
    if not d.exists():
        return 0.0
    total = sum(f.stat().st_size for f in d.rglob("*") if f.is_file())
    return total / (1024 ** 3)


def active_key() -> str | None:
    """Return the currently active profile key, or None if not set."""
    if LOCAL_TOML.exists():
        data = tomllib.loads(LOCAL_TOML.read_text())
        return data.get("env", {}).get("MLX_ACTIVE_PROFILE")
    return None

def pick_interactive() -> str:
    """Prompt user to choose a profile (fzf if available, else numbered list)."""
    import shutil
    import subprocess
    keys = list_keys()
    if not keys:
        raise SystemExit("No profiles found in profiles/. Add a .toml file first.")
    active = active_key()
    rows = []
    for k in keys:
        meta, params = load(k)
        dl = "✓" if is_downloaded(params["MLX_MODEL"]) else "–"
        marker = "●" if k == active else " "
        rows.append((k, f"{marker} {k:<22} {meta['name']:<40} [{meta['status']}]  DL:{dl}"))

    if shutil.which("fzf"):
        fzf_input = "\n".join(r[1] for r in rows)
        result = subprocess.run(
            ["fzf", "--ansi", "--prompt=model> ", "--height=40%", "--reverse"],
            input=fzf_input,
            capture_output=True,
            text=True,
        )
        if result.returncode != 0 or not result.stdout.strip():
            raise SystemExit("Cancelled.")
        chosen_line = result.stdout.strip()
        # Match back to key by position
        for i, (k, line) in enumerate(rows):
            if line == chosen_line:
                return k
        raise SystemExit("Could not match fzf selection.")

    print("\nAvailable model profiles:\n")
    for i, (k, line) in enumerate(rows, 1):
        print(f"  {i}) {line}")
    print()
    try:
        sel = input("Choose number (or q to quit): ").strip()
    except (EOFError, KeyboardInterrupt):
        raise SystemExit("\nCancelled.")
    if sel.lower() == "q":
        raise SystemExit("Cancelled.")
    try:
        idx = int(sel) - 1
        return rows[idx][0]
    except (ValueError, IndexError):
        raise SystemExit(f"Invalid selection: {sel}")


if __name__ == "__main__":
    # Self-check for the one rule penalties() has to keep: a profile that does not opt in
    # must add nothing to the request body. Run with: python3 .mise/tasks/_profiles.py
    assert penalties({}) == {}, "unset params must send nothing"
    assert penalties({v: OPTIONAL_DEFAULTS[v] for _, v, _ in PENALTY_PARAMS}) == {}
    assert penalties({"MLX_REPETITION_PENALTY": "0"}) == {}, "0 and 0.0 are the same value"
    assert penalties({"MLX_REPETITION_PENALTY": "1.05"}) == {"repetition_penalty": 1.05}
    for k in list_keys():
        load(k)
    print(f"✓ penalties() self-check passed, {len(list_keys())} profiles validate")
