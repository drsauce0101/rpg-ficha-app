@echo off
title Servidor de RPG - Giharad
echo Iniciando Ambiente e Servidor...

:: Vá para a pasta onde está o projeto (ajuste o caminho se necessário)
cd /d "%~dp0"

:: Ativa o ambiente virtual
call venv\Scripts\activate

:: Inicia o Uvicorn
start cmd /k "uvicorn backend.main:app --host 0.0.0.0 --port 8000"

timeout /t 5
start cmd /k "ngrok http 8000"
pause