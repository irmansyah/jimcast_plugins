use ratatui::{
    layout::{Alignment, Constraint, Direction, Layout, Rect},
    style::{Color, Modifier, Style},
    text::{Line, Span},
    widgets::{Block, BorderType, Borders, Paragraph},
    Frame,
};

use crate::app::{App, InputMode, PriorityChoice, TASK_COLUMNS};
use crate::config::{Colors, TaskCardLayout};
use crate::models_ext::TaskViewExt;
use crate::ui::theme::{priority_label, task_status_label};
use client::TaskView;

pub fn render(f: &mut Frame, app: &App) {
    let size = f.area();
    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([Constraint::Length(1), Constraint::Min(3), Constraint::Length(2)])
        .split(size);

    let project_name = app
        .projects
        .get(app.selected_project)
        .map(|p| p.name.as_str())
        .unwrap_or("Tasks");

    let header = Paragraph::new(Line::from(vec![
        Span::styled(
            format!(" \u{1F5C2}\u{fe0f}  {project_name} "),
            Style::default()
                .fg(app.config.colors.text_primary)
                .add_modifier(Modifier::BOLD),
        ),
        Span::styled(
            format!("\u{2014} {} tasks", app.tasks.len()),
            Style::default().fg(app.config.colors.text_muted),
        ),
    ]));
    f.render_widget(header, chunks[0]);

    if app.input_mode == InputMode::NewTaskPriority {
        render_priority_picker(f, chunks[1], app);
    } else {
        render_board(f, chunks[1], app);
    }

    let footer_text = match app.input_mode {
        InputMode::NewTaskTitle => format!(" New task title \u{25b8} {}\u{2588}", app.new_task_form.title),
        InputMode::NewTaskPriority => {
            " Pick a priority \u{2014} \u{2190}/\u{2192} choose, 1-4 quick pick, Enter confirm, Esc cancel"
                .to_string()
        }
        _ => app.status_message.clone().unwrap_or_else(|| {
            " \u{2190}/\u{2192} column   \u{2191}/\u{2193} card   Enter/Space advance   n new   d delete   Esc back   q quit"
                .to_string()
        }),
    };
    let footer =
        Paragraph::new(footer_text).style(Style::default().fg(app.config.colors.text_muted));
    f.render_widget(footer, chunks[2]);
}

fn render_board(f: &mut Frame, area: Rect, app: &App) {
    let col_constraints = [
        Constraint::Percentage(25),
        Constraint::Percentage(25),
        Constraint::Percentage(25),
        Constraint::Percentage(25),
    ];
    let columns = Layout::default()
        .direction(Direction::Horizontal)
        .constraints(col_constraints)
        .split(area);

    for (col_idx, status) in TASK_COLUMNS.iter().enumerate() {
        render_column(f, columns[col_idx], app, col_idx, status);
    }
}

fn render_column(f: &mut Frame, area: Rect, app: &App, col_idx: usize, status: &str) {
    let tasks = app.tasks_in_column(col_idx);
    let accent = app.config.colors.task_status(status);
    let is_focused_column = col_idx == app.selected_column;

    let border_style = if is_focused_column {
        Style::default().fg(accent).add_modifier(Modifier::BOLD)
    } else {
        Style::default().fg(Color::DarkGray)
    };

    let title = Line::from(vec![
        Span::styled(
            format!(" {} ", task_status_label(status)),
            Style::default().fg(accent).add_modifier(Modifier::BOLD),
        ),
        Span::styled(
            format!("({}) ", tasks.len()),
            Style::default().fg(app.config.colors.text_muted),
        ),
    ]);

    let block = Block::default()
        .border_type(BorderType::Rounded)
        .borders(Borders::ALL)
        .border_style(border_style)
        .title(title);

    let inner = block.inner(area);
    f.render_widget(block, area);

    if tasks.is_empty() {
        let empty = Paragraph::new("\u{2014} empty \u{2014}")
            .alignment(Alignment::Center)
            .style(Style::default().fg(app.config.colors.text_muted));
        f.render_widget(
            empty,
            Rect {
                x: inner.x,
                y: inner.y,
                width: inner.width,
                height: 1,
            },
        );
        return;
    }

    let layout = app.config.task_card;
    let height = card_height(&layout);
    let visible = (inner.height / height).max(1) as usize;
    let selected_row = if is_focused_column { app.selected_row } else { usize::MAX };
    let start = if is_focused_column && selected_row >= visible {
        selected_row + 1 - visible
    } else {
        0
    };
    let end = (start + visible).min(tasks.len());

    let mut y = inner.y;
    for (row_idx, task) in tasks.iter().enumerate().skip(start).take(end.saturating_sub(start)) {
        if y + height > inner.y + inner.height {
            break;
        }
        let card_area = Rect {
            x: inner.x,
            y,
            width: inner.width,
            height,
        };
        let selected = is_focused_column && row_idx == selected_row;
        render_task_card(f, card_area, task, selected, &layout, &app.config.colors);
        y += height;
    }
}

/// 2 border rows, 1 title row (always shown), plus one row per enabled
/// field — so a config with everything off renders the leanest possible
/// card (just the title), and one with everything on renders the fullest.
fn card_height(layout: &TaskCardLayout) -> u16 {
    let mut h: u16 = 3; // 2 borders + title
    if layout.show_priority || layout.show_id_suffix {
        h += 1;
    }
    if layout.show_description {
        h += 1;
    }
    h
}

fn render_task_card(
    f: &mut Frame,
    area: Rect,
    task: &TaskView,
    selected: bool,
    layout: &TaskCardLayout,
    colors: &Colors,
) {
    let accent = colors.priority(&task.priority);

    let border_style = if selected {
        Style::default().fg(accent).add_modifier(Modifier::BOLD)
    } else {
        Style::default().fg(accent)
    };
    let title_style = if selected {
        Style::default()
            .fg(colors.text_primary)
            .add_modifier(Modifier::BOLD)
    } else {
        Style::default().fg(Color::Gray)
    };

    let marker = if selected { "\u{25b8}" } else { " " };

    let block = Block::default()
        .border_type(if selected {
            BorderType::Double
        } else {
            BorderType::Rounded
        })
        .borders(Borders::ALL)
        .border_style(border_style);

    let inner = block.inner(area);
    f.render_widget(block, area);

    let mut row = inner.y;

    let title_line = Paragraph::new(Line::from(vec![
        Span::raw(marker),
        Span::styled(truncate(&task.title, inner.width as usize), title_style),
    ]));
    f.render_widget(
        title_line,
        Rect {
            x: inner.x,
            y: row,
            width: inner.width,
            height: 1,
        },
    );
    row += 1;

    if row < inner.y + inner.height && (layout.show_priority || layout.show_id_suffix) {
        let mut parts = Vec::new();
        if layout.show_priority {
            parts.push(format!("\u{25cf} {}", priority_label(&task.priority)));
        }
        if layout.show_id_suffix {
            parts.push(format!("#{}", task.short_id()));
        }
        let meta_line = Paragraph::new(Line::from(Span::styled(
            format!(" {}", parts.join("   ")),
            Style::default().fg(accent),
        )));
        f.render_widget(
            meta_line,
            Rect {
                x: inner.x,
                y: row,
                width: inner.width,
                height: 1,
            },
        );
        row += 1;
    }

    if row < inner.y + inner.height && layout.show_description {
        let desc = task
            .description
            .clone()
            .unwrap_or_else(|| "No description".to_string());
        let desc_line = Paragraph::new(Line::from(Span::styled(
            format!(" {}", truncate(&desc, layout.description_max_chars.min(inner.width as usize))),
            Style::default().fg(colors.text_muted),
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
    }
}

fn render_priority_picker(f: &mut Frame, area: Rect, app: &App) {
    let block = Block::default()
        .border_type(BorderType::Rounded)
        .borders(Borders::ALL)
        .border_style(Style::default().fg(app.config.colors.text_muted))
        .title(" New task \u{2014} choose a priority label ");
    let inner = block.inner(area);
    f.render_widget(block, area);

    let chips = Layout::default()
        .direction(Direction::Horizontal)
        .constraints([Constraint::Percentage(25); 4])
        .split(inner);

    for (i, choice) in PriorityChoice::all().iter().enumerate() {
        let accent = app.config.colors.priority(choice.as_str());
        let selected = *choice == app.new_task_form.priority;
        let style = if selected {
            Style::default()
                .fg(Color::Black)
                .bg(accent)
                .add_modifier(Modifier::BOLD)
        } else {
            Style::default().fg(accent)
        };
        let chip_block = Block::default()
            .border_type(BorderType::Rounded)
            .borders(Borders::ALL)
            .border_style(Style::default().fg(accent));
        let chip_inner = chip_block.inner(chips[i]);
        f.render_widget(chip_block, chips[i]);

        let label = Paragraph::new(Line::from(Span::styled(
            format!("[{}] {}", i + 1, choice.label()),
            style,
        )))
        .alignment(Alignment::Center);
        f.render_widget(label, chip_inner);
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
