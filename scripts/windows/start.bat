@echo off
chcp 65001 >nul
title Цахим номын сан
cd /d "%~dp0..\.."

if not exist node_modules (
  echo Хамаарлуудыг суулгаж байна...
  call npm install
  if errorlevel 1 goto error
)

if not exist .env (
  copy .env.example .env >nul
  echo .env файл үүсгэлээ. Сургуулийн нэр, нууц үгээ бичээд хадгална уу.
  notepad .env
)

node server.js
goto end

:error
echo.
echo Алдаа гарлаа. Node.js суулгасан эсэхээ шалгана уу: https://nodejs.org

:end
pause
