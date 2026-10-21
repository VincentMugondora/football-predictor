"""Explicit provider team aliases. Unknown names fail closed."""

from __future__ import annotations

import json
from difflib import get_close_matches
from pathlib import Path

from model import config

REVIEW_PATH = config.MODEL_DIR / "data" / "team_names_review.json"


def clean_team_name(name: str) -> str:
    return " ".join(str(name).strip().split())


def canonical_team(name: str, provider: str = "unknown") -> str:
    """Apply reviewed aliases; otherwise preserve the cleaned name for later validation."""
    cleaned = clean_team_name(name)
    mapping = config.TEAM_ALIASES
    if cleaned in mapping:
        return mapping[cleaned]
    return cleaned


def record_unmatched_team_names(names: list[str], provider: str, known_names: set[str]) -> None:
    """Append all unmapped provider names with suggestions; suggestions never resolve names."""
    REVIEW_PATH.parent.mkdir(parents=True, exist_ok=True)
    entries: list[dict[str, object]] = []
    if REVIEW_PATH.exists():
        try:
            entries = json.loads(REVIEW_PATH.read_text(encoding="utf-8"))
        except (ValueError, OSError):
            entries = []
    for name in sorted(set(names)):
        cleaned = clean_team_name(name)
        suggestions = get_close_matches(cleaned, sorted(known_names), n=3, cutoff=0.35)
        item = {"provider": provider, "name": cleaned, "suggestions": suggestions}
        entries = [entry for entry in entries if not (entry.get("provider") == provider and entry.get("name") == cleaned)]
        entries.append(item)
    REVIEW_PATH.write_text(json.dumps(entries, indent=2), encoding="utf-8")
