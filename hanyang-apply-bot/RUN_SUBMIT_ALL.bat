@echo off
REM ============================================================
REM  REAL RUN: fills AND SUBMITS every student's application,
REM  one after another, until finished.
REM  Only use this after a dry run looked correct.
REM ============================================================
cd /d "%~dp0"
if not exist node_modules ( call npm install )
echo This will SUBMIT every application in the spreadsheet.
set /p ok="Type YES to continue: "
if /I not "%ok%"=="YES" ( echo Cancelled. & pause & exit /b )
set HY_SUBMIT=true
call npm run fill
echo.
echo Finished. Passwords + status are in output\submissions.csv
pause
