$ErrorActionPreference = "Stop"
$SourceServer = "C:\Users\operador\Documents\SAAS\chamador de caixa pro versao 2.0\CHAMADOR DE CAIXA PRO\server"
$DestDir      = "C:\ChamadorCaixa"
$ServiceName  = "ChamadorCaixa"
$nodePath     = (Get-Command node).Source

Write-Host "===================================================="
Write-Host " DEPLOY - Chamador de Caixa PRO v2.0"
Write-Host "===================================================="

# 1. Para o serviço
Write-Host "`n[1/5] Parando servico '$ServiceName'..."
try { Stop-Service $ServiceName -Force -ErrorAction SilentlyContinue } catch {}
Start-Sleep -Seconds 2

# 2. Backup do svc-unified.mjs antigo
Write-Host "[2/5] Fazendo backup do servidor antigo..."
$backup = "$DestDir\svc-unified.mjs.bak_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
if (Test-Path "$DestDir\svc-unified.mjs") {
    Copy-Item "$DestDir\svc-unified.mjs" $backup
    Write-Host "     Backup: $backup"
}
if (Test-Path "$DestDir\index.js") {
    Copy-Item "$DestDir\index.js" "$DestDir\index.js.bak"
}

# 3. Copia os novos arquivos do servidor
Write-Host "[3/5] Copiando novo servidor para $DestDir ..."
# Copia os arquivos principais
Copy-Item "$SourceServer\index.js"    "$DestDir\index.js"    -Force
Copy-Item "$SourceServer\package.json" "$DestDir\package.json" -Force

# Copia routes/
if (!(Test-Path "$DestDir\routes"))   { New-Item -ItemType Directory "$DestDir\routes"   | Out-Null }
Copy-Item "$SourceServer\routes\*"   "$DestDir\routes\" -Recurse -Force

# Copia services/
if (!(Test-Path "$DestDir\services")) { New-Item -ItemType Directory "$DestDir\services" | Out-Null }
Copy-Item "$SourceServer\services\*" "$DestDir\services\" -Recurse -Force

# Copia public/ (painel admin)
if (!(Test-Path "$DestDir\public"))   { New-Item -ItemType Directory "$DestDir\public"   | Out-Null }
Copy-Item "$SourceServer\public\*"   "$DestDir\public\" -Recurse -Force

# Garante que data/ existe (nao sobrescreve dados existentes)
if (!(Test-Path "$DestDir\data"))     { New-Item -ItemType Directory "$DestDir\data"     | Out-Null }
if (!(Test-Path "$DestDir\data\uploads")) { New-Item -ItemType Directory "$DestDir\data\uploads" | Out-Null }

# Copia .env se nao existir (nao sobrescreve credenciais)
if (!(Test-Path "$DestDir\.env")) {
    Copy-Item "$SourceServer\.env" "$DestDir\.env" -Force
    Write-Host "     .env copiado"
} else {
    Write-Host "     .env existente mantido (nao sobrescrito)"
}

# 4. Instala dependencias no destino
Write-Host "[4/5] Instalando dependencias npm em $DestDir ..."
Push-Location $DestDir
npm install --omit=dev 2>&1 | Out-Host
Pop-Location

# 5. Atualiza servico NSSM para apontar para index.js
Write-Host "[5/5] Atualizando servico NSSM..."
$nssmExe = "$DestDir\nssm.exe"
$indexPath = "$DestDir\index.js"

& $nssmExe set $ServiceName Application "$nodePath"
& $nssmExe set $ServiceName AppParameters "`"$indexPath`""
& $nssmExe set $ServiceName AppDirectory "$DestDir"
& $nssmExe set $ServiceName Description "Chamador de Caixa PRO v2.0 - Servidor Unificado"
& $nssmExe set $ServiceName AppEnvironmentExtra "PORT=3001" "FOOTBALL_DATA_TOKEN=$env:FOOTBALL_DATA_TOKEN" "ADMIN_USER=admin" "ADMIN_PASSWORD=123456"

Write-Host "Iniciando servico '$ServiceName'..."
Start-Service $ServiceName
Start-Sleep -Seconds 3

$svc = Get-Service $ServiceName
Write-Host ""
Write-Host "=================================================="
Write-Host " Status final: $($svc.Status)"
Write-Host "=================================================="

if ($svc.Status -eq "Running") {
    Write-Host " DEPLOY CONCLUIDO COM SUCESSO!" -ForegroundColor Green
    Write-Host " Painel Admin:    http://localhost:3001/admin"
    Write-Host " API Status:      http://localhost:3001/api/status"
} else {
    Write-Host " SERVICO NAO INICIOU - verifique os logs do Event Viewer" -ForegroundColor Red
}
