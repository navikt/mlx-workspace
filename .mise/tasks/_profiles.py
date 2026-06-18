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

VALID_STATUS = {"daily-driver", "untested", "testing", "slow", "oom", "skipped"}


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
    return snaps.is_dir() and any(snaps.iterdir())


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
