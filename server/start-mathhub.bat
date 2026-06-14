@echo off
:: MathHub Backend Startup Script
:: 将此脚本添加到 Windows 开机启动即可
title MathHub Server
cd /d "C:\Users\DELL\WorkBuddy\2026-06-12-11-01-36\server"

:restart
echo [%date% %time%] Starting MathHub server...
node server.js
echo [%date% %time%] Server stopped. Restarting in 3 seconds...
timeout /t 3 /nobreak >nul
goto restart
