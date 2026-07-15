@echo off
setlocal

cd /d "%~dp0"

echo ============================================
echo cttpro one-click package
echo Frontend dist + Java backend jar
echo ============================================
echo.

where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] npm was not found. Please install Node.js and npm first.
  echo.
  pause
  exit /b 1
)

if not exist "%~dp0scripts\package-all.ps1" (
  echo [ERROR] scripts\package-all.ps1 was not found.
  echo.
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\package-all.ps1"
set "PACKAGE_EXIT_CODE=%ERRORLEVEL%"

echo.
if "%PACKAGE_EXIT_CODE%"=="0" (
  echo [OK] Package complete.
  echo Artifacts directory:
  echo %~dp0artifacts
) else (
  echo [ERROR] Package failed with exit code %PACKAGE_EXIT_CODE%.
)
echo.

pause
exit /b %PACKAGE_EXIT_CODE%
