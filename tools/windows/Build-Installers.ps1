$ErrorActionPreference = "Stop"
$output = Join-Path $PSScriptRoot "dist"
New-Item -ItemType Directory -Force -Path $output | Out-Null
$erpZip = Join-Path $output "ERP-Hibrido-Offline-Windows.zip"
$printZip = Join-Path $output "ERP-Hibrido-Print-Manager-Windows.zip"
if (Test-Path -LiteralPath $erpZip) { Remove-Item -LiteralPath $erpZip -Force }
if (Test-Path -LiteralPath $printZip) { Remove-Item -LiteralPath $printZip -Force }
Compress-Archive -Path (Join-Path $PSScriptRoot "erp-offline\*") -DestinationPath $erpZip -CompressionLevel Optimal
Compress-Archive -Path (Join-Path $PSScriptRoot "print-manager\*") -DestinationPath $printZip -CompressionLevel Optimal
Write-Host "Instaladores gerados em $output" -ForegroundColor Green
