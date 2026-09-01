mod projects;
mod tasks;

use ratatui::Frame;

use crate::app::{App, Screen};

pub fn draw(f: &mut Frame, app: &App) {
    match app.screen {
        Screen::Projects => projects::render(f, app),
        Screen::Tasks => tasks::render(f, app),
    }
}
