# FloppyDisk — Bank Client Onboarding

A full-stack web application for digital bank client onboarding, developed as part of a university project. 

The application aims to provide a structured onboarding process where onboarding officers enter client information, receive a risk assessment, and accept or reject the client. Agreed risk rules may also trigger an automatic rejection.

---

## Tech Stack

| Technology | Purpose |
| :--- | :--- |
| **React** | Frontend UI |
| **TypeScript** | Frontend type safety |
| **Vite** | Frontend development server |
| **Python** | Backend programming language |
| **FastAPI** | REST API framework |
| **PostgreSQL** | Relational database |
| **Psycopg** | Python PostgreSQL driver |
| **Docker** | Containerization |
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

*Additional folders can be introduced as the project grows.*

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
*Docker Compose uses this variable to configure PostgreSQL.*

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
*This tells the frontend where to find the backend API.*

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
```
Docker Compose will build application images, download PostgreSQL if needed, and start all configured services.

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

| Service | URL | Description |
| :--- | :--- | :--- |
| **Frontend** | [http://localhost:5173](http://localhost:5173) | React application |
| **Backend API** | [http://localhost:8000](http://localhost:8000) | FastAPI server |
| **Main API Swagger Docs** | [http://localhost:8000/docs](http://localhost:8000/docs) | Interactive API documentation |
| **Critical Swagger Docs** | [http://localhost:2424/docs](http://localhost:2424/docs) | Risk calculator API documentation |
| **ReDoc** | [http://localhost:8000/redoc](http://localhost:8000/redoc) | Alternative API documentation |
| **Health Check** | [http://localhost:8000/api/health](http://localhost:8000/api/health) | API health endpoint |
| **API Root** | [http://localhost:8000/](http://localhost:8000/) | API welcome endpoint |
| **PostgreSQL** | `localhost:5432` | Database connection point |
| **Risk Calculator Health** | [http://localhost:2424/health](http://localhost:2424/health) | Risk calculator health endpoint |

> **Note:** PostgreSQL is a database service, not a web server. Connect to it through the backend or a database client (e.g., DBeaver, pgAdmin).  
> The API health endpoint confirms that the FastAPI server responds; it does not guarantee PostgreSQL connectivity.

### Testing the Risk Calculator

From the project root, send a request from inside the API container:

```bash
docker compose exec api python -c "import urllib.request; print(urllib.request.urlopen('http://critical:8000/health', timeout=5).read().decode())"
```

Expected response:

```json
{"status":"ok","service":"risk_calculator"}
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
*(Remember to set `DATABASE_URL` to use `localhost:5432` in `apps/api/.env` when running outside Docker).*

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

| Command | Purpose |
| :--- | :--- |
| `docker compose up -d` | Start services in background |
| `docker compose up -d --build` | Rebuild images and start services |
| `docker compose down` | Stop and remove containers |
| `docker compose ps` | Show status of running services |
| `docker compose logs -f` | Follow combined logs |
| `docker compose restart api` | Restart backend service |
| `docker compose restart web` | Restart frontend service |
| `docker compose restart critical` | Restart risk calculator service |
| `docker compose build api` | Build backend Docker image |
| `docker compose build web` | Build frontend Docker image |
| `docker compose build critical` | Build risk calculator Docker image |

The Python services copy their code into their Docker images. Rebuild and recreate the affected service after source or dependency changes; restarting alone does not include those changes.

> ⚠️ **Warning:** Running `docker compose down -v` will remove named volumes and **permanently delete** your local PostgreSQL data.

---

## Database Access & Guidelines

The backend will connect to PostgreSQL using `psycopg`. Database operations will use raw parameterized SQL statements rather than an ORM. This integration is not implemented in the current skeleton.

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
- **Dependencies:** Each Python service has its own `requirements.txt`, currently containing `fastapi` and `uvicorn[standard]`. Add `psycopg` to the backend when implementing database access.

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