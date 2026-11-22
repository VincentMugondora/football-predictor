$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
$PythonExe = Join-Path $RepoRoot ".venv\Scripts\python.exe"
$DailyScript = Join-Path $PSScriptRoot "daily_run.ps1"
$TaskName = "MatchSense-Daily-Football-Predictor"

if (-not (Test-Path $PythonExe)) {
    Write-Error "Python virtual environment not found at $PythonExe. Run 'py -3.13 -m venv .venv' and '.venv\Scripts\pip install -r requirements.txt' first."
}

# Runs the model, then commits and pushes the generated picks to GitHub (see daily_run.ps1).
$Action = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$DailyScript`"" `
    -WorkingDirectory $RepoRoot

# Run twice daily: 08:00 AM (pre-match predictions) and 11:30 PM (refresh with the day's results)
$TriggerMorning = New-ScheduledTaskTrigger -Daily -At "08:00AM"
$TriggerEvening = New-ScheduledTaskTrigger -Daily -At "11:30PM"

# If the computer was off or asleep at a run time, run as soon as it is back on.
$Settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -ExecutionTimeLimit (New-TimeSpan -Hours 1)

Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $Action `
    -Trigger @($TriggerMorning, $TriggerEvening) `
    -Settings $Settings `
    -Description "Makes pre-match predictions and records results, then publishes site/picks.json to GitHub for the app." `
    -Force

Write-Host "Registered Windows Scheduled Task '$TaskName' (runs daily at 08:00 AM and 11:30 PM, and catches up after the computer was off)."
Write-Host "Log file: $(Join-Path $RepoRoot 'logs\daily_run.log')"
