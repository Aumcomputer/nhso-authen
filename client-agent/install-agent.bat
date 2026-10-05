@echo off
chcp 65001 >nul
title NHSO Token Agent Installer

echo ============================================================
echo   ติดตั้ง NHSO SRM Token Sync Agent สำหรับเครื่องเจ้าหน้าที่
echo ============================================================
echo.

set "TARGET_DIR=C:\NHSO-Agent"
set "STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"

if not exist "%TARGET_DIR%" (
    mkdir "%TARGET_DIR%"
)

echo [1/3] กำลังคัดลอกไฟล์ Agent ไปที่ %TARGET_DIR%...
copy /Y "%~dp0nhso-agent.ps1" "%TARGET_DIR%\nhso-agent.ps1" >nul
copy /Y "%~dp0run-agent-silent.vbs" "%TARGET_DIR%\run-agent-silent.vbs" >nul

echo [2/3] กำลังสร้าง Shortcut ในโฟลเดอร์ Startup เพื่อให้รันอัตโนมัติเมื่อเปิดเครื่อง...
copy /Y "%~dp0run-agent-silent.vbs" "%STARTUP_DIR%\NHSO-Token-Agent.vbs" >nul

echo [3/3] สั่งให้ Agent เริ่มทำงานทันทีใน Background...
wscript.exe "%STARTUP_DIR%\NHSO-Token-Agent.vbs"

echo.
echo ============================================================
echo   ✅ ติดตั้งเรียบร้อยแล้ว! 
echo   Agent จะทำงานเงียบๆ ในเบื้องหลังอัตโนมัติทุกครั้งที่เปิดเครื่อง
echo ============================================================
echo.
pause
