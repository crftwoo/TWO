@echo off
cd /d "%~dp0"
git pull origin main
powershell -Command "Compress-Archive -Path 'src-extensao\*' -DestinationPath 'assets\extensao.zip' -Force"
