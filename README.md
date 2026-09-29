# Data Merge

Data Merge is a private dataset management platform designed to organize, validate, upload, merge, and manage image datasets and their associated metadata.

The project is structured as a monorepo with a Next.js frontend, TypeScript backend, PostgreSQL database, shared UI components, shared types, centralized configuration, and filesystem-based dataset storage.

## Features

* **Monorepo Architecture:** Uses [pnpm](https://pnpm.io/) and [Turbo](https://turbo.build/) for dependency management, workspace management, builds, and development workflows.
* **Frontend Application:** A [Next.js](https://nextjs.org/) application built with [React](https://react.dev/) and [TypeScript](https://www.typescriptlang.org/) for the web interface.
* **Backend Service:** A [Node.js](https://nodejs.org/) and [TypeScript](https://www.typescriptlang.org/) backend using Fastify for API handling, authentication, dataset processing, metadata management, and storage operations.
* **PostgreSQL Database:** Uses PostgreSQL for application state, authentication sessions, clients, views, metadata, and dataset management.
* **Dataset Management:** Supports dataset upload, validation, metadata generation, duplicate detection, annotation merging, and dataset history.
* **Client and View Management:** Organizes datasets and metadata by client and view.
* **Role-Based Access Control:** Supports `admin`, `editor`, `viewer`, and `pending` user roles with backend-enforced permissions.
* **Shared UI Component Library:** A reusable UI package in `packages/ui` based on [shadcn/ui](https://ui.shadcn.com/).
* **Structured Data Storage:** Uses `data/raw` for raw dataset files and `data/metadata` for metadata and processed information.
* **Centralized Configuration:** Shared ESLint and TypeScript configurations are maintained under `packages/config`.
* **Theming:** Shared styling and theme configuration are maintained under `packages/theme`.

## Tech Stack

### Monorepo

* [pnpm](https://pnpm.io/)
* [Turbo](https://turbo.build/)

### Frontend

* [Next.js](https://nextjs.org/)
* [React](https://react.dev/)
* [TypeScript](https://www.typescriptlang.org/)
* [Tailwind CSS](https://tailwindcss.com/)

### Backend

* [Node.js](https://nodejs.org/)
* [TypeScript](https://www.typescriptlang.org/)
* [Fastify](https://fastify.dev/)

### Database

* PostgreSQL
* `pgcrypto`

### UI

* [shadcn/ui](https://ui.shadcn.com/)
* [Lucide](https://lucide.dev/)
* Tailwind CSS

### Tooling

* [ESLint](https://eslint.org/)
* [Prettier](https://prettier.io/)
* TypeScript

## Requirements

Install the following before setting up the project:

* Node.js
* pnpm
* PostgreSQL
* Git

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/theharshalchaudhari/data-merge.git
cd data-merge
```

### 2. Install Dependencies

This project uses `pnpm` as its package manager.

If pnpm is not installed:

```bash
npm install -g pnpm
```

Then install the project dependencies:

```bash
pnpm install
```

---

# PostgreSQL Setup

The backend uses a PostgreSQL database named:

```text
data_manage
```

The complete database schema is defined in:

```text
apps/backend/src/db/migrations/001_initial.sql
```

The SQL migration creates the required database tables, relationships, indexes, triggers, and initial database configuration.

## 1. Start PostgreSQL

### Windows

If PostgreSQL was installed using the official Windows installer, PostgreSQL normally runs as a Windows service.

Check the PostgreSQL service from PowerShell:

```powershell
Get-Service postgresql*
```

If the service is stopped, start the PostgreSQL service shown by the previous command:

```powershell
Start-Service <postgresql-service-name>
```

For example:

```powershell
Start-Service postgresql-x64-18
```

You can also manage the PostgreSQL service through:

```text
Windows
→ Services
→ PostgreSQL
```

### Linux — systemd

For distributions using `systemd`:

```bash
sudo systemctl start postgresql
sudo systemctl status postgresql
```

### Linux — other PostgreSQL service names

Some Linux distributions or PostgreSQL installations use a version-specific service name.

Find the available PostgreSQL services:

```bash
systemctl list-units --type=service | grep -i postgres
```

Then start the PostgreSQL service shown by the command.

### macOS — Homebrew

If PostgreSQL was installed using Homebrew:

```bash
brew services start postgresql
```

Check the service:

```bash
brew services list | grep postgres
```

---

## 2. Create the Database

The database must be named:

```text
data_manage
```

### Windows

From PowerShell:

```powershell
createdb -U postgres data_manage
```

Enter the PostgreSQL `postgres` user password when prompted.

Alternatively, open PostgreSQL:

```powershell
psql -U postgres
```

Then:

```sql
CREATE DATABASE data_manage;
```

Exit:

```sql
\q
```

### Linux

For standard PostgreSQL installations using the `postgres` system user:

```bash
sudo -u postgres createdb data_manage
```

### macOS — Homebrew

If PostgreSQL uses the current macOS user:

```bash
createdb data_manage
```

If your installation uses the `postgres` database user:

```bash
createdb -U postgres data_manage
```

---

## 3. Apply the Database Schema

The migration file is:

```text
apps/backend/src/db/migrations/001_initial.sql
```

Run the migration from the project root.

### Windows

PowerShell:

```powershell
psql -U postgres -d data_manage -f ".\apps\backend\src\db\migrations\001_initial.sql"
```

If `psql` is not available in PATH, use the PostgreSQL installation path.

For PostgreSQL 18:

```powershell
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -d data_manage -f ".\apps\backend\src\db\migrations\001_initial.sql"
```

### Linux

```bash
sudo -u postgres psql -d data_manage -f ./apps/backend/src/db/migrations/001_initial.sql
```

If your PostgreSQL installation uses a different database user or authentication method, use the corresponding `psql` command for that installation.

### macOS

Homebrew PostgreSQL:

```bash
psql -d data_manage -f ./apps/backend/src/db/migrations/001_initial.sql
```

If using the `postgres` database user:

```bash
psql -U postgres -d data_manage -f ./apps/backend/src/db/migrations/001_initial.sql
```

---

## 4. Verify the Database

Open the database.

### Windows

```powershell
psql -U postgres -d data_manage
```

### Linux

```bash
sudo -u postgres psql -d data_manage
```

### macOS

```bash
psql -d data_manage
```

Then inside `psql`:

```sql
\dt
```

The database should contain the application's required tables.

Check the global classes:

```sql
SELECT class_id, class_name
FROM classes
ORDER BY class_id;
```

Exit PostgreSQL:

```sql
\q
```

---

# Reinitializing the Database

For a completely fresh development database, the existing database can be removed and recreated.

> **Warning:** This permanently deletes all data stored in `data_manage`.

## Windows

From PowerShell:

```powershell
dropdb -U postgres data_manage
createdb -U postgres data_manage
psql -U postgres -d data_manage -f ".\apps\backend\src\db\migrations\001_initial.sql"
```

If the database has active connections, terminate them first:

```powershell
psql -U postgres -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'data_manage' AND pid <> pg_backend_pid();"
```

Then run:

```powershell
dropdb -U postgres data_manage
createdb -U postgres data_manage
psql -U postgres -d data_manage -f ".\apps\backend\src\db\migrations\001_initial.sql"
```

## Linux — standard PostgreSQL/systemd

```bash
sudo -u postgres dropdb data_manage
sudo -u postgres createdb data_manage
sudo -u postgres psql -d data_manage -f ./apps/backend/src/db/migrations/001_initial.sql
```

If the database has active connections:

```bash
sudo -u postgres psql -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'data_manage' AND pid <> pg_backend_pid();"
```

Then repeat the drop, create, and migration commands.

## macOS — Homebrew

```bash
dropdb data_manage
createdb data_manage
psql -d data_manage -f ./apps/backend/src/db/migrations/001_initial.sql
```

If using the `postgres` database user:

```bash
dropdb -U postgres data_manage
createdb -U postgres data_manage
psql -U postgres -d data_manage -f ./apps/backend/src/db/migrations/001_initial.sql
```

---

# Environment Configuration

Create the required environment configuration for the backend.

Example:

```env
NODE_ENV=development

BACKEND_PORT=4000

DATABASE_URL=postgresql://postgres:password@localhost:5432/data_manage

DATA_ROOT=

SESSION_SECRET=change-this-to-a-long-random-secret

SESSION_COOKIE_NAME=data_manage_session

MAX_UPLOAD_SIZE_MB=2048

NEXT_PUBLIC_API_URL=http://localhost:4000

ADMIN_NAME=Administrator
ADMIN_USERNAME=admin
ADMIN_EMAIL=admin@cms.com
ADMIN_PASSWORD=change-this-password
```

Do not commit real credentials, passwords, API keys, or session secrets to Git.

---

# Development

From the project root:

```bash
pnpm dev
```

This starts the development applications through Turbo.

## Frontend

The frontend is available at:

```text
http://localhost:3000
```

## Backend

The backend is available at:

```text
http://localhost:4000
```

## Backend Health Check

Open:

```text
http://localhost:4000/health
```

The endpoint should return a successful health response.

---

# Production Build

Build the complete monorepo:

```bash
pnpm build
```

---

# Project Structure

```text
data-merge/
│
├── apps/
│   ├── backend/
│   │   ├── src/
│   │   │   ├── config/
│   │   │   ├── db/
│   │   │   │   ├── client.ts
│   │   │   │   └── migrations/
│   │   │   │       └── 001_initial.sql
│   │   │   │
│   │   │   ├── modules/
│   │   │   │   ├── auth/
│   │   │   │   ├── clients/
│   │   │   │   ├── classes/
│   │   │   │   ├── dashboard/
│   │   │   │   ├── datasets/
│   │   │   │   ├── download/
│   │   │   │   ├── metadata/
│   │   │   │   ├── upload/
│   │   │   │   ├── users/
│   │   │   │   └── views/
│   │   │   │
│   │   │   ├── storage/
│   │   │   ├── validation/
│   │   │   ├── websocket/
│   │   │   ├── app.ts
│   │   │   └── server.ts
│   │   │
│   │   └── package.json
│   │
│   └── frontend/
│       ├── app/
│       ├── components/
│       ├── hooks/
│       ├── lib/
│       └── package.json
│
├── data/
│   ├── raw/
│   └── metadata/
│
├── packages/
│   ├── config/
│   │   ├── eslint-config/
│   │   └── typescript-config/
│   │
│   ├── theme/
│   ├── types/
│   └── ui/
│
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── security.md
├── setup-implementation.sh
├── turbo.json
└── README.md
```

---

# Data Storage

## Raw Data

Raw uploaded datasets are stored under:

```text
data/raw/
```

The original dataset folder structure is preserved.

Example:

```text
data/raw/
└── CLIENT/
    └── DATASET/
        ├── image001.jpg
        ├── image001.txt
        ├── image002.jpg
        └── image002.txt
```

## Metadata

Processed metadata is stored under:

```text
data/metadata/
```

Metadata is also maintained through the backend and PostgreSQL database.

---

# Dataset Upload

The dataset upload workflow performs:

1. Dataset folder selection
2. Folder structure detection
3. Image and annotation file detection
4. Image and annotation pairing
5. Annotation validation
6. Client selection
7. View selection
8. Dataset configuration
9. Dataset upload
10. Metadata processing
11. Upload history recording

The upload interface is available through the dashboard.

---

# Authentication and Authorization

The application uses session-based authentication.

Supported roles:

```text
admin
editor
viewer
pending
```

## Permissions

| Action                     | Admin | Editor | Viewer |
| -------------------------- | :---: | :----: | :----: |
| View clients and views     |  Yes  |   Yes  |   Yes  |
| Create/edit/delete clients |  Yes  |   Yes  |   No   |
| Create/edit/delete views   |  Yes  |   Yes  |   No   |
| Upload datasets            |  Yes  |   Yes  |   No   |
| Edit/rename/delete data    |  Yes  |   Yes  |   No   |
| View metadata              |  Yes  |   Yes  |   Yes  |
| Download metadata          |  Yes  |   Yes  |   Yes  |
| Raw dataset operations     |  Yes  |   Yes  |   No   |
| Manage users               |  Yes  |   No   |   No   |

Authorization is enforced by the backend. Frontend controls are additionally hidden when the current user does not have permission.

---

# Useful Commands

## Install Dependencies

```bash
pnpm install
```

## Start Development

```bash
pnpm dev
```

## Build

```bash
pnpm build
```

## Lint

```bash
pnpm lint
```

## Format

```bash
pnpm format
```

---

# PostgreSQL Commands

## Start PostgreSQL

### Windows

Check the service:

```powershell
Get-Service postgresql*
```

Start the appropriate service:

```powershell
Start-Service <postgresql-service-name>
```

### Linux — systemd

```bash
sudo systemctl start postgresql
```

Check status:

```bash
sudo systemctl status postgresql
```

### Linux — other service names

```bash
systemctl list-units --type=service | grep -i postgres
```

### macOS — Homebrew

```bash
brew services start postgresql
```

---

## Stop PostgreSQL

### Windows

```powershell
Stop-Service <postgresql-service-name>
```

### Linux — systemd

```bash
sudo systemctl stop postgresql
```

### macOS — Homebrew

```bash
brew services stop postgresql
```

---

## Restart PostgreSQL

### Windows

```powershell
Restart-Service <postgresql-service-name>
```

### Linux — systemd

```bash
sudo systemctl restart postgresql
```

### macOS — Homebrew

```bash
brew services restart postgresql
```

---

## Open the Database

### Windows

```powershell
psql -U postgres -d data_manage
```

### Linux

```bash
sudo -u postgres psql -d data_manage
```

### macOS

```bash
psql -d data_manage
```

---

## List Databases

Inside `psql`:

```sql
\l
```

---

## List Tables

Inside `psql`:

```sql
\dt
```

---

## Check Current Database

```sql
SELECT current_database();
```

---

## Exit PostgreSQL

```sql
\q
```

---

# Git Workflow

Create a feature branch:

```bash
git checkout -b feature/your-feature
```

Check the working tree:

```bash
git status
```

Stage changes:

```bash
git add .
```

Commit changes:

```bash
git commit -m "feat: describe change"
```

Push the branch:

```bash
git push -u origin feature/your-feature
```

For collaborative development, open a pull request after pushing the branch.

---

# Contributing

Contributions should follow the existing project architecture and coding conventions.

Before submitting a pull request:

1. Install dependencies.
2. Start the development environment.
3. Verify the affected functionality.
4. Run linting.
5. Run the production build.
6. Verify database changes when applicable.
7. Update the database migration when required.
8. Do not commit credentials or environment secrets.

## Reporting Bugs

When reporting a bug, include:

* Description of the issue
* Steps to reproduce
* Expected behavior
* Actual behavior
* Relevant logs
* Environment information

## Suggesting Features

For feature requests, include:

* Problem being solved
* Proposed solution
* Expected behavior
* Required API changes
* Required database changes
* UI changes, if applicable

Please refer to `security.md` for security vulnerability reporting.

---

# Security

Do not commit any of the following:

* Database passwords
* Session secrets
* API keys
* Authentication credentials
* Production environment files
* Private dataset credentials

Use environment variables for sensitive configuration.

For security vulnerabilities, follow the process documented in:

```text
security.md
```

---

# License

This project does not currently specify a license.
