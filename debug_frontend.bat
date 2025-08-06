@echo off
echo === Garmin Health Dashboard Frontend Debug ===
echo.
echo Checking Node.js installation...
node --version
if %errorlevel% neq 0 (
    echo ERROR: Node.js not found in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

echo.
echo Checking npm installation...
npm --version
if %errorlevel% neq 0 (
    echo ERROR: npm not found
    pause
    exit /b 1
)

echo.
echo Changing to frontend directory...
cd frontend
if %errorlevel% neq 0 (
    echo ERROR: frontend directory not found
    pause
    exit /b 1
)

echo Current directory: %CD%
echo.
echo Checking if node_modules exists...
if not exist "node_modules" (
    echo WARNING: node_modules not found, running npm install...
    npm install
)

echo.
echo Starting React application...
npm start

echo.
echo If you see this message, the app stopped unexpectedly
pause