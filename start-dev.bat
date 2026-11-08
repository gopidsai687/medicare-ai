@echo off
setlocal enabledelayedexpansion
title MediCare AI - Development Server Launcher

echo ===============================================================================
echo            MediCare AI - Fullstack Development Environment Launcher            
echo ===============================================================================
echo.

:: 1. Verify Prerequisites
where python >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python was not found in PATH. Please install Python 3.10+ and add to PATH.
    pause
    exit /b 1
)

where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] npm was not found in PATH. Please install Node.js 18+ and add to PATH.
    pause
    exit /b 1
)

echo [*] Checking and resolving port conflicts...

:: 2. Terminate any orphaned processes on port 8000 (Backend)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr /r ":8000.*LISTENING"') do (
    echo [*] Freeing port 8000 (PID: %%a)...
    taskkill /f /pid %%a >nul 2>&1
)

:: 3. Terminate any orphaned processes on port 5173 (Frontend)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr /r ":5173.*LISTENING"') do (
    echo [*] Freeing port 5173 (PID: %%a)...
    taskkill /f /pid %%a >nul 2>&1
)

timeout /t 1 /nobreak >nul

:: 4. Start Backend Server in a new persistent window
echo [*] Launching FastAPI Backend on http://localhost:8000 with hot-reload...
start "MediCare AI - Backend (Port 8000)" cmd /k "cd /d %~dp0backend && set PYTHONPATH=. && python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"

:: 5. Start Frontend Dev Server in a new persistent window
echo [*] Launching Vite Frontend on http://localhost:5173 with hot-reload...
start "MediCare AI - Frontend (Port 5173)" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo [*] Waiting for services to initialize...

:: 6. Poll Backend Health endpoint
set /a attempts=0
:WAIT_BACKEND
timeout /t 2 /nobreak >nul
set /a attempts+=1
powershell -Command "try { $res = Invoke-RestMethod -Uri 'http://localhost:8000/health' -TimeoutSec 2; if ($res.status -eq 'healthy') { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Backend is healthy and responding at http://localhost:8000/health
    goto WAIT_FRONTEND
)
if !attempts! leq 15 (
    echo     ... waiting for backend (attempt !attempts!/15)...
    goto WAIT_BACKEND
) else (
    echo [WARNING] Backend is taking longer than usual to report healthy. Check the Backend console window.
)

:WAIT_FRONTEND
set /a attempts=0
:WAIT_FRONTEND_LOOP
timeout /t 1 /nobreak >nul
set /a attempts+=1
powershell -Command "try { $res = Invoke-WebRequest -Uri 'http://localhost:5173/' -TimeoutSec 2; if ($res.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Frontend is ready and responding at http://localhost:5173/
    goto READY
)
if !attempts! leq 10 (
    goto WAIT_FRONTEND_LOOP
)

:READY
echo.
echo ===============================================================================
echo            MediCare AI Development Environment is LIVE and STABLE             
echo ===============================================================================
echo.
echo   * Patient Web Application:        http://localhost:5173/
echo   * Patient Dashboard:              http://localhost:5173/patient/dashboard
echo   * VitalSense Telemetry:           http://localhost:5173/patient/vitalsense
echo   * AI Health Assistant:            http://localhost:5173/patient/ai
echo   * Nearby Emergency Hospitals:     http://localhost:5173/patient/hospitals
echo.
echo   * Backend API Documentation:      http://localhost:8000/api/docs
echo   * Backend Health Endpoint:        http://localhost:8000/health
echo   * Production Static Server:       http://localhost:8000/
echo.
echo   Default Credentials:
echo     - Patient:   alice.johnson@medicare.ai / PatientPass123!
echo     - Doctor:    sarah.chen@medicare.ai   / DoctorPass123!
echo     - Admin:     admin@medicare.ai        / AdminPass123!
echo.
echo [NOTE] Both console windows will stay open with hot-reload active.
echo        To stop servers at any time, run: stop-dev.bat
echo ===============================================================================
pause
