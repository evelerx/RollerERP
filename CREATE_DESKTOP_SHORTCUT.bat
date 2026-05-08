@echo off
title Creating Desktop Shortcut...
echo.
echo  Creating Roller ERP desktop shortcut...
echo.

:: Get the current folder path
set "FOLDER=%~dp0"
set "BAT_PATH=%FOLDER%START_ERP.bat"
set "SHORTCUT_PATH=%USERPROFILE%\Desktop\Roller ERP.lnk"
set "ICON_PATH=%SystemRoot%\System32\shell32.dll"

:: Create shortcut using PowerShell
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ws = New-Object -ComObject WScript.Shell; ^
   $s = $ws.CreateShortcut('%SHORTCUT_PATH%'); ^
   $s.TargetPath = '%BAT_PATH%'; ^
   $s.WorkingDirectory = '%FOLDER%'; ^
   $s.Description = 'Roller ERP Manufacturing System'; ^
   $s.IconLocation = '%ICON_PATH%, 71'; ^
   $s.Save()"

IF %ERRORLEVEL% EQU 0 (
    echo  [SUCCESS] Desktop shortcut created!
    echo.
    echo  You can now double-click "Roller ERP" on your desktop
    echo  to launch the app anytime.
    echo.
) ELSE (
    echo  [ERROR] Could not create shortcut automatically.
    echo.
    echo  Manual steps:
    echo  1. Right-click START_ERP.bat
    echo  2. Click "Send to" then "Desktop (create shortcut)"
    echo.
)

pause
