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

echo Building...
.venv\Scripts\python -m PyInstaller --noconfirm --clean --log-level WARN ^
    --onefile --windowed --name HabitGrid ^
    --icon assets\icon.ico --add-data "web;web" ^
    --version-file version_info.txt --exclude-module tkinter ^
    main.py || goto :failed

echo.
echo Done: dist\HabitGrid.exe
exit /b 0

:failed
echo.
echo Build failed.
exit /b 1
