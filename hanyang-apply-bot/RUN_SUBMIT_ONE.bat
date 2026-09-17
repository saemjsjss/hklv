@echo off
REM Submit ONE application (the first student not already submitted). Use this
REM for a safe first real submission before running the whole batch.
cd /d "%~dp0"
if not exist node_modules ( call npm install )
echo This will SUBMIT ONE student's application to the portal.
set /p ok="Type YES to continue: "
if /I not "%ok%"=="YES" ( echo Cancelled. & pause & exit /b )
set HY_SUBMIT=true
set HY_LIMIT=1
call npm run fill
echo.
echo Done. Check "Application Status" on the portal and output\submissions.csv .
pause
