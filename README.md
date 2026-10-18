# FloppyDisk — Bank Client Onboarding

A full-stack web application for digital bank client onboarding, developed as part of a university project. 

The application aims to provide a structured onboarding process where customers can submit personal information and track their application status.

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

> **Note:** The backend uses Python and Psycopg to communicate directly with PostgreSQL via plain SQL. SQLAlchemy and Alembic are intentionally not used.

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
│   └── api/
│       ├── app/
│       │   ├── core/
│       │   │   └── config.py
│       │   ├── db/
│       │   │   └── connection.py
│       │   ├── routes/
│       │   │   ├── __init__.py
│       │   │   └── health.py
│       │   ├── main.py
│       │   └── router.py
│       ├── tests/
│       ├── .env
│       ├── Dockerfile
│       └── requirements.txt
│
├── docker-compose.yml
├── .env
├── .gitignore
└── README.md
```

*Additional folders can be introduced as the project grows.*

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
FastAPI
localhost:8000
   |
   | Psycopg
   v
PostgreSQL
localhost:5432
```

The frontend communicates with the backend through HTTP requests. The backend validates requests, implements business logic, and executes SQL queries against PostgreSQL.

The frontend **never** connects directly to the database.

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
- `DATABASE_URL` is a connection string that the Python application reads from its environment to establish a connection using Psycopg.

### Frontend `.env`
**Location:** `FloppyDisk/apps/web/.env`

```env
VITE_API_URL=http://localhost:8000/api
```
*This tells the frontend where to find the backend API.*

> ⚠️ **Security Warning:** Never put database passwords or secrets in frontend environment variables. Variables prefixed with `VITE_` are exposed to the browser. Do not commit real `.env` files to Git; use `.env.example` files containing placeholder values for teammates.

---

## Getting Started

### 1. Configure Environment
Create the root, backend, and frontend `.env` files as described above. Ensure the database password in the backend connection URL matches `POSTGRES_PASSWORD` in the root `.env`.

### 2. Start All Docker Services
From the project root:

```bash
docker compose config
docker compose up -d --build
```
Docker Compose will build application images, download PostgreSQL if needed, and start all configured services.

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
docker compose logs -f db
```

---

## Local Development URLs

| Service | URL | Description |
| :--- | :--- | :--- |
| **Frontend** | [http://localhost:5173](http://localhost:5173) | React application |
| **Backend API** | [http://localhost:8000](http://localhost:8000) | FastAPI server |
| **Swagger Docs** | [http://localhost:8000/docs](http://localhost:8000/docs) | Interactive API documentation |
| **ReDoc** | [http://localhost:8000/redoc](http://localhost:8000/redoc) | Alternative API documentation |
| **Health Check** | [http://localhost:8000/api/health](http://localhost:8000/api/health) | API health endpoint |
| **API Root** | [http://localhost:8000/](http://localhost:8000/) | API welcome endpoint |
| **PostgreSQL** | `localhost:5432` | Database connection point |

> **Note:** PostgreSQL is a database service, not a web server. Connect to it through the backend or a database client (e.g., DBeaver, pgAdmin).  
> The API health endpoint confirms that the FastAPI server responds; it does not guarantee PostgreSQL connectivity.

---

## Running Without Docker

You can run the frontend and backend directly on your machine while keeping PostgreSQL inside Docker.

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
uvicorn app.main:app --reload
```
*(Remember to set `DATABASE_URL` to use `localhost:5432` in `apps/api/.env` when running outside Docker).*

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
| `docker compose build api` | Build backend Docker image |
| `docker compose build web` | Build frontend Docker image |

> ⚠️ **Warning:** Running `docker compose down -v` will remove named volumes and **permanently delete** your local PostgreSQL data.

---

## Database Access & Guidelines

The backend connects to PostgreSQL using `psycopg`. Database operations are executed using raw parameterized SQL statements rather than an ORM.

### Example Connection
```python
import os
import psycopg

def get_connection():
    return psycopg.connect(os.environ["DATABASE_URL"])
```

### Best Practices
- **Parameterized Queries:** Always use parameterized SQL queries for user-supplied values to prevent SQL injection. Never concatenate raw strings into SQL queries.
- **Database Migrations:** Schema changes are managed using version-controlled SQL scripts.
- **Dependencies:** Required Python packages are declared in `requirements.txt` (including `fastapi`, `uvicorn`, and `psycopg`).

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
- [x] PostgreSQL integration with Psycopg.
- [x] Dockerfile configurations for all services.
- [x] Docker Compose local orchestration.
- [x] API health check endpoint.

**Upcoming Features:**
- Authentication & authorization.
- Multi-step onboarding workflows.
- Document upload and verification management.
- Persistent application processing.

---

## License

Developed for educational purposes as part of a university assignment.