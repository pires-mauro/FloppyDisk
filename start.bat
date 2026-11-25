@echo off
setlocal
pushd "%~dp0"

docker compose up -d --build
if errorlevel 1 goto failed

set "attempts=0"
:wait_for_db
docker compose exec -T db pg_isready -U bank_user -d bank_onboarding >nul 2>&1
if not errorlevel 1 goto database_ready
set /a attempts+=1
if %attempts% geq 30 goto database_timeout
timeout /t 2 /nobreak >nul
goto wait_for_db

:database_timeout
echo Database did not become ready in time.
goto failed

:database_ready
echo Applying pending database migrations...
py "apps\api\migrations\apply.py"
if errorlevel 1 goto failed

if exist "data\opensanctions\entities.ftm.json" (
    echo Checking OpenSanctions data...
    docker compose exec -T api python -m app.import_opensanctions --file /screening-data/entities.ftm.json
    if errorlevel 1 goto failed
) else (
    echo OpenSanctions import skipped. Put entities.ftm.json in data\opensanctions to enable it.
)

start "" "http://localhost:5173"

echo All containers are started.
echo Frontend:             http://localhost:5173
popd
exit /b 0

:failed
echo Failed to start the containers. Check that Docker Desktop is running and review the error above.
popd
pause
exit /b 1
