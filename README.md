# SGG Hero Configurator

## Description
This project contains a two-part (server + client) hero configurator application.
The server is designed to run as a dockerized container, while the client is built
into a static HTML bundle to be hosted on a CDN.

## Tech Stack
- **Client (Frontend)**: Lit (Web Components framework), TypeScript, Vite (Bundler).
- **Server (Backend)**: Node.js, Express, TypeScript, SQLite (node:sqlite), Docker.

## Notable features
- **Real-Time Synchronization (SSE)**: Uses Server-Sent Events (`/api/heroes/stream`) to broadcast data change notifications to all connected clients, backed by a 10-second heartbeat ping with client-side disconnect detection.
- **Incremental Delta Sync & Reconciliation**: Queries only heroes updated since the client's last timestamp (`?lastUpdated=...`) and reconciles active UUIDs to handle additions, updates, and deletions with minimal network overhead.
- **Client-Side Caching (LocalStorage)**: Persists hero data to the browser's `localStorage` for fast application startup, followed by background synchronization with the server.
- **Lightweight Web Components (Lit + TypeScript)**: Native Web Components without bloated framework like React
- **Data Validation & Sanitization**: Character whitelisting, string length checks, and numeric boundary constraints enforced on both client and server.
- **Zero-Dependency Native SQLite**: Uses Node 22 native `node:sqlite` (`DatabaseSync`) without native compilation dependencies.

## How to Build for Local Development

### Requirements
- Python
- Docker
- Node.js v22.5+

### Installation & Start
From the root folder, run:
```bash
python start_dev_env.py
```
*Note: The SQLite database on the backend auto-seeds itself with 35 heroes upon the first boot.*

## How to Publish & Deploy

### 1. Deploying the Frontend (Client)
The client application is bundled into static HTML/CSS/JS and can be hosted
on any static hosting or CDN service (e.g., AWS S3 + CloudFront, Vercel, Netlify,
or an internal corporate CDN).

**Build Steps:**
1. Navigate to the client directory: `cd client`
2. Install dependencies: `npm install`
3. Set the production environment variable pointing to your deployed backend.
For example with `.env` file:
```bash
VITE_API_BASE_URL=https://api.your-backend-server.com
```
4. Build the project: `npm run build`
5. Upload the generated `dist/` directory to your static hosting provider.

### 2. Deploying the Backend (Server)
The backend is dockerized and ready to be deployed to any container orchestration
service (e.g., AWS ECS, Docker Swarm, Kubernetes) or a basic VPS running Docker.

**Build & Run Steps:**
1. Go to server directory: `cd server`
2. Create an `.env` file containing your production settings.

.env should setup CORS policy using comma-separated string of domain names
```env
ALLOWED_CORS_DOMAINS=http://localhost:5173,https://your-frontend-domain.com
```

Optionally you can override defaut server port and database path
```env
PORT=3000
DB_PATH=/app/data/database.sqlite
```
3. Build and start docker container in detached mode using Docker Compose:
```bash
docker compose up -d --build
```
4. make sure server environment exposes port `3000` (or one you specified in .env)
to your reverse proxy (e.g., NGINX) and is secured behind HTTPS.
