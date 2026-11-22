# Commits the 2026-11-22 changes (team names, upload step, accuracy) one group at a time, then pushes.
# Run from the project folder:
#   powershell -ExecutionPolicy Bypass -File scripts\commit_accuracy_changes.ps1
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

Commit-Group 'fix(model): match more team names and read .env before settings' `
    'Add football-data.org and The Odds API spellings for every club in the current E0, SP1, I1 and D1 seasons, so their fixtures are no longer skipped (14 -> 33 predictions). Load .env at import time so ALLOW_FOOTBALL_DATA_DOWNLOADS works in the scheduled task, not only when set in the shell.' `
    @('model/config.py')

Commit-Group 'feat(model): anchor predictions to pre-match odds and keep picks.json under 50 KB' `
    'Keep the model''s expected goal total but split it between the teams so the home-minus-away chance matches the pre-match bookmaker odds. Backtest on 4,213 matches: log loss 0.9809 -> 0.9662 (closing book 0.9642), winner right 52.8% -> 54.2%, better in all four leagues. Matches without odds stay model-only. The backtest anchors to pre-match (never closing) prices via new OddsPre columns. When picks.json would pass 50 KB, trim recent comparisons to 10 and leave out the latest non-featured matches; every prediction is still saved to the dataset.' `
    @('model/model.py', 'model/data.py', 'model/backtest.py', 'model/run_daily.py', 'model/tests/test_pipeline.py')

Commit-Group 'docs: log the first accuracy experiments' `
    'Record the tune/holdout split, the rejected settings tuning and odds blends, and the adopted odds anchor with per-league results.' `
    @('docs/experiments.md')

Commit-Group 'feat(scripts): publish daily picks to GitHub from the scheduled task' `
    'daily_run.ps1 runs the model, then commits only the generated site/*.json, public/picks.json and dataset/ files and pushes them, so every user''s app can read raw.githubusercontent.com. The scheduled task now runs it and catches up after the computer was off. Logs go to logs/, which is ignored.' `
    @('scripts/daily_run.ps1', 'scripts/register_daily_task.ps1', '.gitignore')

Commit-Group 'feat(scripts): add a standard-library history downloader' `
    'Downloads the football-data.co.uk season CSVs without pandas or numpy, for machines where those cannot load. Skips finished seasons already on disk.' `
    @('scripts/download_history.py')

Commit-Group 'feat(scripts): serve picks on the local network for testing' `
    'Small file server with CORS so the app on a phone or in the browser can read picks.json from this computer during development.' `
    @('scripts/serve_picks.py', 'scripts/commit_accuracy_changes.ps1')

Write-Host ''
Write-Host 'Pulling, then pushing...'
Invoke-Git pull --rebase --autostash origin master
Invoke-Git push origin HEAD:master
Write-Host ''
Write-Host 'Done. Files still changed but not committed (if any):'
& git status --short
