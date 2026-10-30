@echo off
rem Builds dist\HabitGrid.exe: one file, no console window.
setlocal
cd /d "%~dp0"

if not exist .venv\Scripts\python.exe (
    echo Creating virtual environment...
    py -3.12 -m venv .venv 2>nul || python -m venv .venv || goto :failed
)
.venv\Scripts\python -c "import sys; sys.exit(sys.version_info < (3, 11))" || (
    echo HabitGrid needs Python 3.11 or newer. Install Python 3.12 from python.org, delete .venv and run again.
    goto :failed
)

echo Installing requirements...
.venv\Scripts\python -m pip install --disable-pip-version-check -q -r requirements.txt || goto :failed

rem Google sign-in is included only when google_client.json (from Google Cloud) is here.
set "GOOGLE_DATA="
if exist google_client.json set GOOGLE_DATA=--add-data "google_client.json;."

echo Building...
.venv\Scripts\python -m PyInstaller --noconfirm --clean --log-level WARN ^
    --onefile --windowed --name HabitGrid ^
    --icon assets\icon.ico --add-data "web;web" %GOOGLE_DATA% ^
    --version-file version_info.txt --exclude-module tkinter ^
    main.py || goto :failed

rem The setup wizard needs Inno Setup 6 (free): https://jrsoftware.org/isdl.php
set "ISCC=%ProgramFiles(x86)%\Inno Setup 6\ISCC.exe"
if not exist "%ISCC%" set "ISCC=%LOCALAPPDATA%\Programs\Inno Setup 6\ISCC.exe"
if exist "%ISCC%" (
    echo Building the setup wizard...
    "%ISCC%" /Q installer.iss || goto :failed
) else (
    echo Inno Setup 6 isn't installed, so dist\HabitGrid-Setup.exe was skipped.
)

echo.
echo Done: dist\HabitGrid.exe
if exist dist\HabitGrid-Setup.exe echo       dist\HabitGrid-Setup.exe
exit /b 0

:failed
echo.
echo Build failed.
exit /b 1
