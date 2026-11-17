# MediCare AI – Mobile & Smartwatch Companion Application

React Native + Expo mobile application connecting smartphones, Apple Watch, Samsung Galaxy Watch, and Wear OS devices to the MediCare AI healthcare ecosystem.

---

## 1. Prerequisites

- **Node.js**: 18+ or 20+
- **Expo CLI**: `npm install -g expo-cli`
- **Expo Go App**:
  - [iOS App Store (Expo Go)](https://apps.apple.com/app/expo-go/id982107779)
  - [Google Play (Expo Go)](https://play.google.com/store/apps/details?id=host.exp.exponent)

---

## 2. Quick Start

```bash
cd mobile
npm install
npm start
```

Scan the terminal QR code with your iPhone Camera (iOS) or the Expo Go app (Android).

---

## 3. Apple HealthKit Integration (iOS & Apple Watch)

- Configured with `com.apple.developer.healthkit` capability in `app.json`.
- Synchronizes:
  - Heart Rate (BPM)
  - Resting Heart Rate
  - Blood Oxygen (SpO2)
  - Daily Steps
  - Sleep Analysis (Core, REM, Deep)
  - Wrist Temperature
- Real-time deduplication prevents duplicate records when syncing in the background.

---

## 4. Android Health Connect Integration (Samsung Galaxy Watch & Wear OS)

- Uses Android Health Connect API (`android.permission.health.*`).
- Synchronizes:
  - Continuous Heart Rate
  - Blood Pressure (Cuff Calibrated)
  - Blood Glucose (CGM / Fingerstick)
  - Blood Oxygen (SpO2)
  - Daily Steps & Active Minutes
  - Sleep Session duration

---

## 5. Backend Connection

The mobile app connects to the MediCare AI FastAPI backend:
- Production URL: `https://medicare-ai-iv31.onrender.com`
- Local Development: `http://<YOUR_LAN_IP>:8000`

Default credentials for testing:
- **Patient**: `alice.johnson@medicare.ai` / `PatientPass123!`
