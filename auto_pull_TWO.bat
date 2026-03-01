@echo off
echo ==============================================
echo  Buscando atualizacoes do projeto TWO no GitHub...
echo ==============================================
echo.

cd /d "%~dp0"
git pull origin main

echo.
echo ==============================================
echo  Atualizacao concluida!
echo  Seus arquivos locais agora estao iguais aos do GitHub.
echo ==============================================
pause
