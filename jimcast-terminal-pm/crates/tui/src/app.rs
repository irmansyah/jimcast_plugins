use uuid::Uuid;

use crate::api_client::ApiClient;
use crate::models::{ProjectView, TaskView};

#[derive(PartialEq, Eq, Clone, Copy)]
pub enum Screen {
    Projects,
    Tasks,
}

#[derive(PartialEq, Eq, Clone, Copy)]
pub enum InputMode {
    Normal,
    NewProjectName,
    NewProjectDescription,
    NewTaskTitle,
}

#[derive(Default)]
pub struct NewProjectForm {
    pub name: String,
    pub description: String,
}

#[derive(Default)]
pub struct NewTaskForm {
    pub title: String,
}

pub struct App {
    pub client: ApiClient,
    pub screen: Screen,
    pub input_mode: InputMode,
    pub projects: Vec<ProjectView>,
    pub selected_project: usize,
    pub tasks: Vec<TaskView>,
    pub selected_task: usize,
    pub new_project_form: NewProjectForm,
    pub new_task_form: NewTaskForm,
    pub status_message: Option<String>,
    pub should_quit: bool,
}

impl App {
    pub fn new(client: ApiClient) -> Self {
        Self {
            client,
            screen: Screen::Projects,
            input_mode: InputMode::Normal,
            projects: Vec::new(),
            selected_project: 0,
            tasks: Vec::new(),
            selected_task: 0,
            new_project_form: NewProjectForm::default(),
            new_task_form: NewTaskForm::default(),
            status_message: None,
            should_quit: false,
        }
    }

    pub async fn refresh_projects(&mut self) {
        match self.client.list_projects().await {
            Ok(projects) => {
                self.projects = projects;
                if !self.projects.is_empty() && self.selected_project >= self.projects.len() {
                    self.selected_project = self.projects.len() - 1;
                }
            }
            Err(e) => self.status_message = Some(format!("Error loading projects: {e}")),
        }
    }

    pub async fn refresh_tasks(&mut self) {
        if let Some(project) = self.projects.get(self.selected_project) {
            match self.client.list_tasks(project.id).await {
                Ok(tasks) => {
                    self.tasks = tasks;
                    if !self.tasks.is_empty() && self.selected_task >= self.tasks.len() {
                        self.selected_task = self.tasks.len() - 1;
                    }
                }
                Err(e) => self.status_message = Some(format!("Error loading tasks: {e}")),
            }
        }
    }

    pub fn current_project_id(&self) -> Option<Uuid> {
        self.projects.get(self.selected_project).map(|p| p.id)
    }

    pub fn next_status(current: &str) -> &'static str {
        match current {
            "todo" => "in_progress",
            "in_progress" => "in_review",
            "in_review" => "done",
            _ => "todo",
        }
    }
}
