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
echo Applying test officer migration...
docker compose exec -T db psql -U bank_user -d bank_onboarding -v ON_ERROR_STOP=1 -f - < "apps\api\migrations\001_initial_schema.sql"
if errorlevel 1 goto failed
docker compose exec -T db psql -U bank_user -d bank_onboarding -v ON_ERROR_STOP=1 -f - < "apps\api\migrations\002_reference_data.sql"
if errorlevel 1 goto failed
docker compose exec -T db psql -U bank_user -d bank_onboarding -v ON_ERROR_STOP=1 -f - < "apps\api\migrations\003_countries.sql"
if errorlevel 1 goto failed
docker compose exec -T db psql -U bank_user -d bank_onboarding -v ON_ERROR_STOP=1 -f - < "apps\api\migrations\004_test_officer.sql"
if errorlevel 1 goto failed

start "" "http://localhost:5173"
start "" "http://localhost:2424/docs"
start "" "http://localhost:8000/docs"

echo All containers are started.
echo Frontend:             http://localhost:5173
echo Critical Swagger:     http://localhost:2424/docs
echo Main API Swagger:     http://localhost:8000/docs
popd
exit /b 0

:failed
echo Failed to start the containers. Check that Docker Desktop is running and review the error above.
popd
pause
exit /b 1
