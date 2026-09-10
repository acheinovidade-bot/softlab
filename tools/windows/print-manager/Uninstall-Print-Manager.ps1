#Requires -RunAsAdministrator
$installRoot = Join-Path $env:ProgramData "ERP-Hibrido\PrintManager"
Unregister-ScheduledTask -TaskName "ERP Híbrido - Gerenciador de Impressão" -Confirm:$false -ErrorAction SilentlyContinue
Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like "*ERP-Print-Agent.ps1*" } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
if (Test-Path -LiteralPath $installRoot) { Remove-Item -LiteralPath $installRoot -Recurse -Force }
Write-Host "Gerenciador de impressão removido." -ForegroundColor Green
