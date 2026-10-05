@echo off
title NHSO Token Agent Installer

echo ============================================================
echo   Installing NHSO SRM Token Sync Agent for Client PC
echo ============================================================
echo.

set TARGET_DIR=C:\NHSO-Agent
set STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup

if not exist "%TARGET_DIR%" (
    mkdir "%TARGET_DIR%"
)

echo [1/3] Copying Agent files to %TARGET_DIR%...
copy /Y "%~dp0nhso-agent.ps1" "%TARGET_DIR%\nhso-agent.ps1" >nul
copy /Y "%~dp0run-agent-silent.vbs" "%TARGET_DIR%\run-agent-silent.vbs" >nul

echo [2/3] Adding shortcut to Windows Startup folder...
copy /Y "%~dp0run-agent-silent.vbs" "%STARTUP_DIR%\NHSO-Token-Agent.vbs" >nul

echo [3/3] Starting Agent service in background...
start "" wscript.exe "%TARGET_DIR%\run-agent-silent.vbs"

echo.
echo ============================================================
echo   Installation Successful!
echo   NHSO Agent is now running in background.
echo   It will auto-start every time Windows starts.
echo ============================================================
echo.
pause
