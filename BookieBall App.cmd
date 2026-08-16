@echo off
setlocal enabledelayedexpansion

cd /d "%~dp0"

title BookieBall App

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\launch-bookieball.ps1"

if errorlevel 1 (
  echo.
  echo ========================================
  echo  BookieBall did not start cleanly.
  echo  Check the messages above for details.
  echo ========================================
  pause
) else (
  echo.
  echo BookieBall has stopped. You can close this window.
  timeout /t 3 /nobreak >nul
)
