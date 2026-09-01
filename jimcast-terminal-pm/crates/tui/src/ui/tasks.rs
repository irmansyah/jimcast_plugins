use ratatui::{
    layout::{Constraint, Direction, Layout},
    style::{Modifier, Style},
    text::{Line, Span},
    widgets::{Block, Borders, List, ListItem, Paragraph},
    Frame,
};

use crate::app::{App, InputMode};

pub fn render(f: &mut Frame, app: &App) {
    let size = f.area();
    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([Constraint::Min(3), Constraint::Length(3)])
        .split(size);

    let title = app
        .projects
        .get(app.selected_project)
        .map(|p| p.name.as_str())
        .unwrap_or("Tasks");

    let items: Vec<ListItem> = app
        .tasks
        .iter()
        .enumerate()
        .map(|(i, t)| {
            let style = if i == app.selected_task {
                Style::default().add_modifier(Modifier::REVERSED)
            } else {
                Style::default()
            };
            ListItem::new(Line::from(vec![
                Span::styled(format!("{:<35}", t.title), style),
                Span::raw(format!(" [{}] ({})", t.status, t.priority)),
            ]))
        })
        .collect();

    let list = List::new(items).block(Block::default().borders(Borders::ALL).title(format!(
        "Tasks in \"{title}\" — Enter/Space: advance status  n: new  d: delete  Esc: back  q: quit"
    )));
    f.render_widget(list, chunks[0]);

    let footer_text = match app.input_mode {
        InputMode::NewTaskTitle => format!("New task title: {}_", app.new_task_form.title),
        _ => app
            .status_message
            .clone()
            .unwrap_or_else(|| "Ready".to_string()),
    };
    let footer = Paragraph::new(footer_text)
        .block(Block::default().borders(Borders::ALL).title("Status"));
    f.render_widget(footer, chunks[1]);
}
