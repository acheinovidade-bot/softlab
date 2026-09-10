#Requires -RunAsAdministrator
$ErrorActionPreference = "Stop"
$installRoot = Join-Path $env:ProgramData "ERP-Hibrido\PrintManager"
New-Item -ItemType Directory -Force -Path $installRoot | Out-Null
Copy-Item -LiteralPath (Join-Path $PSScriptRoot "ERP-Print-Agent.ps1") -Destination (Join-Path $installRoot "ERP-Print-Agent.ps1") -Force
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$installRoot\ERP-Print-Agent.ps1`""
$trigger = New-ScheduledTaskTrigger -AtLogOn
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Highest
Register-ScheduledTask -TaskName "ERP Híbrido - Gerenciador de Impressão" -Action $action -Trigger $trigger -Principal $principal -Force | Out-Null
Start-Process -FilePath "powershell.exe" -WindowStyle Hidden -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$installRoot\ERP-Print-Agent.ps1`""
Write-Host "Gerenciador instalado e iniciado em http://127.0.0.1:18181" -ForegroundColor Green
