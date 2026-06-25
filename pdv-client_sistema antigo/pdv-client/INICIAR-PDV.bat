@echo off
chcp 65001 >nul

REM Verificar se está rodando como administrador
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [INFO] Solicitando privilégios de Administrador...
    powershell -Command "Start-Process -FilePath '%0' -Verb RunAs"
    exit /b
)

cd /d "%~dp0"
node_modules\.bin\electron.cmd .