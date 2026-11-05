@echo off
setlocal
title Roller ERP

cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo Node.js is required to start Roller ERP.
  echo Install the current LTS version from https://nodejs.org and try again.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo Preparing Roller ERP for first use...
  call npm install
  if errorlevel 1 (
    echo.
    echo Setup failed. Check your internet connection and try again.
    pause
    exit /b 1
  )
)

echo Starting Roller ERP...
echo Keep this window open while you use the app.
echo.
call npm run dev:full

endlocal
