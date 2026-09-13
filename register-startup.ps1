# Registers the InvestorLogs site to start automatically when Windows boots.
#
# Run this ONCE from an elevated (Administrator) PowerShell:
#     powershell -ExecutionPolicy Bypass -File .\register-startup.ps1
#
# To remove the startup task later:
#     Unregister-ScheduledTask -TaskName "InvestorLogsSite" -Confirm:$false

$ErrorActionPreference = "Stop"

$taskName = "InvestorLogsSite"
$projectDir = $PSScriptRoot
$startScript = Join-Path $projectDir "start-site.bat"

if (-not (Test-Path $startScript)) {
    throw "start-site.bat not found next to this script ($startScript)."
}

Write-Host "Registering startup task '$taskName'..."

$action = New-ScheduledTaskAction `
    -Execute $startScript `
    -WorkingDirectory $projectDir

# Run at boot, and also if the machine was already on when the task was created.
$trigger = New-ScheduledTaskTrigger -AtStartup

$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 1)

# Run as SYSTEM so no user has to be logged in for the site to serve.
$principal = New-ScheduledTaskPrincipal `
    -UserId "SYSTEM" `
    -LogonType ServiceAccount `
    -RunLevel Highest

Register-ScheduledTask `
    -TaskName $taskName `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Principal $principal `
    -Force | Out-Null

Write-Host "Done. The site will start automatically on boot." -ForegroundColor Green
Write-Host "Start it now with:  Start-ScheduledTask -TaskName $taskName"
