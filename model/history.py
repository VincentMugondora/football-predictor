"""Your own dataset: every prediction saved before kick-off, and the real result.

Two files under ``dataset/`` are committed to the repository and grow with every run:

* ``predictions.json``: one record per match, keyed by fixture ID. A record is updated on
  each run until kick-off and then frozen, so it always holds the last pre-match prediction.
* ``results.json``: the real final score (and half-time score when known) for each
  predicted match, added once the match has finished.

``site/history.json`` joins the two for the admin pages, and the most recent finished
matches go into ``picks.json`` as ``recent_comparisons`` for the app.
"""

from __future__ import annotations

import json
import math
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import pandas as pd

from model import config

DATASET_DIR = config.REPO_ROOT / "dataset"
PREDICTIONS_PATH = DATASET_DIR / "predictions.json"
RESULTS_PATH = DATASET_DIR / "results.json"
HISTORY_JSON_PATH = config.SITE_DIR / "history.json"

HISTORY_SCHEMA_VERSION = "1"
# Kick-off times can shift by a day between providers' time zones.
RESULT_MATCH_WINDOW = timedelta(hours=36)
# A match with no result this long after kick-off was probably postponed or abandoned.
NO_RESULT_AFTER = timedelta(days=10)
OUTCOMES = ("Home", "Draw", "Away")


def _iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _parse_iso(value: str) -> datetime:
    return datetime.strptime(value, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)


def _read_json(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    data = json.loads(path.read_text(encoding="utf-8") or "{}")
    if not isinstance(data, dict):
        raise ValueError(f"{path} must contain a JSON object keyed by match ID")
    return data


def _write_json(path: Path, data: object, compact: bool = False) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    if compact:
        text = json.dumps(data, separators=(",", ":"), allow_nan=False)
    else:
        # One field per line keeps git diffs readable as the dataset grows.
        text = json.dumps(data, indent=1, sort_keys=True, allow_nan=False) + "\n"
    tmp.write_text(text, encoding="utf-8")
    tmp.replace(path)


def load_dataset(
    predictions_path: Path = PREDICTIONS_PATH, results_path: Path = RESULTS_PATH
) -> dict[str, dict[str, Any]]:
    return {"predictions": _read_json(predictions_path), "results": _read_json(results_path)}


def save_dataset(
    dataset: dict[str, dict[str, Any]],
    predictions_path: Path = PREDICTIONS_PATH,
    results_path: Path = RESULTS_PATH,
) -> None:
    _write_json(predictions_path, dataset["predictions"])
    _write_json(results_path, dataset["results"])


def record_predictions(
    dataset: dict[str, dict[str, Any]],
    matches: list[dict[str, Any]],
    now: datetime,
    model_version: str,
) -> int:
    """Save each upcoming match's prediction. Returns how many records were written.

    Only matches that have not kicked off are written, so a stored prediction can never
    be changed after the result could be known.
    """
    predictions = dataset["predictions"]
    written = 0
    now_iso = _iso(now)
    for match in matches:
        match_id = str(match.get("id") or "")
        kickoff = match.get("date")
        if not match_id or not isinstance(kickoff, str):
            continue
        if _parse_iso(kickoff) <= now:
            continue
        winner = match.get("winner") or {}
        margin = winner.get("margin") or {}
        previous = predictions.get(match_id, {})
        predictions[match_id] = {
            "id": match_id,
            "div": match.get("div"),
            "league": match.get("league"),
            "date": kickoff,
            "home": match.get("home"),
            "away": match.get("away"),
            "p": match.get("p"),
            "odds": match.get("odds"),
            "pick": winner.get("pick"),
            "confidence": winner.get("confidence"),
            "margin": margin.get("goals"),
            "score": margin.get("score"),
            "p_score": margin.get("p_score"),
            "model_version": model_version,
            "predicted_at": now_iso,
            "first_predicted_at": previous.get("first_predicted_at", now_iso),
        }
        written += 1
    return written


def _find_result(prediction: dict[str, Any], finished: pd.DataFrame) -> pd.Series | None:
    if finished.empty:
        return None
    kickoff = _parse_iso(prediction["date"]).replace(tzinfo=None)
    rows = finished[
        (finished["HomeTeam"] == prediction["home"]) & (finished["AwayTeam"] == prediction["away"])
    ]
    if prediction.get("div"):
        rows = rows[rows["Div"] == prediction["div"]]
    if rows.empty:
        return None
    gaps = (pd.to_datetime(rows["Date"]) - kickoff).abs()
    rows = rows[gaps <= RESULT_MATCH_WINDOW]
    if rows.empty:
        return None
    return rows.iloc[(pd.to_datetime(rows["Date"]) - kickoff).abs().argmin()]


def settle_results(
    dataset: dict[str, dict[str, Any]], finished: pd.DataFrame, now: datetime
) -> int:
    """Add real results for predicted matches that have finished. Returns how many."""
    predictions = dataset["predictions"]
    results = dataset["results"]
    settled = 0
    if not finished.empty:
        finished = finished.copy()
        finished["Date"] = pd.to_datetime(finished["Date"], utc=True).dt.tz_localize(None)
    for match_id, prediction in predictions.items():
        existing = results.get(match_id)
        if existing and existing.get("status") == "final":
            continue
        kickoff = _parse_iso(prediction["date"])
        if kickoff > now:
            continue
        row = _find_result(prediction, finished)
        if row is not None and pd.notna(row.get("FTHG")) and pd.notna(row.get("FTAG")):
            result: dict[str, Any] = {
                "id": match_id,
                "status": "final",
                "home_goals": int(row["FTHG"]),
                "away_goals": int(row["FTAG"]),
                "settled_at": _iso(now),
            }
            hthg, htag = row.get("HTHG"), row.get("HTAG")
            if pd.notna(hthg) and pd.notna(htag):
                result["ht_home_goals"] = int(hthg)
                result["ht_away_goals"] = int(htag)
            results[match_id] = result
            settled += 1
        elif now - kickoff > NO_RESULT_AFTER and not existing:
            results[match_id] = {"id": match_id, "status": "no_result", "settled_at": _iso(now)}
    return settled


def _outcome_index(home_goals: int, away_goals: int) -> int:
    return 0 if home_goals > away_goals else 1 if home_goals == away_goals else 2


def _normalised_score(score: object) -> str | None:
    if not isinstance(score, str) or "-" not in score:
        return None
    left, right = score.split("-", 1)
    try:
        return f"{int(left)}-{int(right)}"
    except ValueError:
        return None


def evaluate(prediction: dict[str, Any], result: dict[str, Any] | None) -> dict[str, Any]:
    """Join one prediction with its result and score it."""
    entry: dict[str, Any] = {
        key: prediction.get(key)
        for key in ("id", "date", "league", "home", "away", "p", "odds", "pick", "confidence",
                    "margin", "score", "model_version", "predicted_at")
    }
    if not result:
        entry["status"] = "pending"
        return entry
    entry["status"] = result.get("status", "final")
    if entry["status"] != "final":
        return entry

    hg, ag = int(result["home_goals"]), int(result["away_goals"])
    actual = _outcome_index(hg, ag)
    entry["actual_score"] = f"{hg}-{ag}"
    entry["actual_outcome"] = OUTCOMES[actual]
    if "ht_home_goals" in result:
        entry["actual_ht_score"] = f"{result['ht_home_goals']}-{result['ht_away_goals']}"

    pick_index = {"home": 0, "draw": 1, "away": 2}.get(str(prediction.get("pick")))
    p = prediction.get("p") or [1 / 3, 1 / 3, 1 / 3]
    if pick_index is None:
        pick_index = max(range(3), key=lambda i: p[i])
    entry["predicted_outcome"] = OUTCOMES[pick_index]
    entry["hit_winner"] = pick_index == actual
    margin = prediction.get("margin")
    entry["hit_margin"] = bool(entry["hit_winner"] and margin is not None and abs(hg - ag) == int(margin))
    entry["hit_score"] = _normalised_score(prediction.get("score")) == f"{hg}-{ag}"
    entry["log_loss"] = round(-math.log(max(1e-6, float(p[actual]))), 4)
    entry["brier"] = round(sum((float(p[i]) - (1.0 if i == actual else 0.0)) ** 2 for i in range(3)), 4)

    odds = prediction.get("odds")
    if isinstance(odds, list) and len(odds) == 3 and all(isinstance(o, (int, float)) and o > 1 for o in odds):
        implied = [1.0 / float(o) for o in odds]
        total = sum(implied)
        book_p = [value / total for value in implied]
        favourite = min(range(3), key=lambda i: float(odds[i]))
        entry["book_favourite"] = OUTCOMES[favourite]
        entry["book_correct"] = favourite == actual
        entry["book_log_loss"] = round(-math.log(max(1e-6, book_p[actual])), 4)
    return entry


def build_entries(dataset: dict[str, dict[str, Any]]) -> list[dict[str, Any]]:
    """All predictions joined with their results, newest kick-off first."""
    results = dataset["results"]
    entries = [evaluate(pred, results.get(match_id)) for match_id, pred in dataset["predictions"].items()]
    return sorted(entries, key=lambda e: str(e.get("date")), reverse=True)


def app_comparisons(entries: list[dict[str, Any]], limit: int = 20) -> list[dict[str, Any]]:
    """The newest finished matches in the shape the app's ``recent_comparisons`` expects."""
    out: list[dict[str, Any]] = []
    for entry in entries:
        if entry.get("status") != "final":
            continue
        out.append({
            "id": entry["id"],
            "date": entry["date"],
            "league": entry["league"],
            "home": entry["home"],
            "away": entry["away"],
            "p": entry["p"],
            "odds": entry.get("odds"),
            "predicted_outcome": entry["predicted_outcome"],
            "predicted_score": entry.get("score"),
            "predicted_margin": entry.get("margin"),
            "actual_score": entry["actual_score"],
            "actual_outcome": entry["actual_outcome"],
            "correct": entry["hit_winner"],
            "hit_margin": entry["hit_margin"],
            "hit_score": entry["hit_score"],
            "book_favourite": entry.get("book_favourite"),
            "book_correct": entry.get("book_correct"),
            "log_loss": entry["log_loss"],
            "brier": entry["brier"],
        })
        if len(out) >= limit:
            break
    return out


def write_history_json(
    entries: list[dict[str, Any]], now: datetime, path: Path = HISTORY_JSON_PATH
) -> None:
    _write_json(
        path,
        {"schema_version": HISTORY_SCHEMA_VERSION, "generated_at": _iso(now), "entries": entries},
        compact=True,
    )
