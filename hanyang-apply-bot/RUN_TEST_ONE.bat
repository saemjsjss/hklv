@echo off
REM Safe first check: fill ONLY the first student, do NOT submit. A Chrome
REM window opens so you can eyeball the result. Nothing is submitted.
cd /d "%~dp0"
if not exist node_modules ( call npm install )
set HY_SUBMIT=false
set HY_LIMIT=1
call npm run fill
echo.
echo Done. Check the Chrome window and output\screenshots\ , then close this.
pause
