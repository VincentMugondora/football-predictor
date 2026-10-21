"""Explicit provider team aliases. Unknown names fail closed."""

from __future__ import annotations

import json
from difflib import SequenceMatcher
from pathlib import Path

from model import config

REVIEW_PATH = config.MODEL_DIR / "data" / "team_names_review.json"


def clean_team_name(name: str) -> str:
    return " ".join(str(name).strip().split())


def canonical_team(name: str, provider: str = "unknown") -> str:
    """Apply known aliases; callers must validate cross-source identities against ratings."""
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
        suggestions = sorted(
            known_names,
            key=lambda candidate: (SequenceMatcher(None, cleaned.casefold(), candidate.casefold()).ratio(), candidate.casefold()),
            reverse=True,
        )[:3]
        item = {"provider": provider, "name": cleaned, "suggestions": suggestions}
        entries = [entry for entry in entries if not (entry.get("provider") == provider and entry.get("name") == cleaned)]
        entries.append(item)
    REVIEW_PATH.write_text(json.dumps(entries, indent=2), encoding="utf-8")
