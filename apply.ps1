# apply.ps1 - apply any AfriPoll update zip into the project, commit, push.
# Usage:
#   .\apply.ps1 -Zip "$env:USERPROFILE\Downloads\afripoll-phase2-modulehome.zip" -Message "Phase 2: Module Home"
param(
  [Parameter(Mandatory=$true)][string]$Zip,
  [string]$Message = "AfriPoll update",
  [switch]$NoPush
)
$ErrorActionPreference = "Stop"
$Project = $PSScriptRoot
if (-not (Test-Path $Zip)) { throw "Zip not found: $Zip" }

$tmp = Join-Path $env:TEMP ("afripoll_" + [Guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $tmp | Out-Null
Write-Host "Extracting..."
Expand-Archive -Path $Zip -DestinationPath $tmp -Force

# find the folder that contains 'src'
$root = Get-ChildItem -Path $tmp -Recurse -Directory | Where-Object { Test-Path (Join-Path $_.FullName "src") } | Select-Object -First 1
if (-not $root) { if (Test-Path (Join-Path $tmp "src")) { $root = Get-Item $tmp } }
if (-not $root) { throw "No 'src' folder found inside the zip." }

Write-Host ("Copying from " + $root.FullName)
Copy-Item -Path (Join-Path $root.FullName "src") -Destination $Project -Recurse -Force
if (Test-Path (Join-Path $root.FullName "public")) {
  Copy-Item -Path (Join-Path $root.FullName "public") -Destination $Project -Recurse -Force
}
Remove-Item -Path $tmp -Recurse -Force

Set-Location $Project
git add .
git commit -m $Message
if (-not $NoPush) { git push; Write-Host "Pushed. Vercel will redeploy." -ForegroundColor Green }
else { Write-Host "Committed. Skipped push." -ForegroundColor Yellow }
