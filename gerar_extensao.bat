@echo off
echo Zipando a pasta src-extensao e atualizando assets\extensao.zip...

if exist assets\extensao.zip (
    del assets\extensao.zip
)

powershell -command "Compress-Archive -Path src-extensao\* -DestinationPath assets\extensao.zip -Force"

echo Pronto! O arquivo assets\extensao.zip foi atualizado.
pause
