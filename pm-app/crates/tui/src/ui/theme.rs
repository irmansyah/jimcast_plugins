//! Trello/Notion-inspired color palette. Every status and priority maps
//! to one consistent accent color used for borders, badges and text
//! throughout the board — that's the whole "card" language.

use ratatui::style::Color;

pub const TEXT_PRIMARY: Color = Color::White;
pub const TEXT_MUTED: Color = Color::DarkGray;

pub fn project_status_color(status: &str) -> Color {
    match status {
        "active" => Color::Rgb(88, 199, 138),    // green
        "on_hold" => Color::Rgb(240, 180, 60),   // amber
        "completed" => Color::Rgb(96, 165, 250), // blue
        "archived" => Color::Rgb(120, 120, 130), // slate
        _ => Color::Rgb(180, 150, 255),          // planning: lavender
    }
}

pub fn task_status_color(status: &str) -> Color {
    match status {
        "todo" => Color::Rgb(148, 163, 184),        // slate
        "in_progress" => Color::Rgb(96, 165, 250),  // blue
        "in_review" => Color::Rgb(240, 180, 60),    // amber
        "done" => Color::Rgb(88, 199, 138),         // green
        _ => TEXT_PRIMARY,
    }
}

pub fn priority_color(priority: &str) -> Color {
    match priority {
        "low" => Color::Rgb(88, 199, 138),     // green
        "medium" => Color::Rgb(96, 165, 250),  // blue
        "high" => Color::Rgb(240, 180, 60),    // amber
        "urgent" => Color::Rgb(240, 90, 90),   // red
        _ => TEXT_PRIMARY,
    }
}

pub fn task_status_label(status: &str) -> &'static str {
    match status {
        "todo" => "TO DO",
        "in_progress" => "IN PROGRESS",
        "in_review" => "IN REVIEW",
        "done" => "DONE",
        _ => "?",
    }
}

pub fn priority_label(priority: &str) -> &'static str {
    match priority {
        "low" => "LOW",
        "medium" => "MED",
        "high" => "HIGH",
        "urgent" => "URGENT",
        _ => "?",
    }
}
