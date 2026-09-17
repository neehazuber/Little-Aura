@echo off
title Little Aura - POS Server
color 0A
echo.
echo  ====================================
echo   LITTLE AURA - POS System Server
echo  ====================================
echo.
echo  Starting server on http://localhost:5000
echo  Press Ctrl+C to stop the server
echo.
cd /d "%~dp0"
node server.js
echo.
echo  Server stopped.
pause
