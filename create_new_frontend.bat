@echo off
echo Creating new React app...
cd /d "%~dp0"
cd ..
npx create-react-app frontend-new
echo.
echo New React app created in frontend-new folder
pause