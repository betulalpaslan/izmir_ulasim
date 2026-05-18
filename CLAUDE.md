# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

İzmir Ulaşım is a React Native (Expo) mobile app for multimodal public transit navigation in Izmir, Turkey. Users plan routes using public transit, bicycle, or car — with real-time bike-sharing (BİSİM) and park-and-ride (İZELMAN/İZUM) integration.

The companion backend is at `d:\izmir_backend`, deployed on Railway at `https://izmirbackend-production.up.railway.app`. It is a Node.js/Express server that bridges the app to an OpenTripPlanner 2.8.1 (OTP) instance running in the same container.

## Commands

### Frontend (`d:\izmir_ulasim`)
```bash
npm start          # Start Expo dev server
npm run android    # Run on Android emulator/device
npm run ios        # Run on iOS simulator/device
npm run web        # Run in browser
```

### Backend (`d:\izmir_backend`)
```bash
node server.js     # Start Express API only (OTP must already be running on :8080)
bash start.sh      # Production start: launches OTP on :8080, waits 40s, then Node on :3000
```

## Architecture

### Frontend Architecture

**Navigation flow:** `App.js` sets up a Stack navigator — `OnBoardingScreen` on first launch, then a Bottom Tab navigator with three tabs: Harita (HomeScreen), Favoriler (FavoritesScreen), Ayarlar (SettingsScreen).

**Core data flow:**
1. `HomeScreen.js` collects origin/destination from `SearchBar` and calls `Services/api.js`
2. `api.js` POSTs to `/get-route` on the Railway backend
3. Response itineraries are ranked (penalizes walking >2km on a single leg, excessive transfers) and displayed in `RoutePanel.js`
4. Route polylines are decoded via `utils/polyline.js` and rendered on `react-native-maps`

**State and persistence:** All state lives in React hooks within `HomeScreen.js`. User preferences, saved places (Home/Work/School/Shopping), and up to 20 recent routes are persisted with `AsyncStorage`.

**Theme:** `utils/ThemeContext.js` provides a global `ThemeProvider`/`useTheme()` hook. Color tokens are in `utils/theme.js`. Time-of-day context (rush hour, night) triggers advisory tips and visual adjustments.

---

### Backend Architecture

Three logical layers running inside a single Docker container on Railway:

1. **OTP (OpenTripPlanner) on :8080** — Java process, receives GraphQL queries, processes Izmir GTFS transit data, handles routing for all profiles. Port is configurable via `OTP_PORT` env var (defaults to 8080). The OTP URL is `http://localhost:${OTP_PORT}/otp/gtfs/v1`.

2. **Express API on :3000 (`server.js`)** — the only endpoint the app calls. Translates REST requests into OTP GraphQL queries and proxies external data feeds.

3. **External data sources** called by Express:
   - **BİSİM** (`https://openapi.izmir.bel.tr/api/izulas/bisim/istasyonlar`) — bike-sharing stations, 60s cache, 8s timeout
   - **İZELMAN/İZUM** (`https://openapi.izmir.bel.tr/api/ibb/izum/otoparklar`) — car parking lots, 60s cache, 30s timeout
   - Geocoding (Photon + Nominatim) is called **directly from the frontend**, not the backend

**Deployment (Railway):** The `Dockerfile` pulls `otp-shaded-2.8.1.jar` and `graph.obj` from GitHub Releases at build time (they are listed in `.railwayignore` so they are not in source). `start.sh` launches OTP with 1GB heap, waits 40 seconds for it to initialize, then starts Node. Only port 3000 is exposed externally; OTP on 8080 is internal only.

**Startup cache pre-load:** On server start, the parking cache is eagerly populated so the first user request doesn't wait for an external API call. BİSİM cache is lazy (populated on first request).

**OTP routing parameters (`router-config.json`):**
- `walkReluctance: 2.0` — penalizes walking to avoid routes with excessive walking
- `transferPenalty: 300` — discourages unnecessary transfers
- `bikeSpeed: 4.5 m/s`
- Car park: `carParkTime: 5m`, `carParkCost: 120`
- Vehicle parking updater: polls `https://izmirbackend-production.up.railway.app/parking/feed` every 1 minute so OTP always has fresh P+R occupancy data

---

### Transport Profiles & OTP Mode Mapping

The `POST /get-route` body is `{ from: {lat,lon}, to: {lat,lon}, profile, bikeType, modes, numItineraries }`.

| Profile | bikeType | OTP `modes` input |
|---------|----------|------------------|
| `transit` | — | `{ transit: { access: [WALK], egress: [WALK], transfer: [WALK], transit: [BUS/RAIL/TRAM/SUBWAY] } }` |
| `bicycle` | — (own bike) | `{ direct: [BICYCLE], transit: { access: [WALK], egress: [WALK], ... } }` |
| `bicycle` | `PARK` | `{ transit: { access: [BICYCLE_PARKING], egress: [WALK], ... } }` |
| `car` (direct) | — | `{ direct: [CAR] }` |
| `park_and_ride` | — | `{ transit: { access: [CAR_PARKING], egress: [WALK], transfer: [WALK], transit: [...] } }` |

The `modes` query param (e.g. `BUS`, `TRAM`, `RAIL`, `FERRY`) filters which transit submodes OTP considers. Default is all four.

---

### Park & Ride (P+R) — Critical Feature

Park & Ride enables users to drive to a transit-connected parking lot, park, and continue by public transit. This is a first-class feature of the app, not an afterthought.

**Data pipeline:**
1. Express fetches car parking data from İZELMAN/İZUM API every 60s
2. `isParkAndRide()` filters to only viable P+R locations:
   - **Always included**: `OffStreet` parking (multi-level garages, lots)
   - **OnStreet only if**: adjacent to metro, train, or tram station (`p.poi?.metroStation || p.poi?.trainStation || p.poi?.tramStation`)
3. `toOtpParking()` maps each lot to OTP's `vehicleParking` format:
   - `vehicleParkingId: "izmir-pr:{ufid}"`
   - Real-time occupancy: `free` and `occupied` counts from the API
   - Tags: `["park_and_ride", "bike_and_ride"]` — the same lot serves both car and bike P+R
   - Both `carSpaces` and `bicycleSpaces` are set to the same capacity value
4. `GET /parking/feed` returns this data in OTP's PARK_API format — OTP polls it every 1 minute via `router-config.json` updater
5. `GET /parking/stations` returns richer metadata for the frontend map (capacity, free slots, nearMetro/nearTrain/nearTram booleans, isPaid, provider)
6. OTP uses `CAR_PARKING` access mode to plan: drive → park at a feed-supplied lot → walk to transit stop → transit to destination

**Why it matters:** Without the parking feed, OTP has no knowledge of Izmir's P+R lots and cannot plan car+transit itineraries. The 1-minute polling in `router-config.json` is what keeps OTP's internal graph synchronized with real-time occupancy.

---

### Park & Bike (Bicycle Parking + Transit) — Critical Feature

Park & Bike enables users to cycle to a BİSİM bike-sharing station or bike parking point, lock the bike, and continue by public transit.

**Data pipeline:**
1. Express fetches BİSİM station data from İZULAŞ API every 60s
2. `parseCoord()` parses BİSİM's string-format coordinates (`"38.4189,27.1287"`)
3. The backend exposes a **GBFS 2.3-compliant feed** that OTP consumes:
   - `GET /bisim/gbfs` — discovery endpoint (referenced in `router-config.json` as `vehicleRentalServiceDirectory`)
   - `GET /bisim/gbfs/system_information` — system metadata (`system_id: "bisim-izmir"`, operator: İZULAŞ A.Ş., timezone: Europe/Istanbul)
   - `GET /bisim/gbfs/station_information` — station list with coordinates and capacity
   - `GET /bisim/gbfs/station_status` — real-time `num_bikes_available` / `num_docks_available`, `is_renting`/`is_returning` flags
4. When `bikeType === "PARK"`, OTP uses `BICYCLE_PARKING` access mode: bike to a BİSİM station → park → walk to transit stop → transit to destination
5. `GET /bisim/stations` returns processed station data for the frontend map overlay

**Why it matters:** Without the GBFS feed, OTP cannot locate BİSİM stations and cannot plan bike+transit itineraries. The tags `["park_and_ride", "bike_and_ride"]` on parking lots (from the P+R feed) mean a single lot can serve double duty for both car P+R and bike P+R routing.

---

### All Backend API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/get-route` | Main routing: builds OTP GraphQL query, returns itineraries |
| GET | `/bisim/stations` | BİSİM stations for frontend map |
| GET | `/bisim/gbfs` | GBFS discovery feed (for OTP) |
| GET | `/bisim/gbfs/system_information` | GBFS system metadata |
| GET | `/bisim/gbfs/station_information` | GBFS station list |
| GET | `/bisim/gbfs/station_status` | GBFS real-time bike availability |
| GET | `/parking/feed` | OTP vehicle parking feed (PARK_API format) |
| GET | `/parking/stations` | Parking lots for frontend map |

---

## Key Files

| File | Role |
|------|------|
| [Screens/HomeScreen.js](Screens/HomeScreen.js) | Core UI: map, route planning, suggestions, simulation |
| [Services/api.js](Services/api.js) | All backend + geocoding calls |
| [Components/RoutePanel.js](Components/RoutePanel.js) | Route result display and leg breakdown |
| [utils/ThemeContext.js](utils/ThemeContext.js) | Global theme provider |
| `d:\izmir_backend\server.js` | Express + OTP bridge, GBFS feeds, parking feed |
| `d:\izmir_backend\router-config.json` | OTP tuning parameters + parking/GBFS updaters |
| `d:\izmir_backend\start.sh` | Production startup (OTP then Node) |
| `d:\izmir_backend\Dockerfile` | Railway container build (downloads JAR + graph.obj) |

## Notes

- `graph.obj` (73MB, Izmir GTFS routing graph) and `otp-shaded-2.8.1.jar` (177MB) are downloaded from GitHub Releases during Docker build — they are not in source control (`.railwayignore`).
- Regenerating `graph.obj` requires running OTP with `--build` against updated GTFS feeds.
- Passenger fare multipliers: Student 0.7×, Adult 1.0×, Senior free — applied in the frontend (`HomeScreen.js`), not the backend.
- Geocoding uses Photon API (primary) with Nominatim as fallback, debounced at 3 characters, called directly from the frontend.
- No API keys or secrets are used — İZULAŞ and İZELMAN endpoints are public, unauthenticated APIs.
- Error responses use Turkish user-facing messages (e.g. `"Ulaşım sunucusuna şu an ulaşılamıyor."`).
