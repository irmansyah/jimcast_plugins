> **Verified:** the full workspace (`domain`, `application`, `infrastructure`, `backend`, `tui`) compiles cleanly with zero warnings. The committed `Cargo.lock` pins a known-good dependency set — just run `cargo build --workspace` as-is.

# pm-app — Project Management (Ratatui TUI + Axum/Redis/Sqlx backend)

A project/task management tool with a Rust TUI frontend (Ratatui) and a
REST backend (Axum + SQLx/Postgres + Redis), organized as a Cargo
workspace using **Clean Architecture**.

## Architecture

```
crates/
  domain/          Entities (Project, Task), value objects (statuses,
                    priority), and repository/cache PORTS (traits only).
                    Zero framework dependencies.

  application/      Use cases (CreateProject, ListTasks, ...) that
                    orchestrate domain ports. No sqlx/redis/axum here —
                    only trait objects (Arc<dyn ProjectRepository>, etc).

  infrastructure/   ADAPTERS implementing the domain ports:
                      - persistence/postgres  -> SQLx repository impls
                      - persistence/cache     -> Redis CachePort impl
                      - http                  -> Axum routes/handlers/DTOs
                    This is the only crate that knows about Postgres,
                    Redis or Axum concretely.

  backend/          Composition root (binary). Reads env config, builds
                    the Postgres pool + Redis client, wires adapters into
                    use cases, and starts the Axum server. Owns SQL
                    migrations.

  tui/              Ratatui client (binary). Talks to the backend only
                    over HTTP via reqwest — it has no dependency on the
                    domain/application/infrastructure crates, matching
                    how a real external client would integrate.
```

Dependency direction is strictly inward:
`infrastructure -> application -> domain`, with `backend` and `tui` as
outermost composition/delivery layers.

## Running it

### 1. Start Postgres + Redis

```bash
docker compose up -d
```

### 2. Configure environment

```bash
cp .env.example .env
```

### 3. Run the backend

```bash
cargo run -p backend
```

This runs the SQL migrations automatically on startup and serves the API
on `http://localhost:8080` (see `crates/backend/migrations/0001_init.sql`).

### 4. Run the TUI client (in another terminal)

```bash
cargo run -p tui
```

## API

| Method | Path                              | Description               |
|--------|-----------------------------------|----------------------------|
| GET    | /api/projects                     | List projects (cached)    |
| POST   | /api/projects                     | Create project             |
| GET    | /api/projects/:id                 | Get project                 |
| PATCH  | /api/projects/:id                 | Update project              |
| DELETE | /api/projects/:id                 | Delete project              |
| GET    | /api/projects/:project_id/tasks   | List tasks in project (cached) |
| POST   | /api/projects/:project_id/tasks   | Create task                 |
| GET    | /api/tasks/:id                    | Get task                     |
| PATCH  | /api/tasks/:id                    | Update task (status/priority/etc) |
| DELETE | /api/tasks/:id                    | Delete task                  |

Project/task list reads use a Redis cache-aside pattern (30s TTL);
writes invalidate the relevant cache key.

## TUI keybindings

**Projects screen:** `↑/k ↓/j` navigate · `Enter` open tasks · `n` new
project · `d` delete · `r` refresh · `q` quit

**Tasks screen:** `↑/k ↓/j` navigate · `Enter`/`Space` advance status
(todo → in_progress → in_review → done) · `n` new task · `d` delete ·
`Esc`/`Backspace` back · `q` quit

## Extending

- Add auth: introduce a `User` entity in `domain`, a JWT middleware in
  `infrastructure::http`, and thread `user_id` through use cases.
- Swap Postgres for another store: implement `ProjectRepository`/
  `TaskRepository` in a new `infrastructure::persistence::*` module —
  `application` and `domain` don't change.
- Add project members, comments, due dates: extend the `Task`/`Project`
  entities, migrations, DTOs, and use cases following the same pattern.
