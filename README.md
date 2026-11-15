# FloppyDisk — Bank Client Onboarding

A full-stack web application for digital bank client onboarding, developed as part of a university project.

The application aims to provide a structured onboarding process where onboarding officers enter client information, receive a risk assessment, and accept or reject the client. Agreed risk rules may also trigger an automatic rejection.

---

## Tech Stack

| Technology         | Purpose                       |
| :----------------- | :---------------------------- |
| **React**          | Frontend UI                   |
| **TypeScript**     | Frontend type safety          |
| **Vite**           | Frontend development server   |
| **Python**         | Backend programming language  |
| **FastAPI**        | REST API framework            |
| **PostgreSQL**     | Relational database           |
| **Psycopg**        | Python PostgreSQL driver      |
| **Docker**         | Containerization              |
| **Docker Compose** | Multi-container orchestration |

> **Note:** The backend is planned to use Python and Psycopg to communicate directly with PostgreSQL via plain SQL. SQLAlchemy and Alembic are intentionally not used.

---

## Project Structure

```text
FloppyDisk/
├── apps/
│   ├── web/
│   │   ├── src/
│   │   │   ├── components/
│   │   │   ├── features/
│   │   │   ├── lib/
│   │   │   ├── App.tsx
│   │   │   └── main.tsx
│   │   ├── .env
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   └── README.md
│   │
│   ├── api/
│   │   ├── app/
│   │   │   ├── core/
│   │   │   │   └── config.py
│   │   │   ├── db/
│   │   │   │   └── connection.py
│   │   │   ├── routes/
│   │   │   │   ├── __init__.py
│   │   │   │   └── health.py
│   │   │   ├── main.py
│   │   │   └── router.py
│   │   ├── tests/
│   │   ├── .env
│   │   ├── Dockerfile
│   │   └── requirements.txt
│   │
│   └── critical/
│       ├── app/
│       │   ├── main.py
│       │   ├── router.py
│       │   └── scoring.py
│       ├── Dockerfile
│       └── requirements.txt
│
├── docker-compose.yml
├── .env
├── .gitignore
└── README.md
```

_Additional folders can be introduced as the project grows._

The frontend/backend tree includes planned folders. The new `critical` service currently contains `main.py`, `router.py`, and the empty `scoring.py` placeholder.

---

## Architecture

```text
Browser
   |
   v
React + Vite
localhost:5173
   |
   | HTTP / JSON
   v
FastAPI --------------------> Risk Calculator
localhost:8000   HTTP / JSON   critical:8000 (Docker network)
   |
   | Psycopg
   v
PostgreSQL
localhost:5432
```

The frontend will communicate with the backend through HTTP requests. The backend will validate requests, call the risk calculator, implement business logic, and execute SQL queries against PostgreSQL.

The frontend **never** connects directly to the database.

The risk calculator runs as a separate Docker Compose service named `critical`:

- `main.py` creates the FastAPI application and registers the router.
- `router.py` defines HTTP endpoints, currently `GET /health`.
- `scoring.py` will contain the risk calculation rules and is currently empty.

The backend and risk calculator can both use port `8000` because they run in separate containers. The risk calculator is published on host port `2424`, making its health endpoint and Swagger UI accessible from the host. Scoring and the backend's scoring integration are not implemented yet.

---

## Prerequisites

Before getting started, make sure you have installed:

- [Git](https://git-scm.com/)
- [Node.js](https://nodejs.org/)
- [Python](https://www.python.org/)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)

> **Important:** Docker Desktop must be running before starting the containers.

---

## Environment Variables

### Root `.env`

**Location:** `FloppyDisk/.env`

```env
POSTGRES_PASSWORD=your_local_dev_password
```

_Docker Compose uses this variable to configure PostgreSQL._

### Backend `.env`

**Location:** `FloppyDisk/apps/api/.env`

```env
DATABASE_URL=postgresql://bank_user:your_local_dev_password@db:5432/bank_onboarding
APP_ENV=development
```

- The hostname `db` is used when the backend runs inside Docker Compose.
- When running the backend directly on your computer (outside Docker), replace `db` with `localhost`.
- `DATABASE_URL` is a connection string that the Python application will read from its environment to establish a connection using Psycopg.
- Docker Compose also sets `RISK_SERVICE_URL=http://critical:8000` for the backend. This is the address the backend will use to call the risk calculator.

### Frontend `.env`

**Location:** `FloppyDisk/apps/web/.env`

```env
VITE_API_URL=http://localhost:8000/api
```

_This tells the frontend where to find the backend API._

> ⚠️ **Security Warning:** Never put database passwords or secrets in frontend environment variables. Variables prefixed with `VITE_` are exposed to the browser. Do not commit real `.env` files to Git; use `.env.example` files containing placeholder values for teammates.

### Risk Calculator

The `critical` service does not currently need a `.env` file. Its Docker Compose configuration has no `env_file` entry.

---

## Getting Started

### 1. Configure Environment

Create the root, backend, and frontend `.env` files as described above. Ensure the database password in the backend connection URL matches `POSTGRES_PASSWORD` in the root `.env`.

### 2. Start All Docker Services

IF YOU ARE USING WINDOWS PLEASE HAVE DOCKER DESKTOP INSTALLED AND OPENEND IN THE BACKGROUND

On Windows, double click `start.bat` in the file explorer. It builds and starts the services, then opens the frontend and both Swagger pages in your browser.

On Linux or macOS, run `bash start.sh` from the project root. It builds and starts the services, then opens the frontend and both Swagger pages in your browser.

If you want to do it manually, follow these instructions:

From the project root:

```bash
docker compose config
docker compose up -d --build
py apps/api/migrations/apply.py  # Windows
# or: python3 apps/api/migrations/apply.py  # Linux/macOS
```

Docker Compose will build application images, download PostgreSQL if needed, and start all configured services. The migration runner applies pending numbered SQL files and records them in `schema_migrations`, so rerunning it skips completed migrations. The `start.bat` and `start.sh` scripts run this migration step automatically after PostgreSQL is ready.

For an existing database created by an earlier version of the startup scripts, the runner detects the current schema and seeded reference data before recording those migrations as applied.

Please check the [Local Development URLs](#local-development-urls) to open the application in the browser

### 3. Check Service Status

Verify that containers are running:

```bash
docker compose ps
```

View all logs:

```bash
docker compose logs -f
```

View logs for a specific service:

```bash
docker compose logs -f web
docker compose logs -f api
docker compose logs -f critical
docker compose logs -f db
```

---

## Local Development URLs

| Service                    | URL                                                                  | Description                       |
| :------------------------- | :------------------------------------------------------------------- | :-------------------------------- |
| **Frontend**               | [http://localhost:5173](http://localhost:5173)                       | React application                 |
| **Backend API**            | [http://localhost:8000](http://localhost:8000)                       | FastAPI server                    |
| **Main API Swagger Docs**  | [http://localhost:8000/docs](http://localhost:8000/docs)             | Interactive API documentation     |
| **Critical Swagger Docs**  | [http://localhost:2424/docs](http://localhost:2424/docs)             | Risk calculator API documentation |
| **ReDoc**                  | [http://localhost:8000/redoc](http://localhost:8000/redoc)           | Alternative API documentation     |
| **Health Check**           | [http://localhost:8000/api/health](http://localhost:8000/api/health) | API health endpoint               |
| **API Root**               | [http://localhost:8000/](http://localhost:8000/)                     | API welcome endpoint              |
| **PostgreSQL**             | `localhost:5432`                                                     | Database connection point         |
| **Risk Calculator Health** | [http://localhost:2424/health](http://localhost:2424/health)         | Risk calculator health endpoint   |

> **Note:** PostgreSQL is a database service, not a web server. Connect to it through the backend or a database client (e.g., DBeaver, pgAdmin).  
> The API health endpoint confirms that the FastAPI server responds; it does not guarantee PostgreSQL connectivity.

### Testing the Risk Calculator

From the project root, send a request from inside the API container:

```bash
docker compose exec api python -c "import urllib.request; print(urllib.request.urlopen('http://critical:8000/health', timeout=5).read().decode())"
```

Expected response:

```json
{ "status": "ok", "service": "risk_calculator" }
```

This confirms that the risk service responds across Docker's network. It does not test risk calculation or database access.

---

## Running Without Docker

You can run the frontend, backend, and risk calculator directly on your machine while keeping PostgreSQL inside Docker.

### Start Database Only

From the project root:

```bash
docker compose up -d db
```

### Frontend

```bash
cd apps/web
npm install
npm run dev
```

### Backend

```bash
cd apps/api
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
uvicorn app.main:app --reload --env-file .env
```

_(Remember to set `DATABASE_URL` to use `localhost:5432` in `apps/api/.env` when running outside Docker)._

### Risk Calculator

In a separate terminal, starting from the project root:

```bash
cd apps/critical
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
uvicorn app.main:app --reload --port 8001
```

When both Python services run directly on your computer, use a different port for each. The risk calculator's health endpoint is then [http://localhost:8001/health](http://localhost:8001/health).

For this local setup, add `RISK_SERVICE_URL=http://localhost:8001` to `apps/api/.env`. The backend's `--env-file .env` option loads the file; the application will use this address once scoring integration is implemented.

---

## Docker Commands Cheat Sheet

Run all commands from the project root:

| Command                           | Purpose                            |
| :-------------------------------- | :--------------------------------- |
| `docker compose up -d`            | Start services in background       |
| `docker compose up -d --build`    | Rebuild images and start services  |
| `docker compose down`             | Stop and remove containers         |
| `docker compose ps`               | Show status of running services    |
| `docker compose logs -f`          | Follow combined logs               |
| `docker compose restart api`      | Restart backend service            |
| `docker compose restart web`      | Restart frontend service           |
| `docker compose restart critical` | Restart risk calculator service    |
| `docker compose build api`        | Build backend Docker image         |
| `docker compose build web`        | Build frontend Docker image        |
| `docker compose build critical`   | Build risk calculator Docker image |

The Python services copy their code into their Docker images. Rebuild and recreate the affected service after source or dependency changes; restarting alone does not include those changes.

> ⚠️ **Warning:** Running `docker compose down -v` will remove named volumes and **permanently delete** your local PostgreSQL data.

---

## Database Access & Guidelines

The backend connects to PostgreSQL using `psycopg` and raw parameterized SQL. Officer passwords are verified by the API using salted scrypt hashes stored in `officers.password_hash`. Client submissions require valid officer credentials; weight and risk-value changes additionally require an admin officer. Passwords are never stored in client snapshots.

The local demo officers created by the migrations are:

| Officer     | Internal ID  | Password          | Access           |
| ----------- | ------------ | ----------------- | ---------------- |
| Alice Smith | `0000000000` | `AliceAdmin!2026` | Admin            |
| Bob Jones   | `0000000001` | `BobOfficer!2026` | Standard officer |

These are demo credentials only. Change them before exposing the application beyond a trusted local development environment.

Weight submissions can update weights or risk values independently; risk-value submissions merge only the submitted choices, and `null` explicitly removes a choice. Other database integrations remain unimplemented.

### Example Connection

```python
import os
import psycopg

def get_connection():
    return psycopg.connect(os.environ["DATABASE_URL"])
```

### Best Practices

- **Parameterized Queries:** Always use parameterized SQL queries for user-supplied values to prevent SQL injection. Never concatenate raw strings into SQL queries.
- **Database Migrations:** Schema changes should be managed using version-controlled SQL scripts.
- **Dependencies:** Each Python service has its own `requirements.txt`; the API uses `fastapi`, `uvicorn[standard]`, and `psycopg[binary]`.

---

## Development Guidelines

- **Frontend:** Organize code by feature modules.
- **Backend:** Maintain clear separation between route handlers and core logic.
- **Validation:** Validate all incoming requests on the backend before processing.
- **Transactions:** Handle database connection lifecycles and transactions carefully.
- **Testing:** Include unit and integration tests for API endpoints and domain rules.
- **Data Privacy:** Use **synthetic customer data** during development. Ensure production-grade authentication, authorization, and data encryption are in place before working with real customer data.

---

## Project Status

### Assessment review and final submission

Risk values and calculated scores use a 0-5 scale. Risk values accept up to two
decimal places. Tier thresholds remain unchanged pending BA confirmation:
Low Risk is 0 <= score < 2.50, Medium Risk is 2.50 <= score < 3.75, and High
Risk is 3.75 <= score <= 5. Category weights use 0-5 with up to two decimal
places and a positive total. The analyst's percentages are multiplied by 5:
residence 1.50 (30%), nationality 0.50 (10%), tax domicile 1.00 (20%),
profession 1.25 (25%), and income 0.75 (15%). The calculator normalizes these
relative weights, preserving the percentages exactly.
The initial schema migration defines the 0-5 database constraints. Editing an
already-applied migration does not update an existing database: its constraints
must be updated separately, or the schema recreated on an empty development
database. Existing configuration values and historical decisions are unchanged.

The default configuration in migration 006 now uses `Scoring_Values.xlsx`:
CPI2025 country risk is `5 * (1 - CPI / 100)` for residence, nationality and tax
domicile. 179 of the application's 193 UN countries have CPI values; the other
14 trigger manual review with an unavailable score, not a zero/default risk.
The source's Hong Kong, Taiwan and Kosovo rows are retained in the import but
excluded from the application's UN-country selections. Income risks are
2, 1, 1.5, 3 for the four ascending brackets (the BA confirmed the last is
100k+). Profession risks are Standard 1, Cash-intensive 3.5, High-risk 5.
Missing CPI does not bypass a PEP/sanctions rejection. Manual review preserves
the unavailable score and original configuration version when completed.
As requested, these changes edit migrations 001 and 006 instead of adding a
new migration. Already-applied migrations are skipped by the migration runner.
For an existing development database, explicitly reapply 006 to update the
required column types/constraints and create a new analyst configuration version
while keeping prior versions and decisions. In PowerShell from the repo root:

```powershell
Get-Content -Raw apps/api/migrations/006_default_scoring_configuration.sql | docker compose exec -T db psql -U bank_user -d bank_onboarding -v ON_ERROR_STOP=1
```

Rebuild the API and critical containers for the corresponding code changes.
No existing database is reset automatically.

The frontend sends client details to `POST /api/v1/risk/evaluation`. The API
loads the current configuration, calls `critical`, and returns the score, tier,
factor breakdown, and configuration version. This
step writes no client or assessment records to SQL.

When the officer submits the final decision, the frontend sends the same client
details, officer credentials, and decision to `POST /api/v1/clients`.
The API calls `critical` again with the latest saved configuration and checks
that the decision matches the recalculated tier. If the tier now requires a
different decision, submission returns HTTP 409 and the officer must refresh
the risk review. The API authenticates the officer and saves the address, client,
assessment and evaluated factors in one transaction. The response confirms the
client ID and saved assessment. Browser-supplied scores, tiers and configuration
versions are not used. The saved record uses the version actually used for the
final calculation, including any weights or risk values saved since preview.

For a medium-risk client, submitting "Submit for Manual Review" saves the client
with a pending manual-review decision. In Client viewing, "Complete review"
allows an officer to approve or decline it. This calls
`POST /api/v1/clients/{client_id}/decision`, which checks the saved pending state
and officer credentials, then accepts the reviewer's outcome without calling
`critical` or enforcing an automatic tier decision. It appends a decision record,
preserving the original scoring version, score, breakdown and initial submission.
Concurrent or repeated completion is blocked once the pending review is resolved.

No assessment tokens or signing keys are used. No database migration is needed
for this flow: the existing factor table
stores the evaluated scores and `input_snapshot.assessment` retains the full
breakdown and override reason.

The temporary PEP/sanctions controls are passed to `critical`, which applies
their test override and returns its reason. They are placeholders for future
OpenSanctions screening.

### Scoring-service downtime

The API's `app/cached_scoring.py` contains a local fallback copy of the rules
in `critical/app/scoring.py`. Both report the same rule version. Keep the two
copies in sync when changing scoring logic; shared packaging is deferred.
The API calls `critical` first (five-second timeout). Connection failures,
timeouts, and HTTP 5xx responses use the bundled rules with the latest saved
database configuration. HTTP 4xx responses and malformed scoring results remain
errors rather than being hidden by the fallback. No executable formula is
downloaded; `/v1/formula/` only returns informational metadata.

Fallback responses include `preliminary: true`, `scoringSource: cached`, and
`scoringRuleVersion`. On submission, the API calculates again and saves the
result and preliminary flag together. This final calculation determines the
saved status, even if service availability changed since the review screen.
The assessment snapshot retains the rule version and source. Client viewing
shows both preliminary and confirmed records, labelled with their scoring
status. Completing a manual review accepts the officer's outcome and preserves
the original preliminary flag without calling `critical` again.

Each request tries `critical` again, so new submissions use confirmed results
once it recovers. Previously saved preliminary records are not automatically
recalculated or promoted to confirmed; that follow-up workflow is separate.
When live OpenSanctions screening is added, fallback results must continue to
indicate that live screening could not be completed.

Rebuild both services with `docker compose build api critical`. The original
service directories, requirements files, and Docker build contexts are retained;
no shared package or additional dependency is required.

As with the earlier changes, existing applied migrations are not rerun. An
existing database needs the old constraint prohibiting preliminary decisions
removed before using this feature (no data is deleted):

```sql
ALTER TABLE risk_assessments
    DROP CONSTRAINT IF EXISTS risk_assessments_check,
    DROP CONSTRAINT IF EXISTS risk_assessments_check1,
    DROP CONSTRAINT IF EXISTS risk_assessments_decision_finalized_check;
```

The updated migrations 001 and 006 already handle this for a new database or
when configuration migration 006 is explicitly reapplied.

This project is under active development as part of a university assignment.

**Current Setup:**

- [x] React + Vite frontend bootstrap.
- [x] Python + FastAPI backend setup.
- [x] PostgreSQL container configuration.
- [ ] PostgreSQL integration with Psycopg.
- [x] Dockerfile configurations for all services.
- [x] Docker Compose local orchestration.
- [x] API health check endpoint.
- [x] Separate risk calculator service with a health check endpoint.
- [x] Manual connectivity check from the API container to the risk calculator.

**Upcoming Features:**

- Risk scoring rules and scoring endpoint.
- Backend integration with the risk calculator.
- Risk-service timeout and failure handling.
- Authentication & authorization.
- Multi-step onboarding workflows.
- Document upload and verification management.
- Persistent application processing.

---

## License

Developed for educational purposes as part of a university assignment.
