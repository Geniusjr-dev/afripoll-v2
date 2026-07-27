# apply-update.ps1
# Moves the extracted afripoll-brand-update files into the afripoll-clean project,
# then commits and pushes so Vercel redeploys. Run from the project root.
param(
  [string]$Source = "$env:USERPROFILE\Downloads\afripoll-brand-update",
  [switch]$NoPush
)

$ErrorActionPreference = "Stop"
$Project = $PSScriptRoot   # this script sits in the project root (afripoll-clean)

Write-Host "Project : $Project"
Write-Host "Source  : $Source"

if (-not (Test-Path $Source)) {
  # maybe the user unzipped so it nested as afripoll-brand-update\afripoll-brand-update
  $nested = Join-Path $Source "afripoll-brand-update"
  if (Test-Path $nested) { $Source = $nested }
  else { throw "Cannot find extracted folder at $Source. Unzip afripoll-brand-update.zip into your Downloads first." }
}

# Copy src and public over the project, overwriting
foreach ($dir in @("src","public")) {
  $from = Join-Path $Source $dir
  if (Test-Path $from) {
    Write-Host "Copying $dir ..."
    Copy-Item -Path $from -Destination $Project -Recurse -Force
  }
}

Write-Host "Files copied." -ForegroundColor Green

# Commit and push
Set-Location $Project
git add .
git commit -m "Add AfriPoll logo, motto Data. Insight. Impact., correct brand name"
if (-not $NoPush) {
  git push
  Write-Host "Pushed. Vercel will redeploy in about a minute." -ForegroundColor Green
} else {
  Write-Host "Committed. Skipped push (-NoPush)." -ForegroundColor Yellow
}
