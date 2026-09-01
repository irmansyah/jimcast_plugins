mod api_client;
mod app;
mod models;
mod ui;

use std::io;
use std::time::Duration;

use crossterm::{
    event::{self, DisableMouseCapture, EnableMouseCapture, Event, KeyCode, KeyEventKind},
    execute,
    terminal::{disable_raw_mode, enable_raw_mode, EnterAlternateScreen, LeaveAlternateScreen},
};
use ratatui::{backend::CrosstermBackend, Terminal};

use api_client::ApiClient;
use app::{App, InputMode, Screen};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let base_url =
        std::env::var("PM_API_URL").unwrap_or_else(|_| "http://127.0.0.1:8080".to_string());
    let client = ApiClient::new(base_url);
    let mut app = App::new(client);
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
    }
}

async fn handle_normal_key(app: &mut App, key: KeyCode) {
    match app.screen {
        Screen::Projects => match key {
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
                    app.selected_task = 0;
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
        },
        Screen::Tasks => match key {
            KeyCode::Char('q') => app.should_quit = true,
            KeyCode::Esc | KeyCode::Backspace => app.screen = Screen::Projects,
            KeyCode::Down | KeyCode::Char('j') => {
                if !app.tasks.is_empty() {
                    app.selected_task = (app.selected_task + 1) % app.tasks.len();
                }
            }
            KeyCode::Up | KeyCode::Char('k') => {
                if !app.tasks.is_empty() {
                    app.selected_task = if app.selected_task == 0 {
                        app.tasks.len() - 1
                    } else {
                        app.selected_task - 1
                    };
                }
            }
            KeyCode::Enter | KeyCode::Char(' ') => {
                if let Some(task) = app.tasks.get(app.selected_task).cloned() {
                    let next_status = App::next_status(&task.status).to_string();
                    if let Err(e) = app.client.update_task_status(task.id, next_status).await {
                        app.status_message = Some(format!("Update failed: {e}"));
                    }
                    app.refresh_tasks().await;
                }
            }
            KeyCode::Char('n') => {
                app.new_task_form.title.clear();
                app.input_mode = InputMode::NewTaskTitle;
            }
            KeyCode::Char('d') => {
                if let Some(task) = app.tasks.get(app.selected_task).cloned() {
                    if let Err(e) = app.client.delete_task(task.id).await {
                        app.status_message = Some(format!("Delete failed: {e}"));
                    }
                    app.refresh_tasks().await;
                }
            }
            KeyCode::Char('r') => app.refresh_tasks().await,
            _ => {}
        },
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
            let title = app.new_task_form.title.trim().to_string();
            if !title.is_empty() {
                if let Some(project_id) = app.current_project_id() {
                    match app.client.create_task(project_id, title, None, None).await {
                        Ok(_) => app.status_message = Some("Task created".to_string()),
                        Err(e) => app.status_message = Some(format!("Create failed: {e}")),
                    }
                    app.refresh_tasks().await;
                }
            }
            app.input_mode = InputMode::Normal;
        }
        KeyCode::Esc => app.input_mode = InputMode::Normal,
        KeyCode::Backspace => {
            app.new_task_form.title.pop();
        }
        KeyCode::Char(c) => app.new_task_form.title.push(c),
        _ => {}
    }
}
