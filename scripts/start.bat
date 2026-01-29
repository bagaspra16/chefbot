@echo off
REM ChefBot - All-in-one start script (Windows CMD)
REM Composes services, waits for Ollama, pulls model if needed

setlocal
set MODEL=%OLLAMA_MODEL%
if "%MODEL%"=="" set MODEL=tinyllama
set OLLAMA_URL=%OLLAMA_URL%
if "%OLLAMA_URL%"=="" set OLLAMA_URL=http://localhost:11434
set MAX_WAIT=60

echo === ChefBot ===
echo Model: %MODEL%
echo.

REM 1. Compose up
echo [1/4] Starting Docker Compose...
docker compose up -d --build
if errorlevel 1 (
  echo Failed to start Docker Compose.
  exit /b 1
)

REM 2. Wait for Ollama
echo [2/4] Waiting for Ollama...
set /a i=0
:wait_ollama
curl -sf "%OLLAMA_URL%/api/tags" >nul 2>&1
if %errorlevel% equ 0 goto ollama_ready
set /a i+=1
if %i% geq %MAX_WAIT% (
  echo Timeout waiting for Ollama. Check: docker compose logs ollama
  exit /b 1
)
timeout /t 1 /nobreak >nul
goto wait_ollama

:ollama_ready
echo       Ollama ready.

REM 3. Pull model if not present
echo [3/4] Checking model %MODEL%...
curl -sf "%OLLAMA_URL%/api/tags" | findstr /C:"%MODEL%" >nul 2>&1
if %errorlevel% equ 0 (
  echo       Model already present.
) else (
  echo       Pulling model %MODEL%...
  docker compose exec -T ollama ollama pull %MODEL%
)

REM 4. Done
echo [4/4] Done.
echo.
echo Open: http://localhost:3000
echo.

endlocal
