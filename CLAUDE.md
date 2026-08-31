# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

İzmir Ulaşım is a React Native (Expo) mobile app for multimodal public transit navigation in Izmir, Turkey. Users plan routes using public transit, bicycle, or car — with real-time bike-sharing (BİSİM) and park-and-ride (İZELMAN/İZUM) integration.

The companion backend is at `d:\Mures\izmir_backend`, deployed on Railway at `https://izmirbackend-production.up.railway.app`. It is a Node.js/Express server that bridges the app to an OpenTripPlanner 2.8.1 (OTP) instance running in the same container.

## Commands

### Frontend (`d:\izmir_ulasim`)
```bash
npm start          # Start Expo dev server
npm run android    # Run on Android emulator/device
npm run ios        # Run on iOS simulator/device
npm run web        # Run in browser
```

### Backend (`d:\Mures\izmir_backend`)
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
3. Response itineraries are ranked (eliminates any route with a single walk leg over 20 minutes, penalizes long walks and excessive transfers) and displayed in `RoutePanel.js`
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

| Profile | bikeType | UI label | OTP `modes` input |
|---------|----------|----------|------------------|
| `transit` | — | Transit | `{ transit: { access: [WALK], egress: [WALK], transfer: [WALK], transit: [BUS/RAIL/TRAM/SUBWAY] } }` |
| `bicycle` | `PARK` | Bisikletim + Aktarma | `{ transit: { access: [BICYCLE, BICYCLE_PARKING], egress: [BICYCLE, WALK], transfer: [BICYCLE, WALK], ... } }` |
| `bicycle` | `RENT` | BİSİM + Aktarma | `{ transit: { access: [BICYCLE_RENTAL], egress: [BICYCLE_RENTAL, WALK], ... } }` |
| `car` (direct) | — | Direkt | `{ direct: [CAR] }` |
| `park_and_ride` | — | Park+Taşı | `{ transit: { access: [CAR_PARKING], egress: [WALK], transfer: [WALK], transit: [...] } }` |

**You can take your bike on the metro, tram and İZBAN**, so the own-bike mode
asks OTP for *both* shapes at once and lets the faster one win: `BICYCLE`
access carries the bike onto the vehicle, `BICYCLE_PARKING` leaves it at the
station. OTP only produces the first where GTFS says `trips.bikes_allowed=1`,
and the İzmir feed had that field backwards — buses flagged allowed, the three
systems that actually allow bikes silent. The feed is patched by
`izmir_backend/tools/gtfs-bisiklet-yamasi.js` and **the patch must be re-applied
every time the feeds are refreshed, before rebuilding the graph**; see
`izmir_backend/docs/API.md` for the sources and the measured evidence.

**Bicycle modes are transit-only, by design.** Neither bike mode asks OTP for a
`direct` leg. A third mode ("Kendi Bisikletim" — ride the whole way) existed and
was removed after measurement: on Narlıdere → Çiğli it produced a single card, a
137-minute / 33.5 km uninterrupted ride, and `direct` legs crowded the
transfer-based candidates out of the list. In both remaining modes the bicycle is
an *access vehicle*, not the journey. `bikeType: null` from an older client is
treated as `PARK` on both sides (`buildModesInput` and `resolveProfileKey`).

The `modes` query param (e.g. `BUS`, `TRAM`, `RAIL`, `FERRY`) filters which transit submodes OTP considers. Default is all four.

**Tiered walking cap.** A route with any single WALK leg longer than 20 minutes
(`YURUYUS_BACAK_TAVANI_SN` in `utils/routeScoring.js`) is not shown *while a route
under the cap exists*. When no route respects it, walking that far is genuinely
unavoidable and an empty screen helps nobody: `rankItineraries` falls to a second
tier, returns the least-walking candidates flagged `yuruyusZorunlu`, and both
clients say so in words (`notice` in `useRouteSearch`, the status line on the web).
Measured: this exception fires in 1 of 55 mode-scenarios.

The cap is a *preference* limit, not physics — which is why it bends. Mode purpose
(`MOD_AMACI`) is a *promise* and does not: if no itinerary does the job of the
selected mode the list stays empty. Conflating the two is what blanked the screen
for reasons the user could not act on.

**When a mode honestly cannot help**, the empty list is the right answer but a
dead end on its own — users re-ran the same search. `modBosSebebi` states the
reason in measured numbers ("Bisiklet bu yolculuğu 9.6 dk uzatıyor", "Araç
15.9 km, toplu taşıma 0.9 km") and returns the plain-transit alternative's
duration, which both clients offer as a one-tap exit. The number comes from the
walk-access baseline query the backend already ran (`duzTransitEnIyiSn` — the old
`bisikletsizEnIyiSn` under a neutral name, now also requested for `park_and_ride`);
if that query failed the field is null and **no offer is shown**, never a guess.

**Park & Ride asks who carries the journey, not how far the car goes.**
`transitMeters >= 2000 && transitMeters >= carMeters * PR_TRANSIT_ASGARI_ORAN`
(0.3). The old rule also demanded `carMeters >= 2000` — a half that was never
measured, added for symmetry, and it produced false negatives: on Karşıyaka →
Bornova four itineraries drove 1.1 km to the Karşıyaka İskele lot and rode
8.6–14.2 km of transit, and all four were dropped for "the car leg is under 2 km".
A short drive to the lot is Park & Ride working, not failing.

The ratio was calibrated, not guessed. `transit >= car` (ratio 1.0) was tried
first and cut through the middle of the data: it dropped a real 33-minute P+R on
Alsancak → Balçova (9.0 km car + 4.3 km transit, recommendation fell to 51 min)
and rejected a Narlıdere → Çiğli itinerary by 200 metres (14.6 vs 14.4 km).
Sorting the transit/car ratio of all 30 itineraries with transit ≥ 2 km shows a
gap: 0.08 and 0.17 (28.8 km and 13.7 km of driving against 2.3 km of transit),
then nothing until 0.38. Any threshold in that gap behaves identically; 0.3 is its
middle. Empty results go from 5 scenarios to 4 — kuzey-dogu and guney-merkez open,
uzak-kuzey closes — and no fast card is lost from the scenarios that already
worked.

A third scoring term backs the cap up: the longest walk leg is penalised
quadratically as it approaches 20 minutes (`uzunBacakPts`). A linear penalty did
not protect the space just under the cap — a 19-minute leg slipped through on a
few minutes of time advantage. Measured on Alsancak → Balçova in BİSİM mode, the
recommended card moved from a 16-minute longest walk to a 3-minute one, costing
3.6 minutes of journey time.

The old cap was 5000 m of distance and missed the real cases: the same journey had
a 19-minute opening walk on plain transit and a 28-minute one in BİSİM mode, both
under 5 km.

---

### Park & Ride (P+R) — Critical Feature

Park & Ride enables users to drive to a transit-connected parking lot, park, and continue by public transit. This is a first-class feature of the app, not an afterthought.

**Data pipeline:**
1. Express fetches car parking data from İZELMAN/İZUM API every 60s
2. `isParkAndRide()` filters to only viable P+R locations:
   - **Always included**: `OffStreet` parking (multi-level garages, lots)
   - **OnStreet only if**: adjacent to metro, train, or tram station (`p.poi?.metroStation || p.poi?.trainStation || p.poi?.tramStation`)
3. `toOtpParking()` maps each lot to OTP's ParkAPI format:
   - `vehicleParkingId: "izmir-pr:{ufid}"` (OTP prefixes the feed id itself)
   - Real-time occupancy: `free` is sent **only when actually known**. Writing 0 for an unknown value tells OTP the lot is full and drops it from routing — that would lose all 68 lots that have no sensor.
   - The `park_and_ride` tag comes from the updater config, not from this function
   - This feed registers **car** spaces only (`sourceType: PARK_API`). The same lots are re-served for bicycles by `/parking/bike-feed` under a second updater — see "Bisikletim + Aktarma" below.
4. `GET /parking/feed` returns this data in OTP's PARK_API format — OTP polls it every 1 minute via `router-config.json` updater
5. `GET /parking/stations` returns richer metadata for the frontend map (capacity, free slots, nearMetro/nearTrain/nearTram booleans, isPaid, provider)
6. OTP uses `CAR_PARKING` access mode to plan: drive → park at a feed-supplied lot → walk to transit stop → transit to destination

**Why it matters:** Without the parking feed, OTP has no knowledge of Izmir's P+R lots and cannot plan car+transit itineraries. The 1-minute polling in `router-config.json` is what keeps OTP's internal graph synchronized with real-time occupancy.

---

### Bisikletim + Aktarma (Bicycle Parking + Transit) — Critical Feature

The user cycles their **own** bike to a rail station or bike parking point, locks
it, and continues by public transit. (BİSİM is the *other* bike mode — see below.
Locking your own bike at a BİSİM drop zone is not a thing; the two must not be
conflated.)

**The bicycle parking feed (`GET /parking/bike-feed`).** OTP can only end a
bicycle leg where a vehicle parking with bicycle spaces exists. Every such point
in the graph used to come from OSM `amenity=bicycle_parking` — 87 nodes, almost
all coastal/recreational (İnciraltı, Sahilevleri, Bostanlı), **none at a rail
station**. Measured consequence on Narlıdere → Çiğli, Mon 08:00:

    BICYCLE 18 min / 4.2 km → BUS 311, 13 min → SUBWAY M1

i.e. the bike was parked 3 km short of the metro and a bus leg was inserted to
cover the gap. `/parking/feed` could not fill the hole: OTP's `PARK_API` source
type registers lots for cars only. `/parking/bike-feed` is served to a second
updater with `sourceType: BICYCLE_PARK_API`, and adds ~130 points: every stop
that has real rail/subway/tram service, plus the P+R car lots.

The rail points are derived from **OTP's own stop list** (`{ stops { routes { mode } } }`),
not from the İZULAŞ station API. That was measured too: the station API lists
"Narlıdere İtfaiye" as a metro station, and against a graph without the metro feed
it produced a bicycle parking where only bus stops existed — reproducing the exact
bug, closer to home. A point deserves bicycle parking because rail actually serves
it, not because an administrative list names it a station. Capacity is nominal
(no inventory is published) and is never shown to the user.

### BİSİM + Aktarma (Bike Sharing + Transit) — Critical Feature

The user picks up a BİSİM bike inside the service area, rides to transit, and
leaves it anywhere in the zone.

**Data pipeline:**
1. Express fetches BİSİM station data from İZULAŞ API every 60s
2. `parseCoord()` parses BİSİM's string-format coordinates (`"38.4189,27.1287"`)
**BİSİM is dockless and must be modelled as such.** Publishing the 11 bonus
zones as GBFS *stations* described a docked system to OTP, which then could only
*end* a rental at a station. Measured, Konak İskele → Alsancak Garı:

    BICYCLE 12 min / 2358 m (Konak İskele → Alsancak Kordon)  +  WALK 17 min / 1294 m

The bike was parked at the nearest station and the last 1.3 km walked. Real BİSİM
lets you leave the bike anywhere inside the service area. The fix is
`free_bike_status.json` + `vehicle_types.json` (`return_constraint: free_floating`):
OTP then treats each bike as a free-floating vehicle that can be dropped anywhere
inside the geofencing zone. Same journey now rides to the door — 19 min, no
closing walk.

> **What is assumed and what is not.** No live bike positions are published, so
> the coordinates in `free_bike_status` are *not* real bikes. They are sampled
> every 400 m along the **actual open-data bike-path geometry**
> (`data/bisiklet-yollari.geojson`) restricted to the service districts — not a
> blind grid over the zone. Because they are assumptions, they are **never shown
> to the user**: `/bisim/stations` still returns zones, the map still shows the
> area, and the route card says "pick up the BİSİM bike *near you*" rather than
> naming a spot. If a live feed ever appears, delete the generator and use it.

3. The backend exposes a **GBFS 2.3-compliant feed** that OTP consumes:
   - `GET /bisim/gbfs` — discovery endpoint (referenced in `router-config.json` as `vehicleRentalServiceDirectory`)
   - `GET /bisim/gbfs/system_information` — system metadata (`system_id: "bisim-izmir"`, operator: İZULAŞ A.Ş., timezone: Europe/Istanbul)
   - `GET /bisim/gbfs/station_information` — station list with coordinates and capacity
   - `GET /bisim/gbfs/station_status` — real-time `num_bikes_available` / `num_docks_available`, `is_renting`/`is_returning` flags
4. When `bikeType === "RENT"`, OTP uses `BICYCLE_RENTAL` as the **access** mode (and rental-or-walk as egress): pick up a bike in the zone → ride to a stop → transit → walk or ride to the destination. `WALK` is deliberately absent from `access`: with it, OTP preferred the bike-free access leg and the mode named "BİSİM" returned itineraries containing no BİSİM.
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
| GET | `/parking/feed` | OTP car parking feed (PARK_API format) |
| GET | `/parking/bike-feed` | OTP bicycle parking feed (BICYCLE_PARK_API) — rail stations + P+R lots |
| GET | `/parking/stations` | Parking lots for frontend map |

---

## Key Files

| File | Role |
|------|------|
| [Screens/HomeScreen.js](Screens/HomeScreen.js) | Core UI: map, route planning, suggestions, simulation |
| [Services/api.js](Services/api.js) | All backend + geocoding calls |
| [Components/RoutePanel.js](Components/RoutePanel.js) | Route result display and leg breakdown |
| [utils/ThemeContext.js](utils/ThemeContext.js) | Global theme provider |
| `d:\Mures\izmir_backend\server.js` | Express + OTP bridge, GBFS feeds, parking feed |
| `d:\Mures\izmir_backend\router-config.json` | OTP tuning parameters + parking/GBFS updaters |
| `d:\Mures\izmir_backend\start.sh` | Production startup (OTP then Node) |
| `d:\Mures\izmir_backend\Dockerfile` | Railway container build (downloads JAR + graph.obj) |

## Notes

- `graph.obj` (73MB, Izmir GTFS routing graph) and `otp-shaded-2.8.1.jar` (177MB) are downloaded from GitHub Releases during Docker build — they are not in source control (`.railwayignore`).
- Regenerating `graph.obj` requires running OTP with `--build` against updated GTFS feeds.
- Passenger fare multipliers: Student 0.7×, Adult 1.0×, Senior free — applied in the frontend (`HomeScreen.js`), not the backend.
- Geocoding uses Photon API (primary) with Nominatim as fallback, debounced at 3 characters, called directly from the frontend.
- No API keys or secrets are used — İZULAŞ and İZELMAN endpoints are public, unauthenticated APIs.
- Error responses use Turkish user-facing messages (e.g. `"Ulaşım sunucusuna şu an ulaşılamıyor."`).
