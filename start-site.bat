@echo off
REM ---------------------------------------------------------------------------
REM Starts the InvestorPlugX site under PM2.
REM
REM Run this once manually to launch the site, and register it as a Windows
REM startup task (see register-startup.ps1) so it comes back after a reboot.
REM ---------------------------------------------------------------------------

REM Make sure node/npm are on PATH for this shell.
set "PATH=C:\Program Files\nodejs;%PATH%"

REM Move to the project directory (this script lives in it).
cd /d "%~dp0"

REM Build first if there is no production build yet (first run, or after a
REM fresh clone). Subsequent starts reuse the existing build.
if not exist ".next\BUILD_ID" (
  echo No production build found - running "npm run build"...
  call npm run build
  if errorlevel 1 (
    echo Build failed. Not starting the server.
    exit /b 1
  )
)

REM Start (or reload) the app, then persist the process list so it survives
REM a reboot.
call npx pm2 start ecosystem.config.cjs --update-env
if errorlevel 1 (
  echo Failed to start PM2 process.
  exit /b 1
)

call npx pm2 save

echo.
echo InvestorPlugX is running at http://localhost:3000
echo   Logs:    npx pm2 logs investorplugx
echo   Restart: npx pm2 restart investorplugx
echo   Status:  npx pm2 status


