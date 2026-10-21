"""Explicit provider team aliases. Unknown names fail closed."""

from __future__ import annotations

import json
from pathlib import Path

from model import config

REVIEW_PATH = config.MODEL_DIR / "data" / "team_names_review.json"


def canonical_team(name: str, provider: str = "unknown") -> str:
    cleaned = " ".join(str(name).strip().split())
    mapping = config.TEAM_ALIASES
    if cleaned in mapping:
        return mapping[cleaned]
    known = set(mapping.values())
    if cleaned in known:
        return cleaned
    REVIEW_PATH.parent.mkdir(parents=True, exist_ok=True)
    entries: list[dict[str, str]] = []
    if REVIEW_PATH.exists():
        try:
            entries = json.loads(REVIEW_PATH.read_text(encoding="utf-8"))
        except (ValueError, OSError):
            entries = []
    item = {"provider": provider, "name": cleaned}
    if item not in entries:
        entries.append(item)
    REVIEW_PATH.write_text(json.dumps(entries, indent=2), encoding="utf-8")
    raise ValueError(f"Unmapped team name from {provider}: {cleaned!r}; see {REVIEW_PATH}")
