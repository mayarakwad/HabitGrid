#!/bin/bash
# Builds dist/HabitGrid.app and dist/HabitGrid-mac.zip. Run on a Mac:
#   bash build_mac.sh
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -x .venv/bin/python ]; then
    # Apple's own python3 is 3.9, too old for the pinned requirements.
    py="${PYTHON:-$(command -v python3.12 || command -v python3 || true)}"
    if [ -z "$py" ] || ! "$py" -c 'import sys; sys.exit(sys.version_info < (3, 11))'; then
        echo "HabitGrid needs Python 3.11 or newer (found: ${py:-none}). Install Python 3.12 from python.org, or set PYTHON=/path/to/python3.12."
        exit 1
    fi
    echo "Creating virtual environment..."
    "$py" -m venv .venv
fi

echo "Installing requirements..."
.venv/bin/python -m pip install --disable-pip-version-check -q -r requirements.txt

echo "Building..."
# PyInstaller turns the PNG into the app's .icns icon (that needs Pillow, from requirements.txt).
.venv/bin/python -m PyInstaller --noconfirm --clean --log-level WARN \
    --windowed --name HabitGrid --osx-bundle-identifier com.habitgrid.app \
    --icon assets/icon.png --add-data "web:web" --exclude-module tkinter \
    main.py

rm -f dist/HabitGrid-mac.zip
ditto -c -k --keepParent dist/HabitGrid.app dist/HabitGrid-mac.zip  # keeps the app's symlinks and permissions

echo
echo "Done: dist/HabitGrid.app (to share: dist/HabitGrid-mac.zip)"
