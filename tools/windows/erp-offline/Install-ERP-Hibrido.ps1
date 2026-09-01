param([string]$Url = "http://127.0.0.1:5174/?demo=pos")
$ErrorActionPreference = "Stop"
$edgeCandidates = @(
  "$env:ProgramFiles(x86)\Microsoft\Edge\Application\msedge.exe",
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe"
)
$edge = $edgeCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $edge) { throw "Microsoft Edge não encontrado. Instale o Edge antes de continuar." }
$shell = New-Object -ComObject WScript.Shell
$desktop = [Environment]::GetFolderPath("Desktop")
$startMenu = Join-Path ([Environment]::GetFolderPath("Programs")) "ERP Híbrido"
New-Item -ItemType Directory -Force -Path $startMenu | Out-Null
foreach ($shortcutPath in @((Join-Path $desktop "ERP Híbrido Offline.lnk"), (Join-Path $startMenu "ERP Híbrido Offline.lnk"))) {
  $shortcut = $shell.CreateShortcut($shortcutPath)
  $shortcut.TargetPath = $edge
  $shortcut.Arguments = "--app=`"$Url`" --start-maximized"
  $shortcut.Description = "ERP Híbrido com operação offline"
  $shortcut.WorkingDirectory = Split-Path -Parent $edge
  $shortcut.Save()
}
Start-Process -FilePath $edge -ArgumentList "--app=`"$Url`" --start-maximized"
Write-Host "ERP Híbrido instalado. Aguarde a primeira abertura concluir para preparar o cache offline." -ForegroundColor Green
