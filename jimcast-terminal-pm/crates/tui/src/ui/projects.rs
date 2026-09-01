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

    let items: Vec<ListItem> = app
        .projects
        .iter()
        .enumerate()
        .map(|(i, p)| {
            let style = if i == app.selected_project {
                Style::default().add_modifier(Modifier::REVERSED)
            } else {
                Style::default()
            };
            ListItem::new(Line::from(vec![
                Span::styled(format!("{:<30}", p.name), style),
                Span::raw(format!(" [{}]", p.status)),
            ]))
        })
        .collect();

    let list = List::new(items).block(
        Block::default()
            .borders(Borders::ALL)
            .title("Projects — Enter: open  n: new  d: delete  r: refresh  q: quit"),
    );
    f.render_widget(list, chunks[0]);

    let footer_text = match app.input_mode {
        InputMode::NewProjectName => format!("New project name: {}_", app.new_project_form.name),
        InputMode::NewProjectDescription => {
            format!(
                "Description (Enter to submit, Esc to cancel): {}_",
                app.new_project_form.description
            )
        }
        _ => app
            .status_message
            .clone()
            .unwrap_or_else(|| "Ready".to_string()),
    };
    let footer = Paragraph::new(footer_text)
        .block(Block::default().borders(Borders::ALL).title("Status"));
    f.render_widget(footer, chunks[1]);
}
