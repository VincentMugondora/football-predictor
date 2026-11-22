# Commits the odds-freshness and sharp-bookmaker changes one group at a time, then pushes.
#   powershell -ExecutionPolicy Bypass -File scripts\commit_odds_changes.ps1
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)
$trailer = "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`nClaude-Session: https://claude.ai/code/session_01FZFNo5ZygXikgHjDBp9HTf"
function Invoke-Git { & git @args; if ($LASTEXITCODE -ne 0) { throw "git $($args -join ' ') failed" } }
function Commit-Group([string]$title, [string]$body, [string[]]$paths) {
    $existing = @($paths | Where-Object { Test-Path $_ })
    if ($existing.Count -eq 0) { Write-Host "skip: $title"; return }
    Invoke-Git add -A -- @existing
    & git diff --cached --quiet -- @existing
    if ($LASTEXITCODE -eq 0) { Write-Host "skip: $title (nothing changed)"; return }
    Invoke-Git commit -m $title -m $body -m $trailer -- @existing
    Write-Host "committed: $title" -ForegroundColor Green
}
& git diff --cached --quiet
if ($LASTEXITCODE -ne 0) { throw 'Some files are already staged. Run "git reset" first.' }

Commit-Group 'feat(odds): use sharp-bookmaker consensus and refresh odds before kick-off' `
    'Average the margin-free prices of Pinnacle, Betfair Exchange, Smarkets and Matchbook (median of all books if none), instead of the first-listed book. Re-fetch a league''s odds when a match is within 24 hours and saved prices are over 3 hours old (ODDS_REFRESH_HOURS); keep older prices if credits run low or the request fails.' `
    @('model/providers/the_odds_api.py', 'model/config.py', 'model/tests/test_pipeline.py')

Commit-Group 'feat(scripts): run the daily job four times a day' `
    'Add 12:30 and 16:30 runs so afternoon and evening matches use prices with team news.' `
    @('scripts/register_daily_task.ps1', 'scripts/commit_odds_changes.ps1')

Commit-Group 'docs: log the bookmaker comparison and odds-timing results' `
    'Betfair Exchange and Pinnacle beat high-street books; closing-price gain is uncertain; line-ups not added.' `
    @('docs/experiments.md')

Invoke-Git pull --rebase --autostash origin master
Invoke-Git push origin HEAD:master
Write-Host 'Done.'
& git status --short
