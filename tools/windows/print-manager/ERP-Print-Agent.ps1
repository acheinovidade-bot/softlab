$ErrorActionPreference = "Stop"
$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add("http://127.0.0.1:18181/")
$listener.Start()
function Write-JsonResponse($response, $status, $value) {
  $response.StatusCode = $status
  $response.Headers.Add("Access-Control-Allow-Origin", "*")
  $response.Headers.Add("Access-Control-Allow-Headers", "content-type")
  $response.Headers.Add("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
  $bytes = [Text.Encoding]::UTF8.GetBytes(($value | ConvertTo-Json -Depth 6 -Compress))
  $response.ContentType = "application/json; charset=utf-8"
  $response.ContentLength64 = $bytes.Length
  $response.OutputStream.Write($bytes, 0, $bytes.Length)
  $response.Close()
}
while ($listener.IsListening) {
  $context = $listener.GetContext()
  try {
    $request = $context.Request
    if ($request.HttpMethod -eq "OPTIONS") { Write-JsonResponse $context.Response 204 @{}; continue }
    if ($request.Url.AbsolutePath -eq "/health") { Write-JsonResponse $context.Response 200 @{ status = "ok" }; continue }
    if ($request.Url.AbsolutePath -eq "/printers") {
      $names = @(Get-CimInstance Win32_Printer | Sort-Object Name | Select-Object -ExpandProperty Name)
      Write-JsonResponse $context.Response 200 @{ printers = $names }; continue
    }
    if ($request.Url.AbsolutePath -eq "/print" -and $request.HttpMethod -eq "POST") {
      $reader = [IO.StreamReader]::new($request.InputStream, $request.ContentEncoding)
      $job = $reader.ReadToEnd() | ConvertFrom-Json
      $installed = @(Get-CimInstance Win32_Printer | Select-Object -ExpandProperty Name)
      if ($installed -notcontains [string]$job.printer) { Write-JsonResponse $context.Response 404 @{ error = "Impressora não encontrada" }; continue }
      $separator = "-" * 42
      $text = @([string]$job.title, "SETOR: $($job.sector)", $separator) + @($job.lines) + @($separator)
      ($text -join [Environment]::NewLine) | Out-Printer -Name ([string]$job.printer)
      Write-JsonResponse $context.Response 200 @{ printed = $true; printer = $job.printer }; continue
    }
    Write-JsonResponse $context.Response 404 @{ error = "Rota não encontrada" }
  } catch { Write-JsonResponse $context.Response 500 @{ error = $_.Exception.Message } }
}
