mod app;
mod config;
mod models_ext;
mod ui;

use std::io;
use std::time::Duration;

use crossterm::{
    event::{self, DisableMouseCapture, EnableMouseCapture, Event, KeyCode, KeyEventKind},
    execute,
    terminal::{disable_raw_mode, enable_raw_mode, EnterAlternateScreen, LeaveAlternateScreen},
};
use ratatui::{backend::CrosstermBackend, Terminal};

use app::{App, InputMode, PriorityChoice, Screen};
use client::ApiClient;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let (config, config_source) = config::Config::load();
    match &config_source {
        Some(path) => eprintln!("pm-tui: loaded config from {}", path.display()),
        None => eprintln!("pm-tui: no config.json found, using built-in defaults"),
    }

    let base_url = std::env::var("PM_API_URL").unwrap_or_else(|_| config.api_base_url.clone());
    let client = ApiClient::new(base_url);
    let mut app = App::new(client, config);
    app.refresh_projects().await;

    enable_raw_mode()?;
    let mut stdout = io::stdout();
    execute!(stdout, EnterAlternateScreen, EnableMouseCapture)?;
    let backend = CrosstermBackend::new(stdout);
    let mut terminal = Terminal::new(backend)?;

    let result = run_app(&mut terminal, &mut app).await;

    disable_raw_mode()?;
    execute!(
        terminal.backend_mut(),
        LeaveAlternateScreen,
        DisableMouseCapture
    )?;
    terminal.show_cursor()?;

    result
}

async fn run_app<B: ratatui::backend::Backend>(
    terminal: &mut Terminal<B>,
    app: &mut App,
) -> anyhow::Result<()> {
    loop {
        terminal.draw(|f| ui::draw(f, app))?;

        if event::poll(Duration::from_millis(200))? {
            if let Event::Key(key) = event::read()? {
                if key.kind != KeyEventKind::Press {
                    continue;
                }
                handle_key(app, key.code).await;
            }
        }

        if app.should_quit {
            break;
        }
    }
    Ok(())
}

async fn handle_key(app: &mut App, key: KeyCode) {
    match app.input_mode {
        InputMode::Normal => handle_normal_key(app, key).await,
        InputMode::NewProjectName => handle_new_project_name_key(app, key).await,
        InputMode::NewProjectDescription => handle_new_project_description_key(app, key).await,
        InputMode::NewTaskTitle => handle_new_task_title_key(app, key).await,
        InputMode::NewTaskPriority => handle_new_task_priority_key(app, key).await,
    }
}

async fn handle_normal_key(app: &mut App, key: KeyCode) {
    match app.screen {
        Screen::Projects => handle_projects_normal_key(app, key).await,
        Screen::Tasks => handle_tasks_normal_key(app, key).await,
    }
}

async fn handle_projects_normal_key(app: &mut App, key: KeyCode) {
    match key {
        KeyCode::Char('q') => app.should_quit = true,
        KeyCode::Down | KeyCode::Char('j') => {
            if !app.projects.is_empty() {
                app.selected_project = (app.selected_project + 1) % app.projects.len();
            }
        }
        KeyCode::Up | KeyCode::Char('k') => {
            if !app.projects.is_empty() {
                app.selected_project = if app.selected_project == 0 {
                    app.projects.len() - 1
                } else {
                    app.selected_project - 1
                };
            }
        }
        KeyCode::Enter => {
            if app.current_project_id().is_some() {
                app.selected_column = 0;
                app.selected_row = 0;
                app.refresh_tasks().await;
                app.screen = Screen::Tasks;
            }
        }
        KeyCode::Char('n') => {
            app.new_project_form.name.clear();
            app.new_project_form.description.clear();
            app.input_mode = InputMode::NewProjectName;
        }
        KeyCode::Char('d') => {
            if let Some(id) = app.current_project_id() {
                if let Err(e) = app.client.delete_project(id).await {
                    app.status_message = Some(format!("Delete failed: {e}"));
                }
                app.refresh_projects().await;
            }
        }
        KeyCode::Char('r') => app.refresh_projects().await,
        _ => {}
    }
}

async fn handle_tasks_normal_key(app: &mut App, key: KeyCode) {
    match key {
        KeyCode::Char('q') => app.should_quit = true,
        KeyCode::Esc | KeyCode::Backspace => app.screen = Screen::Projects,
        KeyCode::Left | KeyCode::Char('h') => app.move_column_left(),
        KeyCode::Right | KeyCode::Char('l') => app.move_column_right(),
        KeyCode::Up | KeyCode::Char('k') => app.move_row_up(),
        KeyCode::Down | KeyCode::Char('j') => app.move_row_down(),
        KeyCode::Enter | KeyCode::Char(' ') => {
            if let Some(task) = app.selected_task().cloned() {
                let next_status = App::next_status(&task.status).to_string();
                if let Err(e) = app.client.update_task_status(task.id, next_status).await {
                    app.status_message = Some(format!("Update failed: {e}"));
                }
                app.refresh_tasks().await;
                app.focus_task(task.id);
            }
        }
        KeyCode::Char('n') => {
            app.new_task_form.title.clear();
            app.new_task_form.priority = PriorityChoice::Medium;
            app.input_mode = InputMode::NewTaskTitle;
        }
        KeyCode::Char('d') => {
            if let Some(task) = app.selected_task().cloned() {
                if let Err(e) = app.client.delete_task(task.id).await {
                    app.status_message = Some(format!("Delete failed: {e}"));
                }
                app.refresh_tasks().await;
            }
        }
        KeyCode::Char('r') => app.refresh_tasks().await,
        _ => {}
    }
}

async fn handle_new_project_name_key(app: &mut App, key: KeyCode) {
    match key {
        KeyCode::Enter => app.input_mode = InputMode::NewProjectDescription,
        KeyCode::Esc => app.input_mode = InputMode::Normal,
        KeyCode::Backspace => {
            app.new_project_form.name.pop();
        }
        KeyCode::Char(c) => app.new_project_form.name.push(c),
        _ => {}
    }
}

async fn handle_new_project_description_key(app: &mut App, key: KeyCode) {
    match key {
        KeyCode::Enter => {
            let name = app.new_project_form.name.trim().to_string();
            let description = app.new_project_form.description.trim().to_string();
            let description = if description.is_empty() {
                None
            } else {
                Some(description)
            };
            if !name.is_empty() {
                match app.client.create_project(name, description).await {
                    Ok(_) => app.status_message = Some("Project created".to_string()),
                    Err(e) => app.status_message = Some(format!("Create failed: {e}")),
                }
                app.refresh_projects().await;
            }
            app.input_mode = InputMode::Normal;
        }
        KeyCode::Esc => app.input_mode = InputMode::Normal,
        KeyCode::Backspace => {
            app.new_project_form.description.pop();
        }
        KeyCode::Char(c) => app.new_project_form.description.push(c),
        _ => {}
    }
}

async fn handle_new_task_title_key(app: &mut App, key: KeyCode) {
    match key {
        KeyCode::Enter => {
            if app.new_task_form.title.trim().is_empty() {
                app.status_message = Some("Task title cannot be empty".to_string());
                app.input_mode = InputMode::Normal;
            } else {
                app.input_mode = InputMode::NewTaskPriority;
            }
        }
        KeyCode::Esc => app.input_mode = InputMode::Normal,
        KeyCode::Backspace => {
            app.new_task_form.title.pop();
        }
        KeyCode::Char(c) => app.new_task_form.title.push(c),
        _ => {}
    }
}

async fn handle_new_task_priority_key(app: &mut App, key: KeyCode) {
    match key {
        KeyCode::Char('1') => submit_new_task(app, PriorityChoice::Low).await,
        KeyCode::Char('2') => submit_new_task(app, PriorityChoice::Medium).await,
        KeyCode::Char('3') => submit_new_task(app, PriorityChoice::High).await,
        KeyCode::Char('4') => submit_new_task(app, PriorityChoice::Urgent).await,
        KeyCode::Left | KeyCode::Char('h') => {
            app.new_task_form.priority = app.new_task_form.priority.prev();
        }
        KeyCode::Right | KeyCode::Char('l') => {
            app.new_task_form.priority = app.new_task_form.priority.next();
        }
        KeyCode::Enter => {
            let priority = app.new_task_form.priority;
            submit_new_task(app, priority).await;
        }
        KeyCode::Esc => app.input_mode = InputMode::Normal,
        _ => {}
    }
}

async fn submit_new_task(app: &mut App, priority: PriorityChoice) {
    let title = app.new_task_form.title.trim().to_string();
    if let Some(project_id) = app.current_project_id() {
        match app
            .client
            .create_task(project_id, title, None, Some(priority.as_str().to_string()))
            .await
        {
            Ok(task) => {
                app.status_message = Some("Task created".to_string());
                app.refresh_tasks().await;
                app.focus_task(task.id);
            }
            Err(e) => {
                app.status_message = Some(format!("Create failed: {e}"));
                app.refresh_tasks().await;
            }
        }
    }
    app.input_mode = InputMode::Normal;
}
