@echo off
title MediCare AI - Service Health Status Check

echo ===============================================================================
echo                     MediCare AI - Service Health Status Check                  
echo ===============================================================================
echo.

powershell -Command "
Write-Host '--- Backend Port 8000 ---' -ForegroundColor Cyan
try {
    $res = Invoke-RestMethod -Uri 'http://localhost:8000/health' -TimeoutSec 3
    Write-Host ('[ONLINE] Status: ' + $res.status + ' | Database: ' + $res.database + ' | Version: ' + $res.version) -ForegroundColor Green
} catch {
    Write-Host ('[OFFLINE] Could not connect to http://localhost:8000/health: ' + $_.Exception.Message) -ForegroundColor Red
}

Write-Host ''
Write-Host '--- Frontend Port 5173 ---' -ForegroundColor Cyan
try {
    $res = Invoke-WebRequest -Uri 'http://localhost:5173/' -TimeoutSec 3
    Write-Host ('[ONLINE] Vite dev server responding with HTTP ' + $res.StatusCode) -ForegroundColor Green
} catch {
    Write-Host ('[OFFLINE] Could not connect to http://localhost:5173/: ' + $_.Exception.Message) -ForegroundColor Red
}
"

echo.
pause

