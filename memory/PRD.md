# MacroLens — Product Requirements

## Overview
Cross-platform mobile app (iOS + Android, built with Expo/React Native) for tracking daily calorie intake, macros, water, weight and workouts. AI food-photo recognition and barcode scanning turn logging into a snap. Design is a striking dark cinematic aesthetic distinct from MyFitnessPal.

## Tech Stack
- Frontend: Expo Router 6, React Native 0.81, expo-camera, react-native-svg, expo-blur, @gorhom/bottom-sheet
- Backend: FastAPI + Motor (MongoDB)
- Auth: Emergent-managed Google Sign-in (session tokens, 7-day expiry, expo-secure-store)
- AI: Gemini 3 Flash via `emergentintegrations` for food-photo → macros JSON
- Barcode data: Open Food Facts (free, no key)

## Features
1. **Google Sign-in** (Emergent Auth) with cold-start deep-link handling.
2. **Dashboard** — calorie ring, macros (P/C/F), quick actions, today's meals.
3. **Log** — manual food entry with meal categories (breakfast/lunch/dinner/snack).
4. **AI Scan** — snap a photo → Gemini 3 Flash returns name + calories + macros.
5. **Barcode Scan** — expo-camera scans EAN/UPC → Open Food Facts lookup.
6. **Progress** — SVG weight chart + tappable water-glass tracker (with haptics).
7. **Profile** — editable daily goals (calories, macros, water, target weight), workout logging, logout.

## API Surface (all `/api/*`)
- POST `/auth/session` (session_id → session_token)
- GET `/auth/me`, POST `/auth/logout`
- GET/PUT `/goals`
- GET/POST `/foods`, DELETE `/foods/{id}`
- GET `/summary/today`
- GET `/water`, POST `/water/increment?delta=`
- GET/POST `/weight`
- GET/POST `/workouts`, DELETE `/workouts/{id}`
- POST `/ai/analyze-food` — Gemini 3 Flash vision
- GET `/barcode/{code}` — Open Food Facts

## Design
Dark obsidian surfaces (#0A0C10), ember accent (#FF5E3A), glass-morphic cards, cinematic hero photography. Bottom tab nav (Home, Log, Progress, Profile).
