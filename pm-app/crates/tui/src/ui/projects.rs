use ratatui::{
    layout::{Alignment, Constraint, Direction, Layout, Rect},
    style::{Modifier, Style},
    text::{Line, Span},
    widgets::{block::Title, Block, BorderType, Borders, Paragraph},
    Frame,
};

use crate::app::{App, InputMode};
use crate::config::ProjectCardLayout;

pub fn render(f: &mut Frame, app: &App) {
    let size = f.area();
    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([Constraint::Length(1), Constraint::Min(3), Constraint::Length(2)])
        .split(size);

    let header = Paragraph::new(Line::from(vec![
        Span::styled(
            " \u{1F4CB} Projects ",
            Style::default()
                .fg(app.config.colors.text_primary)
                .add_modifier(Modifier::BOLD),
        ),
        Span::styled(
            format!("({})", app.projects.len()),
            Style::default().fg(app.config.colors.text_muted),
        ),
    ]));
    f.render_widget(header, chunks[0]);

    render_cards(f, chunks[1], app);

    let footer_text = match app.input_mode {
        InputMode::NewProjectName => {
            format!(" New project name \u{25b8} {}\u{2588}", app.new_project_form.name)
        }
        InputMode::NewProjectDescription => format!(
            " Description (Enter saves, Esc cancels) \u{25b8} {}\u{2588}",
            app.new_project_form.description
        ),
        _ => app.status_message.clone().unwrap_or_else(|| {
            " \u{2191}/\u{2193} move    Enter open    n new    d delete    r refresh    q quit"
                .to_string()
        }),
    };
    let footer =
        Paragraph::new(footer_text).style(Style::default().fg(app.config.colors.text_muted));
    f.render_widget(footer, chunks[2]);
}

/// Card height adapts to which fields the config turns on: 2 border
/// rows, plus one inner row per enabled field.
fn card_height(layout: &ProjectCardLayout) -> u16 {
    let mut h: u16 = 2;
    if layout.show_description {
        h += 1;
    }
    if layout.show_created_at {
        h += 1;
    }
    h
}

fn render_cards(f: &mut Frame, area: Rect, app: &App) {
    let layout = app.config.project_card;

    if app.projects.is_empty() {
        let empty = Paragraph::new("No projects yet \u{2014} press 'n' to create one")
            .alignment(Alignment::Center)
            .style(Style::default().fg(app.config.colors.text_muted));
        f.render_widget(empty, area);
        return;
    }

    let height = card_height(&layout);
    let visible = (area.height / height).max(1) as usize;
    let start = if app.selected_project >= visible {
        app.selected_project + 1 - visible
    } else {
        0
    };
    let end = (start + visible).min(app.projects.len());

    let mut y = area.y;
    for (i, project) in app
        .projects
        .iter()
        .enumerate()
        .skip(start)
        .take(end.saturating_sub(start))
    {
        if y + height > area.y + area.height {
            break;
        }
        let card_area = Rect {
            x: area.x,
            y,
            width: area.width,
            height,
        };
        let selected = i == app.selected_project;
        let accent = app.config.colors.project_status(&project.status);

        let border_style = if selected {
            Style::default().fg(accent).add_modifier(Modifier::BOLD)
        } else {
            Style::default().fg(ratatui::style::Color::DarkGray)
        };
        let name_style = if selected {
            Style::default()
                .fg(app.config.colors.text_primary)
                .add_modifier(Modifier::BOLD)
        } else {
            Style::default().fg(ratatui::style::Color::Gray)
        };

        let marker = if selected { "\u{25b8} " } else { "  " };

        let mut block = Block::default()
            .border_type(BorderType::Rounded)
            .borders(Borders::ALL)
            .border_style(border_style)
            .title(Line::from(vec![Span::styled(
                format!(" {marker}{} ", project.name),
                name_style,
            )]));

        if layout.show_status_badge {
            let status_badge = Title::from(Line::from(vec![Span::styled(
                format!(" {} \u{25cf} ", project.status.replace('_', " ").to_uppercase()),
                Style::default().fg(accent).add_modifier(Modifier::BOLD),
            )]))
            .alignment(Alignment::Right);
            block = block.title(status_badge);
        }

        let inner = block.inner(card_area);
        f.render_widget(block, card_area);

        let mut row = inner.y;

        if layout.show_description {
            let desc = project
                .description
                .clone()
                .unwrap_or_else(|| "No description".to_string());
            let desc_line = Paragraph::new(Line::from(Span::styled(
                format!(" {}", truncate(&desc, layout.description_max_chars.min(inner.width as usize))),
                Style::default().fg(app.config.colors.text_muted),
            )));
            f.render_widget(
                desc_line,
                Rect {
                    x: inner.x,
                    y: row,
                    width: inner.width,
                    height: 1,
                },
            );
            row += 1;
        }

        if layout.show_created_at {
            let created_line = Paragraph::new(Line::from(Span::styled(
                format!(" Created {}", project.created_at),
                Style::default().fg(app.config.colors.text_muted),
            )));
            f.render_widget(
                created_line,
                Rect {
                    x: inner.x,
                    y: row,
                    width: inner.width,
                    height: 1,
                },
            );
        }

        y += height;
    }
}

fn truncate(s: &str, max: usize) -> String {
    if max == 0 {
        return String::new();
    }
    if s.chars().count() <= max {
        s.to_string()
    } else {
        let truncated: String = s.chars().take(max.saturating_sub(1)).collect();
        format!("{truncated}\u{2026}")
    }
}
