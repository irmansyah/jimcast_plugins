use uuid::Uuid;

use client::{ApiClient, ProjectView, TaskView};

use crate::config::Config;

/// Kanban column order — index into this array is the "column" the rest
/// of the app refers to.
pub const TASK_COLUMNS: [&str; 4] = ["todo", "in_progress", "in_review", "done"];

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
    NewTaskPriority,
}

#[derive(Default)]
pub struct NewProjectForm {
    pub name: String,
    pub description: String,
}

/// The priority picker shown after typing a new task's title — Trello
/// calls these "labels"; we render them the same way (colored chips).
#[derive(Clone, Copy, PartialEq, Eq)]
pub enum PriorityChoice {
    Low,
    Medium,
    High,
    Urgent,
}

impl Default for PriorityChoice {
    fn default() -> Self {
        PriorityChoice::Medium
    }
}

impl PriorityChoice {
    pub fn as_str(&self) -> &'static str {
        match self {
            PriorityChoice::Low => "low",
            PriorityChoice::Medium => "medium",
            PriorityChoice::High => "high",
            PriorityChoice::Urgent => "urgent",
        }
    }

    pub fn label(&self) -> &'static str {
        match self {
            PriorityChoice::Low => "Low",
            PriorityChoice::Medium => "Medium",
            PriorityChoice::High => "High",
            PriorityChoice::Urgent => "Urgent",
        }
    }

    pub fn next(&self) -> Self {
        match self {
            PriorityChoice::Low => PriorityChoice::Medium,
            PriorityChoice::Medium => PriorityChoice::High,
            PriorityChoice::High => PriorityChoice::Urgent,
            PriorityChoice::Urgent => PriorityChoice::Low,
        }
    }

    pub fn prev(&self) -> Self {
        match self {
            PriorityChoice::Low => PriorityChoice::Urgent,
            PriorityChoice::Medium => PriorityChoice::Low,
            PriorityChoice::High => PriorityChoice::Medium,
            PriorityChoice::Urgent => PriorityChoice::High,
        }
    }

    pub fn all() -> [PriorityChoice; 4] {
        [
            PriorityChoice::Low,
            PriorityChoice::Medium,
            PriorityChoice::High,
            PriorityChoice::Urgent,
        ]
    }
}

#[derive(Default)]
pub struct NewTaskForm {
    pub title: String,
    pub priority: PriorityChoice,
}

pub struct App {
    pub client: ApiClient,
    pub config: Config,
    pub screen: Screen,
    pub input_mode: InputMode,
    pub projects: Vec<ProjectView>,
    pub selected_project: usize,
    pub tasks: Vec<TaskView>,
    /// Which Kanban column (see TASK_COLUMNS) is focused.
    pub selected_column: usize,
    /// Row within the focused column.
    pub selected_row: usize,
    pub new_project_form: NewProjectForm,
    pub new_task_form: NewTaskForm,
    pub status_message: Option<String>,
    pub should_quit: bool,
}

impl App {
    pub fn new(client: ApiClient, config: Config) -> Self {
        Self {
            client,
            config,
            screen: Screen::Projects,
            input_mode: InputMode::Normal,
            projects: Vec::new(),
            selected_project: 0,
            tasks: Vec::new(),
            selected_column: 0,
            selected_row: 0,
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
                    self.clamp_task_selection();
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

    /// Tasks belonging to a given Kanban column, in list order.
    pub fn tasks_in_column(&self, column: usize) -> Vec<&TaskView> {
        let status = TASK_COLUMNS[column];
        self.tasks.iter().filter(|t| t.status == status).collect()
    }

    pub fn selected_task(&self) -> Option<&TaskView> {
        self.tasks_in_column(self.selected_column)
            .get(self.selected_row)
            .copied()
    }

    /// Keeps `selected_row` in bounds after the task list changes shape
    /// (create/delete/status-change all reshuffle column membership).
    pub fn clamp_task_selection(&mut self) {
        let len = self.tasks_in_column(self.selected_column).len();
        if len == 0 {
            self.selected_row = 0;
        } else if self.selected_row >= len {
            self.selected_row = len - 1;
        }
    }

    /// After a task moves to a new status, follow it to its new column so
    /// the cursor doesn't jump somewhere unrelated.
    pub fn focus_task(&mut self, id: Uuid) {
        for (col, status) in TASK_COLUMNS.iter().enumerate() {
            if let Some(row) = self
                .tasks
                .iter()
                .filter(|t| t.status == *status)
                .position(|t| t.id == id)
            {
                self.selected_column = col;
                self.selected_row = row;
                return;
            }
        }
    }

    pub fn move_column_left(&mut self) {
        if self.selected_column > 0 {
            self.selected_column -= 1;
            self.clamp_task_selection();
        }
    }

    pub fn move_column_right(&mut self) {
        if self.selected_column < TASK_COLUMNS.len() - 1 {
            self.selected_column += 1;
            self.clamp_task_selection();
        }
    }

    pub fn move_row_up(&mut self) {
        let len = self.tasks_in_column(self.selected_column).len();
        if len == 0 {
            return;
        }
        self.selected_row = if self.selected_row == 0 {
            len - 1
        } else {
            self.selected_row - 1
        };
    }

    pub fn move_row_down(&mut self) {
        let len = self.tasks_in_column(self.selected_column).len();
        if len == 0 {
            return;
        }
        self.selected_row = (self.selected_row + 1) % len;
    }
}
