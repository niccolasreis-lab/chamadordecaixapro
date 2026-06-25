@echo off
chcp 65001 >nul
echo ========================================
echo   CRIAR ATALHO NA INICIALIZAÇÃO
echo ========================================
echo.

REM Este script NÃO precisa de admin - roda como usuário normal
set "DESTINO=C:\PDV-Client"
set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "ATALHO=%STARTUP%\PDV Client.lnk"

echo Verificando se o PDV Client está instalado...
if not exist "%DESTINO%\PDV Client.exe" (
    echo [ERRO] PDV Client não encontrado em %DESTINO%
    echo Execute primeiro o INSTALAR-PDV-CLIENT.bat
    pause
    exit /b 1
)

echo Criando pasta Startup se não existir...
if not exist "%STARTUP%" mkdir "%STARTUP%"

echo Criando atalho na Inicialização...
powershell -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%ATALHO%'); $s.TargetPath = '%DESTINO%\PDV Client.exe'; $s.WorkingDirectory = '%DESTINO%'; $s.Description = 'Cliente PDV - Chamador de Caixa Livre'; $s.Save()"

if exist "%ATALHO%" (
    echo.
    echo ========================================
    echo   ATALHO CRIADO COM SUCESSO!
    echo ========================================
    echo.
    echo O PDV Client agora inicia automaticamente com o Windows.
    echo Localização: %ATALHO%
) else (
    echo.
    echo [ERRO] Não foi possível criar o atalho.
)

echo.
pause
