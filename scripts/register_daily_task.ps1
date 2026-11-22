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

# 08:00 morning predictions; 12:30 and 16:30 refresh odds before afternoon and evening
# kick-offs (team news is in the prices by then); 23:30 adds the day's results.
# Odds are only re-fetched for leagues with a match in the next 24 hours (ODDS_REFRESH_HOURS).
$Triggers = @(
    (New-ScheduledTaskTrigger -Daily -At "08:00AM"),
    (New-ScheduledTaskTrigger -Daily -At "12:30PM"),
    (New-ScheduledTaskTrigger -Daily -At "04:30PM"),
    (New-ScheduledTaskTrigger -Daily -At "11:30PM")
)

# If the computer was off or asleep at a run time, run as soon as it is back on.
$Settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -ExecutionTimeLimit (New-TimeSpan -Hours 1)

Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $Action `
    -Trigger $Triggers `
    -Settings $Settings `
    -Description "Makes pre-match predictions and records results, then publishes site/picks.json to GitHub for the app." `
    -Force

Write-Host "Registered Windows Scheduled Task '$TaskName' (runs daily at 08:00, 12:30, 16:30 and 23:30, and catches up after the computer was off)."
Write-Host "Log file: $(Join-Path $RepoRoot 'logs\daily_run.log')"
