param(
  [int]$RestartDelaySeconds = 2
)

$ErrorActionPreference = "Stop"
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$serverScript = Join-Path $scriptRoot "..\src\server.js"
$serverScript = [System.IO.Path]::GetFullPath($serverScript)

if (-not (Test-Path $serverScript)) {
  throw "Fichier introuvable: $serverScript"
}

Write-Host "Demarrage supervise de Kinshima (web + API)..."
Write-Host "Script: $serverScript"

while ($true) {
  Write-Host "Lancement Node..."
  & node $serverScript
  $exitCode = $LASTEXITCODE

  if ($exitCode -eq 0) {
    Write-Host "Serveur arrete normalement (code 0)."
    break
  }

  Write-Warning "Serveur stoppe (code $exitCode). Redemarrage dans $RestartDelaySeconds sec..."
  Start-Sleep -Seconds $RestartDelaySeconds
}
