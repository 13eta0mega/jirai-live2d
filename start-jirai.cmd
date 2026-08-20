@echo off
setlocal
set "PROJECT_ROOT=%~dp0"
cd /d "%PROJECT_ROOT%"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js를 찾을 수 없습니다. Node.js 18 이상을 설치한 뒤 다시 실행하세요.
  pause
  exit /b 1
)
node "%PROJECT_ROOT%tools\serve.mjs"
pause

