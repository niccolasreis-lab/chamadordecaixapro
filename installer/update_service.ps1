$DestDir   = "C:\ChamadorCaixa"
$ServiceName = "ChamadorCaixa"
$nodePath  = (Get-Command node).Source
$indexPath = "$DestDir\index.js"
$nssmExe   = "$DestDir\nssm.exe"

Write-Host "Parando servico..."
Stop-Service $ServiceName -Force -ErrorAction SilentlyContinue
Start-Sleep 2

Write-Host "Atualizando configuracao NSSM..."
& $nssmExe set $ServiceName Application $nodePath
& $nssmExe set $ServiceName AppParameters $indexPath
& $nssmExe set $ServiceName AppDirectory  $DestDir
& $nssmExe set $ServiceName AppEnvironmentExtra "PORT=3001"

Write-Host "Iniciando servico..."
Start-Service $ServiceName
Start-Sleep 3

$svc = Get-Service $ServiceName
Write-Host "Status: $($svc.Status)"
Write-Host "Application: $($( & $nssmExe get $ServiceName Application))"
Write-Host "AppParameters: $($( & $nssmExe get $ServiceName AppParameters))"
