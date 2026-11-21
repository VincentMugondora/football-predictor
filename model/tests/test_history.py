from datetime import datetime, timedelta, timezone
from pathlib import Path

import pandas as pd
import pytest

from model import history

NOW = datetime(2026, 11, 22, 10, 0, tzinfo=timezone.utc)


def _match(match_id: str, kickoff: datetime, pick: str = "home", margin: int = 1, score: str = "2-1",
           odds: list[float] | None = None) -> dict:
    return {
        "id": match_id,
        "date": kickoff.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "div": "E0",
        "league": "Premier League",
        "home": "Arsenal",
        "away": "Chelsea",
        "p": [0.58, 0.24, 0.18],
        "odds": odds,
        "winner": {"pick": pick, "confidence": "medium", "margin": {"goals": margin, "score": score, "p_score": 0.11}},
    }


def _finished(date: datetime, hg: int, ag: int, ht: tuple[int, int] | None = None) -> pd.DataFrame:
    row = {"Div": "E0", "Date": pd.Timestamp(date.replace(tzinfo=None)), "HomeTeam": "Arsenal",
           "AwayTeam": "Chelsea", "FTHG": hg, "FTAG": ag,
           "HTHG": ht[0] if ht else float("nan"), "HTAG": ht[1] if ht else float("nan")}
    return pd.DataFrame([row])


def test_only_upcoming_matches_are_saved_and_kicked_off_ones_stay_frozen() -> None:
    dataset = {"predictions": {}, "results": {}}
    upcoming = _match("m1", NOW + timedelta(hours=5))
    started = _match("m2", NOW - timedelta(minutes=5))
    assert history.record_predictions(dataset, [upcoming, started], NOW, "v1") == 1
    assert set(dataset["predictions"]) == {"m1"}
    first = dataset["predictions"]["m1"]["first_predicted_at"]

    # A later run before kick-off updates the prediction but keeps when it was first made.
    later = NOW + timedelta(hours=2)
    changed = _match("m1", NOW + timedelta(hours=5), score="1-0")
    history.record_predictions(dataset, [changed], later, "v2")
    assert dataset["predictions"]["m1"]["score"] == "1-0"
    assert dataset["predictions"]["m1"]["first_predicted_at"] == first

    # After kick-off, nothing can overwrite it.
    history.record_predictions(dataset, [_match("m1", NOW + timedelta(hours=5), score="5-0")],
                               NOW + timedelta(hours=6), "v3")
    assert dataset["predictions"]["m1"]["score"] == "1-0"


def test_results_are_matched_by_teams_and_kickoff_and_scored() -> None:
    kickoff = NOW - timedelta(hours=20)
    dataset = {"predictions": {}, "results": {}}
    history.record_predictions(dataset, [_match("m1", kickoff, odds=[1.95, 3.6, 4.33])], kickoff - timedelta(hours=8), "v1")

    # CSV rows are dated midnight; still within the matching window.
    finished = _finished(kickoff.replace(hour=0), 2, 1, ht=(1, 0))
    assert history.settle_results(dataset, finished, NOW) == 1
    entry = history.build_entries(dataset)[0]
    assert entry["status"] == "final"
    assert entry["actual_score"] == "2-1" and entry["actual_ht_score"] == "1-0"
    assert entry["hit_winner"] and entry["hit_margin"] and entry["hit_score"]
    assert entry["book_favourite"] == "Home" and entry["book_correct"]
    assert entry["log_loss"] == pytest.approx(0.5447, abs=1e-3)

    comparison = history.app_comparisons(history.build_entries(dataset))[0]
    assert comparison["predicted_outcome"] == "Home" and comparison["correct"] is True
    assert comparison["actual_score"] == "2-1"


def test_wrong_margin_and_unplayed_matches() -> None:
    kickoff = NOW - timedelta(hours=20)
    dataset = {"predictions": {}, "results": {}}
    history.record_predictions(dataset, [_match("m1", kickoff)], kickoff - timedelta(hours=1), "v1")
    history.settle_results(dataset, _finished(kickoff, 3, 0), NOW)
    entry = history.build_entries(dataset)[0]
    assert entry["hit_winner"] and not entry["hit_margin"] and not entry["hit_score"]
    assert "book_favourite" not in entry  # no odds were saved

    # A result a week away is a different match, and old unresolved matches are marked.
    dataset2 = {"predictions": {}, "results": {}}
    history.record_predictions(dataset2, [_match("m2", kickoff)], kickoff - timedelta(hours=1), "v1")
    assert history.settle_results(dataset2, _finished(kickoff + timedelta(days=7), 1, 1), NOW) == 0
    assert history.build_entries(dataset2)[0]["status"] == "pending"
    history.settle_results(dataset2, pd.DataFrame(), NOW + timedelta(days=11))
    assert history.build_entries(dataset2)[0]["status"] == "no_result"


def test_dataset_round_trips_through_files(tmp_path: Path) -> None:
    dataset = {"predictions": {}, "results": {}}
    history.record_predictions(dataset, [_match("m1", NOW + timedelta(hours=3))], NOW, "v1")
    preds, results = tmp_path / "predictions.json", tmp_path / "results.json"
    history.save_dataset(dataset, preds, results)
    assert history.load_dataset(preds, results) == dataset
    out = tmp_path / "history.json"
    history.write_history_json(history.build_entries(dataset), NOW, out)
    assert '"status":"pending"' in out.read_text(encoding="utf-8")
