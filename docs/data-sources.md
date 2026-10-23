# Data source verification

Checked 23 October 2026. This report records current provider documentation plus account-specific live checks. No API keys or authorization headers are included here.

## Verified providers

| Source | Purpose and endpoints | Free limits confirmed | Live check and use constraints |
| --- | --- | --- | --- |
| [Football-Data.co.uk](https://www.football-data.co.uk/) | Historical match results and odds: `https://www.football-data.co.uk/mmz4281/{season}/{division}.csv`. | No API quota. Its fair-use page says automated downloads at most twice weekly; its free data is for private betting or academic research, not commercial or heavy automated data-training projects. | Existing local CSVs are used. `ALLOW_FOOTBALL_DATA_DOWNLOADS=false`; the daily job does not fetch missing seasons. Resolve their data-training terms before automating or publishing a model trained on this data. |
| [football-data.org v4](https://docs.football-data.org/general/v4/) | Fixtures/results: `GET /v4/competitions/{code}/matches?dateFrom=...&dateTo=...`; match lists can request unfolded goals with `X-Unfold-Goals: true`. | Current published Free plan: 12 competitions, delayed scores and schedules, 10 calls/minute. The source publishes no monthly quota on the cited pages. | Live account check returned a `TIER_ONE` match response. A finished match by ID and a finished-match list with `X-Unfold-Goals: true` both omitted the `goals` event field. Do not use this provider for minute events. Football-data.org terms/policies apply to displaying its data. |
| [API-Football v3](https://www.api-football.com/documentation-v3) | Coverage: `GET /leagues?id={id}&season={year}`; fixture pages: `GET /fixtures?league={id}&season={year}&page={n}`; events: `GET /fixtures/events?fixture={id}`. Auth header: `x-apisports-key`. | Current Free plan: 100 requests/day and 10/minute. Daily and minute headers are read from each response; the backfill is capped at 30 requests/run and stops at 40 daily requests remaining by default. | Live key: `/fixtures?ids=...` was denied on Free, so event requests are one fixture at a time. `/fixtures/events?fixture=1208021` returned 16 events and 99 daily requests remaining. `/leagues?id=39&season=2024` reported `coverage.fixtures.events=true` and 98 remaining; 2025 returned a plan-season error (“try from 2022 to 2024”), and 2026 returned no season row. Current backfill start is therefore configured as 2024 and checks coverage once per season while moving backwards. Coverage true does not guarantee every fixture has events. |
| [The Odds API v4](https://the-odds-api.com/liveapi/guides/v4/) | Optional reference odds: `GET /v4/sports/{sport}/odds?regions={region}&markets=h2h&oddsFormat=decimal`. | Free account response headers are the source of truth. One-region h2h calls are budgeted conservatively. | The existing live daily run observed 498 credits remaining and 0 credits used because its same-day response was cached. It did not provide a fresh bookmaker list, so bookmaker availability (including Pinnacle) is not claimed here. The API terms permit display subject to their conditions and restrict raw-feed resale. |
| [OddsPapi](https://oddspapi.io/us/docs) | Unused fallback candidate. | Advertised quota and coverage were not checked with a live account. | Not integrated; do not rely on public quota claims without a live response and terms review. |

## Optional API-Football minute-window backfill

The Level 2 feature is **off by default** (`TIMING_BACKFILL_ENABLED=false`). When explicitly enabled, the daily prediction job must finish and publish picks first. The separate backfill then:

- uses only the configured league (`E0` by default), checks the `/leagues` events coverage flag before fetching that season, and processes seasons newest to oldest;
- honors the response quota headers, preserves a 40-request reserve by default, allows at most 30 requests per run including retries, and spaces requests at no more than 10/minute;
- skips cached fixtures and unfinished matches; local cache files contain only goal minute, added-time minute, canonical scoring team, and event type. The fixture ID is only in the filename, including for cached 0-0 matches;
- counts scored penalties as goals, excludes missed and shootout penalties, and assigns an own goal to the beneficiary only when exactly one assignment reconciles with the provider's final score. Ambiguous/incomplete event sets are skipped. Extra-time goals are retained in the local event cache but excluded from the 90-minute windows because the output windows end at 90+;
- reports cached fixture count, collected goals, estimated days to the configured 3,000-goal league threshold, and request use.

API-Football's quota guidance recommends caching to avoid duplicate calls. Its terms do **not** clearly grant a right to retain event data for long-term local model training, and say it does not provide a license to publish its data in apps/websites; users must obtain any required permission from the relevant rights holders. The backfill is disabled by default and only starts after explicit opt-in. Resolve those rights before enabling it or publishing windows derived from its event data. See [API-Football quota guidance](https://www.api-football.com/news/post/how-to-optimize-api-sports-calls-and-quota-usage) and [API-Football terms](https://www.api-football.com/terms).

The football-data.org live check is also documented here: official docs say match lists can unfold goal events with `X-Unfold-Goals: true`, but this free-key response did not include them. The app and model do not use football-data.org goal-minute events. See [match response docs](https://docs.football-data.org/general/v4/match.html) and [API policies](https://docs.football-data.org/general/v4/policies.html).

## Existing CSV and app constraints

CSV history can omit halftime fields and closing odds; loaders validate each row and use only fields that exist. Do not enable automatic CSV downloads without resolving Football-Data.co.uk's terms. Provider team aliases remain explicit; unknown cross-provider names are skipped and written to the review file rather than fuzzy-matched.

The app downloads only the compact published `site/picks.json` and caches the last valid payload for offline use. No bookmaker is logged into, scraped, or automated; MWOS prices are entered by hand.

## Sources

- [football-data.org free plan and pricing](https://www.football-data.org/pricing), [coverage](https://www.football-data.org/coverage), [policies and `X-Unfold-Goals`](https://docs.football-data.org/general/v4/policies.html)
- [API-Football pricing](https://www.api-football.com/pricing), [v3 docs](https://www.api-football.com/documentation-v3), [rate limits and response headers](https://www.api-football.com/news/post/how-ratelimit-works), [terms](https://www.api-football.com/terms)
- [The Odds API docs](https://the-odds-api.com/liveapi/guides/v4/), [terms](https://the-odds-api.com/terms-and-conditions.html)
- [Football-Data.co.uk fair data use](https://www.football-data.co.uk/contact.php), [CSV notes](https://football-data.co.uk/notes.txt)
