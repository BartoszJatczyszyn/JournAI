# ⚡ SZYBKI START - Garmin Health Dashboard

## 🎯 W 3 krokach do działającej aplikacji

### 1️⃣ Sklonuj i przejdź do katalogu
```bash
cd AI
```

### 2️⃣ Uruchom wszystko jedną komendą
```bash
./start_all.sh
```

### 3️⃣ Otwórz w przeglądarce
```
http://localhost:3000
```

## ✅ Co się dzieje automatycznie:

1. **Sprawdzenie wymagań** (Python, Node.js)
2. **Instalacja zależności** (pip, npm)
3. **Uruchomienie backend (Enhanced domyślnie)** (port 5002)
4. **Uruchomienie frontend** (port 3000)
## 🛑 Zatrzymanie
```bash
./stop_all.sh
```

## 🔍 Sprawdzenie statusu
```bash
# Backend (Enhanced)
curl http://localhost:5002/api/stats

# Frontend  
open http://localhost:3000
```

## 🚨 Jeśli coś nie działa

### Problem z portami
```bash
./stop_all.sh
./start_all.sh
```

### Problem z zależnościami
```bash
pip install -r Diary-AI-BE/requirements.txt
cd Diary-AI-FE/frontend-react && npm install
```

### Sprawdź logi
```bash
tail -f Diary-AI-BE/backend.log
```

---

**To wszystko! Aplikacja powinna działać w 2-3 minuty.** 🚀