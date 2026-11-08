@echo off
setlocal enabledelayedexpansion
title MediCare AI - Stop Development Servers

echo ===============================================================================
echo            Stopping MediCare AI Development Servers (Ports 8000 & 5173)         
echo ===============================================================================
echo.

:: Free Port 8000
for /f "tokens=5" %%a in ('netstat -aon ^| findstr /r ":8000.*LISTENING"') do (
    echo [*] Terminating Backend process (PID: %%a)...
    taskkill /f /pid %%a >nul 2>&1
)

:: Free Port 5173
for /f "tokens=5" %%a in ('netstat -aon ^| findstr /r ":5173.*LISTENING"') do (
    echo [*] Terminating Frontend process (PID: %%a)...
    taskkill /f /pid %%a >nul 2>&1
)

echo.
echo [OK] All MediCare AI development servers have been safely stopped.
timeout /t 2 /nobreak >nul

