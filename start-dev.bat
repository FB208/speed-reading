@echo off
setlocal

set "ROOT_DIR=%~dp0"
if "%ROOT_DIR:~-1%"=="\" set "ROOT_DIR=%ROOT_DIR:~0,-1%"

set "BACKEND_DIR=%ROOT_DIR%\backend"
set "FRONTEND_DIR=%ROOT_DIR%\frontend"
set "VENV_PY=%BACKEND_DIR%\venv\Scripts\python.exe"

echo [INFO] Preparing dev environment...

if not exist "%BACKEND_DIR%\" (
  echo [ERROR] backend directory not found: %BACKEND_DIR%
  exit /b 1
)

if not exist "%FRONTEND_DIR%\" (
  echo [ERROR] frontend directory not found: %FRONTEND_DIR%
  exit /b 1
)

where python >nul 2>nul
if errorlevel 1 (
  echo [ERROR] python was not found in PATH.
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] npm was not found in PATH.
  exit /b 1
)

if not exist "%VENV_PY%" (
  echo [INFO] Creating backend virtual environment...
  python -m venv "%BACKEND_DIR%\venv"
  if errorlevel 1 (
    echo [ERROR] Failed to create backend venv.
    exit /b 1
  )

  echo [INFO] Installing backend dependencies...
  "%VENV_PY%" -m pip install -r "%BACKEND_DIR%\requirements.txt"
  if errorlevel 1 (
    echo [ERROR] Failed to install backend dependencies.
    exit /b 1
  )
) else (
  echo [INFO] backend venv already exists.
)

if not exist "%BACKEND_DIR%\.env" (
  if exist "%BACKEND_DIR%\.env.example" (
    copy /y "%BACKEND_DIR%\.env.example" "%BACKEND_DIR%\.env" >nul
    echo [INFO] backend\.env created from .env.example
  ) else (
    echo [WARN] backend\.env and .env.example are both missing.
  )
)

if not exist "%FRONTEND_DIR%\node_modules\" (
  echo [INFO] Installing frontend dependencies...
  pushd "%FRONTEND_DIR%"
  call npm install
  if errorlevel 1 (
    popd
    echo [ERROR] Failed to install frontend dependencies.
    exit /b 1
  )
  popd
) else (
  echo [INFO] frontend node_modules already exists.
)

echo [INFO] Starting backend at http://localhost:8000
start "Speed Reading Backend" cmd /k "cd /d ""%BACKEND_DIR%"" && call venv\Scripts\activate && uvicorn app.main:app --reload"

echo [INFO] Starting frontend at http://localhost:3000
start "Speed Reading Frontend" cmd /k "cd /d ""%FRONTEND_DIR%"" && npm start"

echo [DONE] Backend and frontend started.
echo [TIP] Close the two opened terminals to stop services.
exit /b 0
