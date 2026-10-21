# Data source verification

Checked 21 October 2026. This report separates published documentation from account-specific endpoint checks. No provider credentials were available in the process environment or a repo `.env`, and this workspace could not resolve provider hosts during direct requests. As a result, no live-key test has passed. Integration now uses football-data.org v4 for fixtures/results and The Odds API only when configured; validate with live keys before publishing a scheduled job.

## Summary

| Source | Intended use | Documented endpoint(s) | Published free limits | Current verification |
| --- | --- | --- | --- | --- |
| [Football-Data.co.uk](https://www.football-data.co.uk/) | Historical results and bookmaker odds; possible fixture CSV | `https://www.football-data.co.uk/mmz4281/{season}/{division}.csv`; `https://www.football-data.co.uk/fixtures.csv` | No numeric API quota. The site's [fair data usage policy](https://www.football-data.co.uk/contact.php) permits manual downloads or at most light automated downloads (twice weekly maximum); it says free data is for private individuals' personal betting or academic research, not commercial or heavy automated data-training projects. | Direct CSV probes blocked by DNS in this environment. Fixture endpoint availability and current-season data/odds columns unverified. |
| [football-data.org v4](https://docs.football-data.org/general/v4/) | Primary upcoming fixtures and recent results | `GET /v4/competitions/{code}/matches?dateFrom=YYYY-MM-DD&dateTo=YYYY-MM-DD`; `GET /v4/competitions/{code}/matches?status=FINISHED&dateFrom=...&dateTo=...`; auth header `X-Auth-Token` | [10 requests/minute](https://docs.football-data.org/general/v4/policies.html), free plan lists 12 competitions, fixtures and delayed scores/schedules ([pricing](https://www.football-data.org/pricing)). [Free coverage list](https://www.football-data.org/coverage) currently shows Champions League, Premier League, Championship, Bundesliga, Serie A, La Liga, and other competitions. No monthly request cap stated on cited pages. Season history availability must be checked per competition via its resource. | Docs establish documented limit/coverage. This runtime has no key and DNS blocked the public endpoint. Account-specific access, available seasons and data delay not verified. |
| [API-Football](https://www.api-football.com/documentation-v3) | Fallback fixtures/results | `GET https://v3.football.api-sports.io/fixtures?league={id}&season={year}&from={date}&to={date}`; header `x-apisports-key` | [Free plan](https://www.api-football.com/pricing): 100 requests/day. Provider guidance also reports 10 requests/minute. All endpoints are listed, but free plan limits historical seasons; exact coverage is league/season-specific. | No key available, so current-season request and season coverage could not be tested. The quota figure is documentation-confirmed only. |
| [The Odds API v4](https://the-odds-api.com/liveapi/guides/v4/) | Reference 1X2 odds | `GET /v4/sports/{sport}/odds?regions={region}&markets=h2h&oddsFormat=decimal&apiKey=...`; sports catalog `GET /v4/sports` is documented as free | User-reported 500 monthly credits was not confirmed from an accessible official pricing page in this check. v4 docs specify odds quota cost based on markets × regions; inspect response quota headers. Exact bookmaker availability is sport/region/time dependent. | No key available, so credits, returned bookmaker set and football league coverage were not verified. No request made. Current terms permit app/UI display and derived values subject to not reselling the raw feed; attribution appreciated, not required ([terms](https://the-odds-api.com/terms-and-conditions.html)). |
| [OddsPapi](https://oddspapi.io/) (alternative) | Alternative reference 1X2 odds | Official v4 docs list `/v4/tournaments` and `/v4/odds-by-tournaments` (see [docs](https://oddspapi.io/us/docs)); request quota docs linked above. | Its own materials advertise 250 requests/month, but this was not independently confirmed against a live account. | Not integrated or tested. Live key, soccer coverage, terms, quota and display rights still need verification. |

## Endpoint and data constraints

### Historical dataset

The CSV notes document result fields (`Date`, `HomeTeam`, `AwayTeam`, `FTHG`, `FTAG`, `FTR`) and odds fields including Pinnacle (`PSH/PSD/PSA`) and market averages (`AvgH/AvgD/AvgA`). The notes describe Pinnacle columns as pre-closing, with a `C` suffix for closing odds where provided. These are useful for historical experiments, but presence varies by season and league. The current repository requests only seasons through 2024/25 in `model/config.py`; it must not assume a more recent season or fixtures feed is present.

The site's data-use terms are a major constraint: downloading at most twice weekly is the stated ceiling for automated access, and the site's free offering is not intended for commercial or data-training projects. The intended use in this repo trains a statistical model, so the owner should contact the source for permission or establish a suitable license before automated refresh/training. Avoid a daily automated CSV fetch.

### football-data.org

Competition match subresources support date range, status and season filters. Match responses include provider match IDs and UTC kickoff (`utcDate` in v4 schema), which can support the requirement for real fixture IDs and times. Its free tier has delayed scores/schedules and no odds; it is therefore suitable only for fixtures/results, and not a source for live market prices. The published free competition list appears to include the project's current England, Germany, Italy and Spain top divisions, but allowed competition identifiers and current-season access need an authenticated request before implementation.

### Odds APIs

The Odds API's h2h market is the relevant three-way reference market for soccer. A single region and `h2h` market minimizes documented credit consumption, but the actual monthly free allowance, soccer region coverage, and availability of Pinnacle must be confirmed through the user's account response and quota headers. The published terms allow displaying the feed and derived values in an app, with a restriction against raw-feed resale.

OddsPapi is a fallback candidate only. Public claims of 250 requests/month and Pinnacle coverage are not enough to establish that its soccer leagues, endpoint contract, terms, and app display rights satisfy this project. Verify those against official account docs and a live response before choosing it.

## Live verification blockers and required checks

1. No `.env` or provider-key environment variables were present. Use the committed `.env.example` as a variable template; keep real keys in ignored `.env` or CI secret storage.
2. Outbound name resolution failed for `www.football-data.co.uk` and `api.football-data.org` from this execution environment. Direct network checks could not run. Odds API hosts were not called because no key was available.
3. Before implementation, run one low-cost authenticated check for football-data.org competition list and a current-season PL match window; verify token access, current fixture IDs/times, schedule delay, and competition count. Check API-Football's current 2026 season for one configured league, its response quota headers, and documented delay/terms. For The Odds API, make one soccer `h2h` call for one region and record quota headers, bookmaker names, and whether Pinnacle is present. If unavailable, perform the same checks for OddsPapi and inspect its official terms for display/caching rights.
4. Contact Football-Data.co.uk before automating repeated CSV pulls or using its free files for model training, because the published fair-use terms conflict with the proposed daily training workflow.

## Decision

The integration uses football-data.org as the fixtures/results provider and The Odds API as an optional reference-price provider. Neither has passed account-specific verification because credentials and network access were unavailable. Football-Data.co.uk downloads are disabled by default; enable only after resolving the source's stated training-use restrictions. Odds are optional, so no invented price is emitted when the source is unavailable.

## Sources

- [football-data.org policies](https://docs.football-data.org/general/v4/policies.html), [pricing](https://www.football-data.org/pricing), [free coverage](https://www.football-data.org/coverage), [match reference](https://docs.football-data.org/general/v4/match.html)
- [API-Football pricing](https://www.api-football.com/pricing), [documentation](https://www.api-football.com/documentation-v3)
- [The Odds API v4 docs](https://the-odds-api.com/liveapi/guides/v4/), [terms](https://the-odds-api.com/terms-and-conditions.html)
- [OddsPapi quota documentation](https://oddspapi.io/us/docs/requests-and-quota)
- [Football-Data.co.uk CSV notes](https://football-data.co.uk/notes.txt), [fair data usage policy](https://www.football-data.co.uk/contact.php)
