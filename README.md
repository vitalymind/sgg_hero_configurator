# SGG Hero Configurator

## Description
This project is an end-to-end hero configurator monorepo organized into three parts:
- **Client (`hero_manager_client`)**: A Lit Web Components SPA bundled by Vite.
- **Server (`hero_manager_server`)**: A containerized Express REST API with SQLite.
- **Shared (`@hero_manager/shared`)**: A shared package containing declarative validation schemas (Zod), regexes, constants, and TypeScript types shared between client and server to guarantee zero contract drift.

## Tech Stack
- **Client (Frontend)**: Lit (Web Components), TypeScript, Vite.
- **Server (Backend)**: Node.js 22, Express, TypeScript, Zod, native SQLite (`node:sqlite`), Docker.
- **Shared Package**: TypeScript, Zod.
- **Testing**: Vitest, happy-dom, MSW (Mock Service Worker), V8 Coverage.
- **Monorepo / Workspaces**: npm workspaces.

## Notable Features
- **Shared Declarative Validation**: Zod validation schemas, string regexes, and numeric constraints are declared once in `@hero_manager/shared` and imported by both client and server to eliminate schema drift.
- **Real-Time Synchronization (SSE)**: Uses Server-Sent Events (`/api/heroes/stream`) to broadcast data updates to all connected clients, backed by a 10-second heartbeat ping with client-side disconnect detection.
- **Incremental Delta Sync & Reconciliation**: Queries only heroes updated since the client's last timestamp (`?lastUpdated=...`) and reconciles active UUIDs to handle additions, updates, and deletions with minimal network overhead.
- **Client-Side Caching (LocalStorage)**: Persists hero data to the browser's `localStorage` for fast application startup, followed by background synchronization with the server.
- **Lightweight Web Components (Lit + TypeScript)**: Native Web Components without a heavy framework like React.
- **Native SQLite**: Uses Node 22 native `node:sqlite` (`DatabaseSync`) without native compilation dependencies.

## How to Build for Local Development

### Requirements
- Python 3
- Docker & Docker Compose
- Node.js v22.5+

### Installation & Start
From the repository root:
```bash
python start_dev_env.py
```
*(This automatically runs root `npm install`, compiles `@hero_manager/shared`, starts the Docker container for the server, and launches Vite for the client).*

### Workspace Commands
You can also run tasks from the root:
```bash
# Build all workspaces (shared -> server -> client)
npm run build

# Or build individual packages:
npm run build:shared
npm run build:server
npm run build:client

# Start Vite client independently:
npm run dev:client
```

## Testing

The client suite uses Vitest, happy-dom, and MSW for unit and component testing.

### Running Tests
From the repository root:
```bash
# Run client unit tests
npm run test:run --workspace=hero_manager_client

# Run tests in watch mode
npm run test --workspace=hero_manager_client

# Generate coverage report
npm run test:coverage --workspace=hero_manager_client
```

### Pre-Commit Verification
To verify TypeScript compilation and run tests locally before committing:
```bash
# Run checks manually:
python run_pre_commit.py

# Install automatic Git pre-commit hook:
python install_git_hooks.py
```

### Continuous Integration
GitHub Actions runs typechecking and Vitest tests on every push and pull request to `main` via `.github/workflows/ci.yml`.

## How to Publish & Deploy

### 1. Deploying the Frontend (Client)
The client application is bundled into static HTML/CSS/JS and can be hosted on any static hosting or CDN service (e.g., AWS S3 + CloudFront, Vercel, Netlify, or an internal CDN).

**Build Steps:**
1. From the repository root, install dependencies:
   ```bash
   npm install
   ```
2. Set the production environment variable pointing to your deployed backend in `client/.env`:
   ```bash
   VITE_API_BASE_URL=https://api.your-backend-server.com
   ```
3. Build the client bundle:
   ```bash
   npm run build:client
   ```
4. Upload the generated `client/dist/` directory to your static hosting provider.

### 2. Deploying the Backend (Server)
The backend is dockerized and ready to be deployed to any container orchestration service (e.g., AWS ECS, Docker Swarm, Kubernetes) or a VPS running Docker.

**Build & Run Steps:**
1. Navigate to the server directory: `cd server`
2. Create an `.env` file containing your production settings.

   Set up a CORS policy using a comma-separated string of domain names:
   ```env
   ALLOWED_CORS_DOMAINS=http://localhost:5173,https://your-frontend-domain.com
   ```
   Optionally override the default server port and database path:
   ```env
   PORT=3000
   DB_PATH=/app/data/database.sqlite
   ```
3. Build and start the Docker container using Docker Compose:
   ```bash
   docker compose up -d --build
   ```
4. Make sure the server environment exposes port `3000` (or the one specified in `.env`) to your reverse proxy (e.g., NGINX) and is secured behind HTTPS.
