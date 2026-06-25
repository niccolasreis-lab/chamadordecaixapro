$ErrorActionPreference = "Stop"
Write-Host "Instalando Chamador de Caixa Pro - Servidor..."

# Baixa e extrai NSSM
Write-Host "Baixando NSSM..."
Invoke-WebRequest -Uri "https://nssm.cc/release/nssm-2.24.zip" -OutFile "$env:TEMP\nssm.zip"
Expand-Archive -Path "$env:TEMP\nssm.zip" -DestinationPath "$env:TEMP\nssm" -Force
Copy-Item "$env:TEMP\nssm\nssm-2.24\win64\nssm.exe" -Destination ".\nssm.exe"

# Verifica Node.js
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCommand) {
  Write-Host "Node.js não encontrado. Instale o Node.js primeiro."
  exit 1
}
$nodePath = $nodeCommand.Source

$serverPath = Resolve-Path "..\server\index.js"
$serverDir = Resolve-Path "..\server"

# Instala npm modules
Write-Host "Instalando dependências do servidor..."
Set-Location $serverDir
npm install
Set-Location ..\installer

# Configura Serviço
Write-Host "Instalando Serviço..."
.\nssm.exe stop ChamadorCaixaPro
.\nssm.exe remove ChamadorCaixaPro confirm
.\nssm.exe install ChamadorCaixaPro "$nodePath" "`"$serverPath`""
.\nssm.exe set ChamadorCaixaPro AppDirectory "$serverDir"
.\nssm.exe set ChamadorCaixaPro Description "Servidor - Chamador de Caixa Pro"
.\nssm.exe start ChamadorCaixaPro

Write-Host "Liberando porta 3001 no firewall..."
New-NetFirewallRule -DisplayName "Chamador de Caixa Pro - Porta 3001" -Direction Inbound -LocalPort 3001 -Protocol TCP -Action Allow -ErrorAction SilentlyContinue

Write-Host "Instalação concluída com sucesso!"
