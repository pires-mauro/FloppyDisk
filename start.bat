@echo off
setlocal
pushd "%~dp0"

docker compose up -d --build
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
