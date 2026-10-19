$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
$PythonExe = Join-Path $RepoRoot ".venv\Scripts\python.exe"
$TaskName = "MatchSense-Daily-Football-Predictor"

if (-not (Test-Path $PythonExe)) {
    Write-Error "Python virtual environment not found at $PythonExe. Run 'python -m venv .venv' and '.venv\Scripts\pip install -r model\requirements.txt' first."
}

$Action = New-ScheduledTaskAction `
    -Execute $PythonExe `
    -Argument "-m model.run_daily" `
    -WorkingDirectory $RepoRoot

# Run twice daily: 08:00 AM (pre-match predictions) and 11:30 PM (post-match results reconciliation)
$TriggerMorning = New-ScheduledTaskTrigger -Daily -At "08:00AM"
$TriggerEvening = New-ScheduledTaskTrigger -Daily -At "11:30PM"

Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $Action `
    -Trigger @($TriggerMorning, $TriggerEvening) `
    -Description "Downloads latest football-data.co.uk fixtures and results, updates pre-match predictions, and compares actual full-time scores against predicted outcomes." `
    -Force

Write-Host "Registered Windows Scheduled Task '$TaskName' (runs daily at 08:00 AM and 11:30 PM)."
