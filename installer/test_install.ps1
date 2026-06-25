$nodePath = (Get-Command node).Source
$serverPath = Resolve-Path "..\server\index.js"
$serverDir = Resolve-Path "..\server"

Remove-Item -Path .\out.log -ErrorAction SilentlyContinue

& ".\nssm.exe" stop ChamadorCaixaPro 2>&1 | Out-File -Append out.log
& ".\nssm.exe" remove ChamadorCaixaPro confirm 2>&1 | Out-File -Append out.log
& ".\nssm.exe" install ChamadorCaixaPro "$nodePath" "`"$serverPath`"" 2>&1 | Out-File -Append out.log
& ".\nssm.exe" set ChamadorCaixaPro AppDirectory "$serverDir" 2>&1 | Out-File -Append out.log
& ".\nssm.exe" set ChamadorCaixaPro Description "Servidor - Chamador de Caixa Pro" 2>&1 | Out-File -Append out.log
& ".\nssm.exe" start ChamadorCaixaPro 2>&1 | Out-File -Append out.log
