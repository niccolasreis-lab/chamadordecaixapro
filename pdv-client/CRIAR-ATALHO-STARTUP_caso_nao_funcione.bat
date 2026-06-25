@echo off
chcp 65001 >nul
echo ========================================
echo   REGISTRO DE INICIALIZAÇÃO AUTOMÁTICA
echo ========================================
echo.

REM Este script não precisa de administrador
set "DESTINO=C:\Chamador-Caixa-Pro"
set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "ATALHO=%STARTUP%\Chamador de Caixa Pro.lnk"

echo Verificando se o Chamador de Caixa Pro está instalado...
if not exist "%DESTINO%\PDV Client.exe" (
    echo [ERRO] Software não encontrado em %DESTINO%
    echo Execute primeiro o script INSTALAR-PDV-CLIENT...
    echo.
    pause
    exit /b 1
)

echo Criando pasta Startup se não existir...
if not exist "%STARTUP%" mkdir "%STARTUP%"

echo Criando atalho na inicialização rápida...
powershell -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%ATALHO%'); $s.TargetPath = '%DESTINO%\PDV Client.exe'; $s.WorkingDirectory = '%DESTINO%'; $s.Description = 'CHAMADOR DE CAIXA PRO - Cliente de PDV'; $s.Save()"

if exist "%ATALHO%" (
    echo.
    echo ========================================
    echo   ATALHO CRIADO COM SUCESSO!
    echo ========================================
    echo.
    echo O Chamador de Caixa Pro iniciará automaticamente com o Windows.
    echo Localização do atalho: %ATALHO%
) else (
    echo.
    echo [ERRO] Não foi possível criar o atalho.
)

echo.
pause
