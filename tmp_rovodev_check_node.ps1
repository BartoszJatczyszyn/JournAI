# Skrypt sprawdzający instalację Node.js
Write-Host "=== Sprawdzanie instalacji Node.js ===" -ForegroundColor Green

try {
    $nodeVersion = node --version
    Write-Host "✅ Node.js zainstalowany: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js nie jest zainstalowany lub nie jest w PATH" -ForegroundColor Red
}

try {
    $npmVersion = npm --version
    Write-Host "✅ npm zainstalowany: $npmVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ npm nie jest dostępny" -ForegroundColor Red
}

Write-Host "`n=== Następne kroki ===" -ForegroundColor Yellow
Write-Host "Jeśli Node.js jest zainstalowany, uruchom:" -ForegroundColor White
Write-Host "cd AI\frontend" -ForegroundColor Cyan
Write-Host "npm install" -ForegroundColor Cyan
Write-Host "npm start" -ForegroundColor Cyan