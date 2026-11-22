# Commits today's changes one group at a time, then pushes them.
# Run from the project folder:
#   powershell -ExecutionPolicy Bypass -File scripts\commit_and_push.ps1
# Only the files listed below are committed; anything else you changed is left alone.

$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)

$trailer1 = 'Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>'
$trailer2 = 'Claude-Session: https://claude.ai/code/session_01FZFNo5ZygXikgHjDBp9HTf'

function Invoke-Git {
    & git @args
    if ($LASTEXITCODE -ne 0) { throw "git $($args -join ' ') failed" }
}

function Commit-Group([string]$title, [string]$body, [string[]]$paths) {
    $existing = @($paths | Where-Object { Test-Path $_ })
    if ($existing.Count -eq 0) { Write-Host "skip: $title (no files)"; return }
    Invoke-Git add -A -- @existing
    & git diff --cached --quiet -- @existing
    if ($LASTEXITCODE -eq 0) { Write-Host "skip: $title (nothing changed)"; return }
    Invoke-Git commit -m $title -m $body -m "$trailer1`n$trailer2" -- @existing
    Write-Host "committed: $title" -ForegroundColor Green
}

# Make sure nothing is already staged, so each commit holds only its own files.
& git diff --cached --quiet
if ($LASTEXITCODE -ne 0) { throw 'Some files are already staged. Run "git reset" first, then run this script again.' }

$workflow = '.github/workflows/daily_predictions.yml'
if (Select-String -Path $workflow -Pattern 'model/requirements.txt' -Quiet) {
    Write-Warning "$workflow is still the old version. Replace it with the downloaded daily_predictions.yml to include it in the first commit."
}

Commit-Group 'fix(ci): repair the daily predictions workflow' `
    'Install from the root requirements.txt, stop adding the missing realPicks.json, run tests before publishing, keep historical CSVs in the Actions cache, and commit the new dataset.' `
    @($workflow, 'scripts/register_daily_task.ps1')

Commit-Group 'fix(data): load the current season, refresh twice weekly, drop duplicate results' `
    'Add 2026-27 to SEASONS, refresh the current season CSV at most twice a week (football-data.co.uk fair use), and stop counting provider results twice on the last CSV day.' `
    @('model/config.py', 'model/data.py')

Commit-Group 'feat(model): predict the winning margin and keep our own dataset' `
    'Every match now names a result, its most likely margin and a matching scoreline. Predictions are saved before kick-off and checked against the real result, published as recent_comparisons and site/history.json.' `
    @('model/model.py', 'model/run_daily.py', 'model/history.py', 'model/tests/test_pipeline.py', 'model/tests/test_history.py', 'docs/decisions.md')

Commit-Group 'feat(admin): add the predicted-vs-real-results web page' `
    'site/admin.html reads history.json and shows right winner, margin and exact score, honesty buckets, the bookmaker comparison and a match table with CSV export.' `
    @('site/admin.html')

Commit-Group 'chore(deps): update the lock file for Expo SDK 58' `
    'Regenerate package-lock.json to match package.json and add @types/node for the tests.' `
    @('package.json', 'package-lock.json')

Commit-Group 'feat(app): winner, margin and history data helpers' `
    'Types for margins and history, validation, plain-language confidence (Likely, Lean, Toss-up), day filters, history stats and their tests.' `
    @('src/data/types.ts', 'src/data/picksRepository.ts', 'src/data/store.ts', 'src/data/__tests__',
      'src/lib/winnerLabels.ts', 'src/lib/dateUtils.ts', 'src/lib/calculations.ts', 'src/lib/historyStats.ts',
      'src/lib/__tests__/winnerLabels.test.ts', 'src/lib/__tests__/historyStats.test.ts')

Commit-Group 'feat(app): redesigned shared components and readable colours' `
    'New header, confidence tag, segmented tabs and section cards; restyled chips, banners and crests; lighter muted text and red for contrast.' `
    @('src/components', 'src/theme/tokens.ts', 'src/features/picks/components/OutcomeSplitBar.tsx')

Commit-Group 'feat(app): redesign Matches, Predictions and Match detail' `
    'Day tabs, Match of the day card, scoreboard match cards, our chance next to bookmaker odds, and a match detail screen organised by plain questions.' `
    @('src/features/picks', 'src/features/__tests__/screens.test.tsx')

Commit-Group 'feat(app): redesign Results, Summary and Settings' `
    'Results shows real scores against our predictions; clearer bet cards, summary tiles and settings with helper text.' `
    @('src/features/betLog', 'src/features/summary')

Commit-Group 'feat(app): hidden admin screen with PIN' `
    'Tap the version in Settings 5 times to open a PIN-protected dashboard of predicted against real results.' `
    @('src/app/admin.tsx', 'src/app/_layout.tsx', 'src/features/admin', 'src/data/historyRepository.ts')

Write-Host ''
Write-Host 'Bringing in any new commits from GitHub, then pushing...'
$branch = (& git rev-parse --abbrev-ref HEAD).Trim()
Invoke-Git pull --rebase --autostash origin $branch
Invoke-Git push origin $branch
Write-Host "Pushed to origin/$branch." -ForegroundColor Green

Write-Host ''
Write-Host 'Still not committed (left alone on purpose):'
& git status --short
