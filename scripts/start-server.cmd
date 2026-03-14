@echo off
setlocal
set "ROOT=%~dp0.."
cd /d "%ROOT%"
powershell -ExecutionPolicy Bypass -File ".\scripts\start-server.ps1"
