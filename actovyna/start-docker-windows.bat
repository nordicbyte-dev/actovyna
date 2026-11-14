@echo off
cd /d "%~dp0"
echo ACTOVYNA - start de lokale webapp met PostgreSQL en FastAPI.
echo.
echo Open na het starten: http://localhost:8080

docker compose up --build
pause
