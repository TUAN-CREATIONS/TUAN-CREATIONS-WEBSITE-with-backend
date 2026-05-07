@echo off
REM TUAN Marketplace - Deployment Script (Windows)
REM Usage: deploy.bat [netlify|docker|both]

setlocal enabledelayedexpansion

set DEPLOY_TYPE=%1
if "%DEPLOY_TYPE%"=="" set DEPLOY_TYPE=both

echo.
echo ====================================================
echo   TUAN Marketplace Deployment Script
echo   Platform: Windows
echo   Deploy Type: %DEPLOY_TYPE%
echo ====================================================
echo.

REM Get current directory
for /f %%i in ('cd') do set SCRIPT_DIR=%%i

REM ============================================
REM FRONTEND BUILD
REM ============================================
if "%DEPLOY_TYPE%"=="netlify" goto BUILD_FRONTEND
if "%DEPLOY_TYPE%"=="both" goto BUILD_FRONTEND
goto CHECK_DOCKER

:BUILD_FRONTEND
echo [1/5] Building Frontend...
cd /d "%SCRIPT_DIR%"
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Frontend build failed
    exit /b 1
)
echo ✓ Frontend build complete
echo.

if exist "%ProgramFiles%\nodejs\npm.cmd" (
    echo [2/5] Checking Netlify CLI...
    where netlify >nul 2>nul
    if %ERRORLEVEL% EQ 0 (
        echo Deploying to Netlify...
        call netlify deploy --prod --dir=dist
        echo ✓ Frontend deployed to Netlify
    ) else (
        echo ℹ Netlify CLI not installed
        echo   Install: npm install -g netlify-cli
        echo   Then deploy: netlify deploy --prod --dir=dist
    )
)
echo.

REM ============================================
REM BACKEND DOCKER BUILD
REM ============================================
:CHECK_DOCKER
if "%DEPLOY_TYPE%"=="docker" goto BUILD_DOCKER
if "%DEPLOY_TYPE%"=="both" goto BUILD_DOCKER
goto HEALTH_CHECKS

:BUILD_DOCKER
echo [3/5] Building Backend Docker Image...
cd /d "%SCRIPT_DIR%\backend"
docker build -t tuan-backend:latest .
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Docker build failed
    echo Make sure Docker Desktop is running
    exit /b 1
)
echo ✓ Backend Docker image built
echo.

echo [4/5] Starting Docker Compose Stack...
cd /d "%SCRIPT_DIR%"
docker-compose up -d
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Docker Compose failed
    exit /b 1
)
echo ✓ Docker stack started
echo.

echo Waiting for services to be ready...
timeout /t 5
echo.

echo Docker Stack Status:
docker-compose ps
echo.

REM ============================================
REM HEALTH CHECKS
REM ============================================
:HEALTH_CHECKS
echo [5/5] Running Health Checks...

REM Check backend
for /f "delims=" %%i in ('powershell -Command "(Test-NetConnection -ComputerName localhost -Port 4000 -WarningAction SilentlyContinue).TcpTestSucceeded"') do set BACKEND_CHECK=%%i
if "%BACKEND_CHECK%"=="True" (
    echo ✓ Backend is responding (port 4000)
) else (
    echo ⚠ Backend not responding yet
)

REM Check frontend
for /f "delims=" %%i in ('powershell -Command "(Test-NetConnection -ComputerName localhost -Port 5173 -WarningAction SilentlyContinue).TcpTestSucceeded"') do set FRONTEND_CHECK=%%i
if "%FRONTEND_CHECK%"=="True" (
    echo ✓ Frontend is accessible (port 5173)
) else (
    echo ⚠ Frontend not running
)

echo.
echo ====================================================
echo   ✅ Deployment Complete!
echo ====================================================
echo.
echo Access your application:
echo   Frontend: http://localhost:5173
echo   Backend:  http://localhost:4000
echo   API:      http://localhost:4000/api
echo.
echo.

pause
