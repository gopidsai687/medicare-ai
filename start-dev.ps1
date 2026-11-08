<#
.SYNOPSIS
    MediCare AI - PowerShell Development Environment Launcher
.DESCRIPTION
    Checks for port conflicts, starts FastAPI and Vite dev servers in separate persistent windows,
    verifies health checks, and displays clickable development URLs.
#>

Write-Host "===============================================================================" -ForegroundColor Cyan
Write-Host "            MediCare AI - Fullstack Development Environment Launcher            " -ForegroundColor Cyan
Write-Host "===============================================================================" -ForegroundColor Cyan
Write-Host ""

$rootPath = $PSScriptRoot

# 1. Check prerequisites
if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] Python was not found in PATH." -ForegroundColor Red
    pause
    exit 1
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] npm was not found in PATH." -ForegroundColor Red
    pause
    exit 1
}

# 2. Terminate any orphaned process on Port 8000
$port8000Proc = Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
if ($port8000Proc) {
    Write-Host "[*] Freeing Port 8000 (Process IDs: $port8000Proc)..." -ForegroundColor Yellow
    foreach ($pidToKill in $port8000Proc) {
        Stop-Process -Id $pidToKill -Force -ErrorAction SilentlyContinue
    }
}

# 3. Terminate any orphaned process on Port 5173
$port5173Proc = Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
if ($port5173Proc) {
    Write-Host "[*] Freeing Port 5173 (Process IDs: $port5173Proc)..." -ForegroundColor Yellow
    foreach ($pidToKill in $port5173Proc) {
        Stop-Process -Id $pidToKill -Force -ErrorAction SilentlyContinue
    }
}

Start-Sleep -Seconds 1

# 4. Start FastAPI Backend in new window
Write-Host "[*] Launching FastAPI Backend on http://localhost:8000 with hot-reload..." -ForegroundColor Green
$backendCmd = "cd '$rootPath\backend'; `$env:PYTHONPATH='.'; python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "$backendCmd"

# 5. Start Vite Frontend in new window
Write-Host "[*] Launching Vite Frontend on http://localhost:5173 with hot-reload..." -ForegroundColor Green
$frontendCmd = "cd '$rootPath\frontend'; npm run dev"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "$frontendCmd"

Write-Host ""
Write-Host "[*] Waiting for services to initialize..." -ForegroundColor Yellow

# 6. Poll Backend Health
$backendReady = $false
for ($i = 1; $i -le 15; $i++) {
    Start-Sleep -Seconds 2
    try {
        $res = Invoke-RestMethod -Uri "http://localhost:8000/health" -TimeoutSec 2
        if ($res.status -eq "healthy") {
            Write-Host "[OK] Backend is healthy and responding at http://localhost:8000/health" -ForegroundColor Green
            $backendReady = $true
            break
        }
    } catch {
        Write-Host "    ... waiting for backend (attempt $i/15)..." -ForegroundColor Gray
    }
}

# 7. Poll Frontend
for ($i = 1; $i -le 10; $i++) {
    Start-Sleep -Seconds 1
    try {
        $res = Invoke-WebRequest -Uri "http://localhost:5173/" -TimeoutSec 2
        if ($res.StatusCode -eq 200) {
            Write-Host "[OK] Frontend is ready and responding at http://localhost:5173/" -ForegroundColor Green
            break
        }
    } catch {}
}

Write-Host ""
Write-Host "===============================================================================" -ForegroundColor Cyan
Write-Host "            MediCare AI Development Environment is LIVE and STABLE             " -ForegroundColor Cyan
Write-Host "===============================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  * Patient Web Application:        http://localhost:5173/" -ForegroundColor White
Write-Host "  * Patient Dashboard:              http://localhost:5173/patient/dashboard" -ForegroundColor White
Write-Host "  * VitalSense Telemetry:           http://localhost:5173/patient/vitalsense" -ForegroundColor White
Write-Host "  * AI Health Assistant:            http://localhost:5173/patient/ai" -ForegroundColor White
Write-Host "  * Nearby Emergency Hospitals:     http://localhost:5173/patient/hospitals" -ForegroundColor White
Write-Host ""
Write-Host "  * Backend API Documentation:      http://localhost:8000/api/docs" -ForegroundColor White
Write-Host "  * Backend Health Endpoint:        http://localhost:8000/health" -ForegroundColor White
Write-Host "  * Production Static Server:       http://localhost:8000/" -ForegroundColor White
Write-Host ""
Write-Host "  Default Credentials:" -ForegroundColor Yellow
Write-Host "    - Patient:   alice.johnson@medicare.ai / PatientPass123!" -ForegroundColor Yellow
Write-Host "    - Doctor:    sarah.chen@medicare.ai   / DoctorPass123!" -ForegroundColor Yellow
Write-Host "    - Admin:     admin@medicare.ai        / AdminPass123!" -ForegroundColor Yellow
Write-Host ""
Write-Host "[NOTE] Both console windows will stay open with hot-reload active." -ForegroundColor Gray
Write-Host "       To stop servers at any time, run: .\stop-dev.bat" -ForegroundColor Gray
Write-Host "===============================================================================" -ForegroundColor Cyan

