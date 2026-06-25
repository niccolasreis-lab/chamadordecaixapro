@echo off
chcp 65001 >nul
echo ========================================
echo   INSTALADOR - CHAMADOR DE CAIXA PRO
echo ========================================
echo.

REM Verificar se está rodando como administrador
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [ERRO] Este script precisa ser executado como Administrador.
    echo Clique com o botão direito e selecione "Executar como administrador"
    echo.
    pause
    exit /b 1
)

REM Definir pasta de destino
set "DESTINO=C:\Chamador-Caixa-Pro"
set "ORIGEM=%~dp0dist\win-unpacked"

echo [1/4] Verificando pasta de origem...
if not exist "%ORIGEM%\PDV Client.exe" (
    echo [ERRO] Pasta win-unpacked não encontrada ou incompleta.
    echo Certifique-se de que o build foi executado com sucesso.
    echo.
    pause
    exit /b 1
)
echo      OK - Arquivos de origem encontrados.

echo.
echo [2/4] Copiando arquivos para %DESTINO%...
if exist "%DESTINO%" (
    echo      Removendo instalação anterior...
    rmdir /s /q "%DESTINO%" 2>nul
)

mkdir "%DESTINO%" 2>nul
xcopy /E /I /Y /Q "%ORIGEM%" "%DESTINO%" >nul
if %errorLevel% neq 0 (
    echo [ERRO] Falha ao copiar arquivos.
    pause
    exit /b 1
)
echo      OK - Arquivos copiados com sucesso.

echo.
echo [3/4] Criando atalho na Inicialização do Windows...
set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "ATALHO=%STARTUP%\Chamador de Caixa Pro.lnk"

REM Garantir que a pasta Startup existe
if not exist "%STARTUP%" mkdir "%STARTUP%"

REM Criar atalho usando PowerShell
powershell -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%ATALHO%'); $s.TargetPath = '%DESTINO%\PDV Client.exe'; $s.WorkingDirectory = '%DESTINO%'; $s.Description = 'CHAMADOR DE CAIXA PRO - Cliente de PDV'; $s.Save()"

if exist "%ATALHO%" (
    echo      OK - Atalho de inicialização automática criado.
) else (
    echo [AVISO] Não foi possível criar o atalho de inicialização automaticamente.
)

echo.
echo [4/4] Criando atalho na Área de Trabalho...
set "DESKTOP=%USERPROFILE%\Desktop"
set "ATALHO_DESKTOP=%DESKTOP%\Chamador de Caixa Pro.lnk"

powershell -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%ATALHO_DESKTOP%'); $s.TargetPath = '%DESTINO%\PDV Client.exe'; $s.WorkingDirectory = '%DESTINO%'; $s.Description = 'CHAMADOR DE CAIXA PRO - Cliente de PDV'; $s.Save()"

if exist "%ATALHO_DESKTOP%" (
    echo      OK - Atalho criado na Área de Trabalho.
) else (
    echo [AVISO] Não foi possível criar o atalho na Área de Trabalho.
)

echo.
echo ========================================
echo   INSTALAÇÃO CONCLUÍDA COM SUCESSO!
echo ========================================
echo.
echo O software foi instalado em: %DESTINO%
echo.
echo O aplicativo iniciará automaticamente com o Windows.
echo Você também pode executá-lo pelo atalho na Área de Trabalho.
echo.
echo Pressione qualquer tecla para iniciar o Chamador de Caixa Pro agora...
pause >nul

start "" "%DESTINO%\PDV Client.exe"
