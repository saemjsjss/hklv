@echo off
REM Fill EVERY student one after another, but do NOT submit (dry run).
REM Screenshots are saved to output\screenshots\ so you can review each one.
cd /d "%~dp0"
if not exist node_modules ( call npm install )
set HY_SUBMIT=false
call npm run fill
echo.
echo Done. Review output\screenshots\ and output\submissions.csv , then close this.
pause
