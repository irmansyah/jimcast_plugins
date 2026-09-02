> **Verified:** the full workspace (`domain`, `application`, `infrastructure`, `backend`, `client`, `tui`, `cli`) compiles cleanly with zero warnings, and `pm-backend` + `mypm` were run end-to-end against real Postgres/Redis instances (project/task create, list, update, status transitions, cache invalidation, delete, and 404 handling all verified). The committed `Cargo.lock` pins a known-good dependency set — just run `cargo build --workspace` as-is.

# pm-app — Project Management (Ratatui TUI + Axum/Redis/Sqlx backend + CLI)

A project/task management tool with a **Trello/Notion-style TUI**
(Ratatui), a **command-line client** (`mypm`) for scripting, and a REST
backend (Axum + SQLx/Postgres + Redis) — all organized as a Cargo
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

  backend/          Composition root (binary: pm-backend). Reads env
                    config, builds the Postgres pool + Redis client,
                    wires adapters into use cases, and starts the Axum
                    server. Owns SQL migrations.

  client/           Shared REST client (library). Speaks the backend's
                    public JSON contract over HTTP via reqwest — this is
                    what a real external integration would depend on.
                    Used by both `tui` and `cli` so they never duplicate
                    request/response logic.

  tui/              Ratatui client (binary: pm-tui). A Trello/Notion-
                    style board rendered in the terminal — see below.

  cli/              Scriptable command-line client (binary: mypm),
                    covering every CRUD operation for automation/CI use.
```

Dependency direction is strictly inward:
`infrastructure -> application -> domain`, with `backend`, `client`,
`tui` and `cli` as outermost composition/delivery layers. Note that
`tui`/`cli` depend only on `client` — never on `domain`/`application`/
`infrastructure` — the same as any third-party integration would.

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

### 4a. Run the TUI (Kanban board)

```bash
cargo run -p tui
```

### 4b. Or use the CLI

```bash
cargo run -p cli -- project create --name "Website Revamp"
# or, once built:
./target/debug/mypm project list
```

## The TUI: a Trello/Notion-style board, in your terminal

**Projects screen** — each project renders as its own rounded card, not
a plain list row: name in the title bar, a colored status badge
(top-right), and a description preview. The card border and badge color
map to project status (planning = lavender, active = green, on hold =
amber, completed = blue, archived = slate).

**Tasks screen** — a real 4-column Kanban board (`To Do` · `In Progress`
· `In Review` · `Done`), each column color-coded by status. Every task
is its own small card inside its column, with the card border colored
by **priority** (low = green, medium = blue, high = amber, urgent =
red) so you can scan urgency at a glance, Trello-label style. The
focused card gets a bold double border.

Creating a task opens a colored priority-chip picker (like choosing a
Trello label) before the card is added to the board.

### TUI keybindings

**Projects screen:** `↑/k ↓/j` move between cards · `Enter` open board ·
`n` new project · `d` delete · `r` refresh · `q` quit

**Tasks screen (Kanban board):** `←/h →/l` move between columns ·
`↑/k ↓/j` move between cards in a column · `Enter`/`Space` advance a
task to the next status · `n` new task (title, then pick a priority
chip with `1`-`4` or `←/→` + `Enter`) · `d` delete · `Esc`/`Backspace`
back to projects · `q` quit

## The CLI: `mypm`

Full CRUD for both projects and tasks, for scripting or CI, sharing the
exact same HTTP client as the TUI.

```bash
# Base URL resolution: --api-url flag > $PM_API_URL > http://127.0.0.1:8080

# Projects
mypm project list [--json]
mypm project get <id>
mypm project create --name "Website Revamp" [--description "..."]
mypm project update <id> [--name ...] [--description ...] [--status planning|active|on_hold|completed|archived]
mypm project delete <id>

# Tasks
mypm task list <project_id> [--json]
mypm task get <id>
mypm task create <project_id> --title "Design homepage" [--description ...] [--priority low|medium|high|urgent]
mypm task update <id> [--title ...] [--description ...] [--status todo|in_progress|in_review|done] [--priority ...]
mypm task delete <id>

# Health check
mypm health
```

Every subcommand supports `--json` for machine-readable output (handy
for piping into `jq` or other scripts):

```bash
PROJECT_ID=$(mypm project create --name "Launch" --json | jq -r .id)
mypm task create "$PROJECT_ID" --title "Write announcement" --priority high --json
```

Run `mypm --help`, `mypm project --help`, or `mypm task create --help`
for full argument reference at any time.

## API

| Method | Path                              | Description               |
|--------|-----------------------------------|----------------------------|
| GET    | /health                           | Liveness check              |
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

## Extending

- Add auth: introduce a `User` entity in `domain`, a JWT middleware in
  `infrastructure::http`, and thread `user_id` through use cases. Both
  `client` (add an auth header/token) and `cli` (a `--token`/config
  file) would need a small follow-up change.
- Swap Postgres for another store: implement `ProjectRepository`/
  `TaskRepository` in a new `infrastructure::persistence::*` module —
  `application` and `domain` don't change.
- Add project members, comments, due dates: extend the `Task`/`Project`
  entities, migrations, DTOs, `client` models, and use cases following
  the same pattern.
- Add a new delivery mechanism (e.g. a web UI): depend on `client` the
  same way `tui`/`cli` do — no backend changes needed.
