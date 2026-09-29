@echo off
REM ---------------------------------------------------------------------------
REM  Project Management wireframe - local preview server
REM
REM  The prototype opens fine by double-clicking index.html. This script is for
REM  when you'd rather preview over http (some browsers are stricter about
REM  local files, and http matches how the real application will be served).
REM
REM  Usage: double-click this file, then open http://127.0.0.1:5173
REM  Stop:  press Ctrl+C in the window, or just close it.
REM ---------------------------------------------------------------------------

cd /d "%~dp0"

echo.
echo   Project Management - wireframe preview
echo   ---------------------------------------
echo   Open:  http://127.0.0.1:5173
echo   Stop:  Ctrl+C
echo.

where py >nul 2>nul && (
  py -m http.server 5173 --bind 127.0.0.1
  goto :eof
)

where python >nul 2>nul && (
  python -m http.server 5173 --bind 127.0.0.1
  goto :eof
)

where npx >nul 2>nul && (
  npx --yes serve -l 5173 .
  goto :eof
)

echo   Could not find Python or Node on this machine.
echo   You can still open index.html directly in your browser.
echo.
pause
