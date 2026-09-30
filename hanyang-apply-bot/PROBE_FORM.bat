@echo off
REM Opens the live agency form (no data, no submit) and saves it for tuning.
REM Produces: output\form.html , output\form.png , and a list of dropdown options
REM in this window. Send me output\form.html and I'll pin the exact field values.
cd /d "%~dp0"
if not exist node_modules ( call npm install )
set HY_SUBMIT=false
call npm run probe
echo.
echo Saved output\form.html and output\form.png . Send me output\form.html .
pause
