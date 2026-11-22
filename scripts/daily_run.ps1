#  Daily job: make predictions, then publish them to GitHub so every user's app
#  can download them from:
#    https://raw.githubusercontent.com/VincentMugondora/football-predictor/master/site/picks.json
#
#  Run by the Windows scheduled task (see register_daily_task.ps1). You can also run it by hand:
#    powershell -ExecutionPolicy Bypass -File scripts\daily_run.ps1
#
#  Only the generated files are committed (site\*.json, public\picks.json, dataset\).
#  The raw football-data.co.uk CSVs are never uploaded (their terms forbid redistribution),
#  and .env is never touched. Everything is logged to logs\daily_run.log.

$ErrorActionPreference = "Continue"
$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

$Branch = "master"
$LogDir = Join-Path $RepoRoot "logs"
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
$LogFile = Join-Path $LogDir "daily_run.log"

function Write-Log([string]$Message) {
    $line = "{0}  {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Message
    Add-Content -Path $LogFile -Value $line
    Write-Host $line
}

function Invoke-Logged([string]$Exe, [string[]]$Arguments) {
    & $Exe @Arguments 2>&1 | ForEach-Object { Write-Log ("    " + $_) }
    return $LASTEXITCODE
}

# Keep the log from growing forever: keep the last ~2000 lines.
if ((Test-Path $LogFile) -and ((Get-Item $LogFile).Length -gt 500KB)) {
    $tail = Get-Content $LogFile -Tail 2000
    Set-Content -Path $LogFile -Value $tail
}

Write-Log "=== Daily run started"

# 1. Make predictions
$Python = Join-Path $RepoRoot ".venv\Scripts\python.exe"
if (-not (Test-Path $Python)) {
    Write-Log "ERROR: $Python not found. Recreate the venv with Python 3.13."
    exit 1
}
$code = Invoke-Logged $Python @("-m", "model.run_daily")
if ($code -ne 0) {
    Write-Log "ERROR: model.run_daily failed (exit $code). Nothing published; the previous picks stay online."
    exit 1
}

# 2. Publish to GitHub
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Log "ERROR: git is not on PATH, so nothing was published."
    exit 1
}

$paths = @()
$paths += Get-ChildItem -Path "site" -Filter "*.json" -File -ErrorAction SilentlyContinue |
    ForEach-Object { "site/" + $_.Name }
if (Test-Path "public/picks.json") { $paths += "public/picks.json" }
if (Test-Path "dataset") { $paths += "dataset" }

[void](Invoke-Logged "git" (@("add", "--") + $paths))
& git diff --cached --quiet -- @paths
if ($LASTEXITCODE -eq 0) {
    Write-Log "No changes to publish."
    exit 0
}

$stamp = Get-Date -Format "yyyy-MM-dd HH:mm"
# "git commit -- <paths>" commits only these files, even if other work is staged.
$code = Invoke-Logged "git" (@("commit", "-m", "Daily predictions $stamp", "--") + $paths)
if ($code -ne 0) {
    Write-Log "ERROR: git commit failed (exit $code)."
    exit 1
}

# -X theirs: if GitHub has an older generated file, keep the one this run just made.
$code = Invoke-Logged "git" @("pull", "--rebase", "--autostash", "-X", "theirs", "origin", $Branch)
if ($code -ne 0) {
    Write-Log "ERROR: git pull failed (exit $code). Aborting the rebase; the commit stays local and is pushed next run."
    [void](Invoke-Logged "git" @("rebase", "--abort"))
    exit 1
}

$code = Invoke-Logged "git" @("push", "origin", "HEAD:$Branch")
if ($code -ne 0) {
    Write-Log "ERROR: git push failed (exit $code). Check that this computer can push without a password prompt."
    exit 1
}

Write-Log "Published. Users will see the new picks within about 5 minutes (GitHub caches raw files briefly)."
exit 0
