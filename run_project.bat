@echo off
cd /d "%~dp0"

echo ========================================
echo Catalog Management Panel
echo ========================================
echo.

echo Checking server status...

:: Check if port 3000 is in use
netstat -ano | findstr :3000 >nul
if %errorlevel% == 0 (
    echo [OK] Server is running
    echo Opening browser...
    start http://localhost:3000
    timeout /t 2 /nobreak >nul
    echo Browser opened
) else (
    echo [INFO] Server is not running
    echo Starting server...
    echo.

    :: Start server in new window
    start "Vishano Server" cmd /k "node server.js"

    echo [OK] Server is running
    echo Waiting for server to start...
    timeout /t 5 /nobreak >nul

    echo Opening browser...
    start http://localhost:3000
    timeout /t 2 /nobreak >nul
    echo Browser opened
)

echo.
echo ========================================
echo Project opened successfully
echo Do not close the server window
echo ========================================
echo.
timeout /t 3 /nobreak >nul
