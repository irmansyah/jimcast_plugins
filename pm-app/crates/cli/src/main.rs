//! `mypm` — a command-line client covering every CRUD operation the
//! pm-backend API exposes, for scripting/automation alongside the TUI.
//!
//! Examples:
//!   mypm project create --name "Website Revamp" --description "Q4 site refresh"
//!   mypm project list
//!   mypm task create <project_id> --title "Design homepage" --priority high
//!   mypm task update <task_id> --status in_progress
//!   mypm task list <project_id> --json

mod output;

use anyhow::Result;
use clap::{Parser, Subcommand};
use client::ApiClient;
use uuid::Uuid;

#[derive(Parser)]
#[command(
    name = "mypm",
    version,
    about = "Command-line client for the pm-app project management API"
)]
struct Cli {
    /// Base URL of the pm-backend API (falls back to $PM_API_URL, then localhost:8080)
    #[arg(long, global = true)]
    api_url: Option<String>,

    /// Print raw JSON instead of a formatted table
    #[arg(long, global = true)]
    json: bool,

    #[command(subcommand)]
    command: Command,
}

#[derive(Subcommand)]
enum Command {
    /// Create, read, update and delete projects
    Project {
        #[command(subcommand)]
        action: ProjectAction,
    },
    /// Create, read, update and delete tasks
    Task {
        #[command(subcommand)]
        action: TaskAction,
    },
    /// Check that the backend is reachable
    Health,
}

#[derive(Subcommand)]
enum ProjectAction {
    /// List all projects
    List,
    /// Get a single project by id
    Get { id: Uuid },
    /// Create a new project
    Create {
        #[arg(long)]
        name: String,
        #[arg(long)]
        description: Option<String>,
    },
    /// Update a project (only the fields you pass are changed)
    Update {
        id: Uuid,
        #[arg(long)]
        name: Option<String>,
        #[arg(long)]
        description: Option<String>,
        /// planning | active | on_hold | completed | archived
        #[arg(long)]
        status: Option<String>,
    },
    /// Delete a project (cascades to its tasks)
    Delete { id: Uuid },
}

#[derive(Subcommand)]
enum TaskAction {
    /// List tasks belonging to a project
    List { project_id: Uuid },
    /// Get a single task by id
    Get { id: Uuid },
    /// Create a new task in a project
    Create {
        project_id: Uuid,
        #[arg(long)]
        title: String,
        #[arg(long)]
        description: Option<String>,
        /// low | medium | high | urgent (default: medium)
        #[arg(long)]
        priority: Option<String>,
    },
    /// Update a task (only the fields you pass are changed)
    Update {
        id: Uuid,
        #[arg(long)]
        title: Option<String>,
        #[arg(long)]
        description: Option<String>,
        /// todo | in_progress | in_review | done
        #[arg(long)]
        status: Option<String>,
        /// low | medium | high | urgent
        #[arg(long)]
        priority: Option<String>,
    },
    /// Delete a task
    Delete { id: Uuid },
}

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();
    let base_url = cli
        .api_url
        .clone()
        .or_else(|| std::env::var("PM_API_URL").ok())
        .unwrap_or_else(|| "http://127.0.0.1:8080".to_string());
    let client = ApiClient::new(base_url);
    let json = cli.json;

    match cli.command {
        Command::Health => {
            let body = client.health().await?;
            println!("backend reachable \u{2713} ({body})");
        }
        Command::Project { action } => run_project_action(&client, action, json).await?,
        Command::Task { action } => run_task_action(&client, action, json).await?,
    }

    Ok(())
}

async fn run_project_action(client: &ApiClient, action: ProjectAction, json: bool) -> Result<()> {
    match action {
        ProjectAction::List => {
            let projects = client.list_projects().await?;
            output::print_projects(&projects, json);
        }
        ProjectAction::Get { id } => {
            let project = client.get_project(id).await?;
            output::print_project(&project, json);
        }
        ProjectAction::Create { name, description } => {
            let project = client.create_project(name, description).await?;
            if !json {
                println!("Created project {}", project.id);
            }
            output::print_project(&project, json);
        }
        ProjectAction::Update {
            id,
            name,
            description,
            status,
        } => {
            let project = client.update_project(id, name, description, status).await?;
            if !json {
                println!("Updated project {}", project.id);
            }
            output::print_project(&project, json);
        }
        ProjectAction::Delete { id } => {
            client.delete_project(id).await?;
            println!("Deleted project {id}");
        }
    }
    Ok(())
}

async fn run_task_action(client: &ApiClient, action: TaskAction, json: bool) -> Result<()> {
    match action {
        TaskAction::List { project_id } => {
            let tasks = client.list_tasks(project_id).await?;
            output::print_tasks(&tasks, json);
        }
        TaskAction::Get { id } => {
            let task = client.get_task(id).await?;
            output::print_task(&task, json);
        }
        TaskAction::Create {
            project_id,
            title,
            description,
            priority,
        } => {
            let task = client.create_task(project_id, title, description, priority).await?;
            if !json {
                println!("Created task {}", task.id);
            }
            output::print_task(&task, json);
        }
        TaskAction::Update {
            id,
            title,
            description,
            status,
            priority,
        } => {
            let task = client
                .update_task(id, title, description, status, priority)
                .await?;
            if !json {
                println!("Updated task {}", task.id);
            }
            output::print_task(&task, json);
        }
        TaskAction::Delete { id } => {
            client.delete_task(id).await?;
            println!("Deleted task {id}");
        }
    }
    Ok(())
}
