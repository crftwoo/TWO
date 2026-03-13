@echo off
title MOTOR DE PUBLICACAO - CLIMAFRIO
cd /d "%~dp0"
echo ========================================
echo   LIGANDO O MOTOR DE PUBLICACAO...
echo ========================================
node server/motor-publicacao.js
pause
