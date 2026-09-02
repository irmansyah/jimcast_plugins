//! User-configurable color scheme and card layout for the TUI.
//!
//! Resolution order (first one found wins):
//!   1. `./config.json`                        — dev convenience: run
//!                                                `pm-tui` from the repo
//!                                                root and it picks this
//!                                                up automatically.
//!   2. `~/.config/pm-app/config.json`          — normal installed use
//!                                                (respects $XDG_CONFIG_HOME
//!                                                if set).
//!   3. Built-in defaults (below) if neither file exists or fails to parse.
//!
//! The file is a *partial* overlay: any field you omit falls back to the
//! built-in default, so a config.json only needs to mention what it wants
//! to change. See `./config.json` in the repo root for a fully-annotated
//! example covering every option.

use ratatui::style::Color;
use serde::Deserialize;
use std::collections::HashMap;
use std::path::{Path, PathBuf};

const APP_NAME: &str = "pm-app";
const CONFIG_FILENAME: &str = "config.json";

// ---------------------------------------------------------------------
// Resolved config — what the rest of the app actually reads.
// ---------------------------------------------------------------------

#[derive(Debug, Clone)]
pub struct Config {
    pub api_base_url: String,
    pub colors: Colors,
    pub project_card: ProjectCardLayout,
    pub task_card: TaskCardLayout,
}

#[derive(Debug, Clone)]
pub struct Colors {
    pub text_primary: Color,
    pub text_muted: Color,
    project_status: HashMap<String, Color>,
    task_status: HashMap<String, Color>,
    priority: HashMap<String, Color>,
}

impl Colors {
    pub fn project_status(&self, status: &str) -> Color {
        self.project_status
            .get(status)
            .copied()
            .unwrap_or(self.text_primary)
    }

    pub fn task_status(&self, status: &str) -> Color {
        self.task_status
            .get(status)
            .copied()
            .unwrap_or(self.text_primary)
    }

    pub fn priority(&self, priority: &str) -> Color {
        self.priority
            .get(priority)
            .copied()
            .unwrap_or(self.text_primary)
    }
}

/// Which fields show up on each project card, and how they're trimmed.
#[derive(Debug, Clone, Copy)]
pub struct ProjectCardLayout {
    pub show_status_badge: bool,
    pub show_description: bool,
    pub show_created_at: bool,
    pub description_max_chars: usize,
}

/// Which fields show up on each task card inside the Kanban board.
#[derive(Debug, Clone, Copy)]
pub struct TaskCardLayout {
    pub show_priority: bool,
    pub show_description: bool,
    pub show_id_suffix: bool,
    pub description_max_chars: usize,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            api_base_url: "http://127.0.0.1:8080".to_string(),
            colors: Colors::default(),
            project_card: ProjectCardLayout::default(),
            task_card: TaskCardLayout::default(),
        }
    }
}

impl Default for Colors {
    fn default() -> Self {
        let map = |pairs: &[(&str, (u8, u8, u8))]| {
            pairs
                .iter()
                .map(|(k, (r, g, b))| (k.to_string(), Color::Rgb(*r, *g, *b)))
                .collect::<HashMap<_, _>>()
        };
        Self {
            text_primary: Color::White,
            text_muted: Color::DarkGray,
            project_status: map(&[
                ("planning", (180, 150, 255)),
                ("active", (88, 199, 138)),
                ("on_hold", (240, 180, 60)),
                ("completed", (96, 165, 250)),
                ("archived", (120, 120, 130)),
            ]),
            task_status: map(&[
                ("todo", (148, 163, 184)),
                ("in_progress", (96, 165, 250)),
                ("in_review", (240, 180, 60)),
                ("done", (88, 199, 138)),
            ]),
            priority: map(&[
                ("low", (88, 199, 138)),
                ("medium", (96, 165, 250)),
                ("high", (240, 180, 60)),
                ("urgent", (240, 90, 90)),
            ]),
        }
    }
}

impl Default for ProjectCardLayout {
    fn default() -> Self {
        Self {
            show_status_badge: true,
            show_description: true,
            show_created_at: false,
            description_max_chars: 80,
        }
    }
}

impl Default for TaskCardLayout {
    fn default() -> Self {
        Self {
            show_priority: true,
            show_description: false,
            show_id_suffix: false,
            description_max_chars: 60,
        }
    }
}

// ---------------------------------------------------------------------
// Raw JSON shape — every field optional so a config.json only needs to
// mention what it wants to override.
// ---------------------------------------------------------------------

#[derive(Debug, Default, Deserialize)]
#[serde(default)]
struct RawConfig {
    api: RawApi,
    theme: RawTheme,
    project_card: RawProjectCard,
    task_card: RawTaskCard,
}

#[derive(Debug, Default, Deserialize)]
#[serde(default)]
struct RawApi {
    base_url: Option<String>,
}

#[derive(Debug, Default, Deserialize)]
#[serde(default)]
struct RawTheme {
    text_primary: Option<String>,
    text_muted: Option<String>,
    project_status: HashMap<String, String>,
    task_status: HashMap<String, String>,
    priority: HashMap<String, String>,
}

#[derive(Debug, Default, Deserialize)]
#[serde(default)]
struct RawProjectCard {
    show_status_badge: Option<bool>,
    show_description: Option<bool>,
    show_created_at: Option<bool>,
    description_max_chars: Option<usize>,
}

#[derive(Debug, Default, Deserialize)]
#[serde(default)]
struct RawTaskCard {
    show_priority: Option<bool>,
    show_description: Option<bool>,
    show_id_suffix: Option<bool>,
    description_max_chars: Option<usize>,
}

fn parse_color(hex: &str) -> Option<Color> {
    let hex = hex.trim().trim_start_matches('#');
    if hex.len() != 6 {
        return None;
    }
    let r = u8::from_str_radix(&hex[0..2], 16).ok()?;
    let g = u8::from_str_radix(&hex[2..4], 16).ok()?;
    let b = u8::from_str_radix(&hex[4..6], 16).ok()?;
    Some(Color::Rgb(r, g, b))
}

impl Config {
    fn from_raw(raw: RawConfig) -> Config {
        let mut cfg = Config::default();

        if let Some(url) = raw.api.base_url {
            if !url.trim().is_empty() {
                cfg.api_base_url = url;
            }
        }

        if let Some(c) = raw.theme.text_primary.as_deref().and_then(parse_color) {
            cfg.colors.text_primary = c;
        }
        if let Some(c) = raw.theme.text_muted.as_deref().and_then(parse_color) {
            cfg.colors.text_muted = c;
        }
        for (k, v) in raw.theme.project_status {
            if let Some(c) = parse_color(&v) {
                cfg.colors.project_status.insert(k, c);
            }
        }
        for (k, v) in raw.theme.task_status {
            if let Some(c) = parse_color(&v) {
                cfg.colors.task_status.insert(k, c);
            }
        }
        for (k, v) in raw.theme.priority {
            if let Some(c) = parse_color(&v) {
                cfg.colors.priority.insert(k, c);
            }
        }

        if let Some(v) = raw.project_card.show_status_badge {
            cfg.project_card.show_status_badge = v;
        }
        if let Some(v) = raw.project_card.show_description {
            cfg.project_card.show_description = v;
        }
        if let Some(v) = raw.project_card.show_created_at {
            cfg.project_card.show_created_at = v;
        }
        if let Some(v) = raw.project_card.description_max_chars {
            cfg.project_card.description_max_chars = v;
        }

        if let Some(v) = raw.task_card.show_priority {
            cfg.task_card.show_priority = v;
        }
        if let Some(v) = raw.task_card.show_description {
            cfg.task_card.show_description = v;
        }
        if let Some(v) = raw.task_card.show_id_suffix {
            cfg.task_card.show_id_suffix = v;
        }
        if let Some(v) = raw.task_card.description_max_chars {
            cfg.task_card.description_max_chars = v;
        }

        cfg
    }

    fn load_from(path: &Path) -> anyhow::Result<Config> {
        let text = std::fs::read_to_string(path)?;
        let raw: RawConfig = serde_json::from_str(&text)?;
        Ok(Config::from_raw(raw))
    }

    /// Loads config.json following the resolution order documented at the
    /// top of this file. Returns the resolved config plus the path it was
    /// actually loaded from (`None` means built-in defaults were used).
    pub fn load() -> (Config, Option<PathBuf>) {
        let dev_path = PathBuf::from(CONFIG_FILENAME);
        if dev_path.is_file() {
            match Self::load_from(&dev_path) {
                Ok(cfg) => return (cfg, Some(dev_path)),
                Err(err) => eprintln!(
                    "Warning: failed to parse {}: {err} — trying user config next.",
                    dev_path.display()
                ),
            }
        }

        if let Some(dir) = user_config_dir() {
            let path = dir.join(CONFIG_FILENAME);
            if path.is_file() {
                match Self::load_from(&path) {
                    Ok(cfg) => return (cfg, Some(path)),
                    Err(err) => eprintln!(
                        "Warning: failed to parse {}: {err} — using built-in defaults.",
                        path.display()
                    ),
                }
            }
        }

        (Config::default(), None)
    }
}

/// `~/.config/pm-app` (or `$XDG_CONFIG_HOME/pm-app`), with a Windows
/// fallback via `%USERPROFILE%`.
fn user_config_dir() -> Option<PathBuf> {
    if let Ok(xdg) = std::env::var("XDG_CONFIG_HOME") {
        if !xdg.trim().is_empty() {
            return Some(PathBuf::from(xdg).join(APP_NAME));
        }
    }
    if let Ok(home) = std::env::var("HOME") {
        if !home.trim().is_empty() {
            return Some(PathBuf::from(home).join(".config").join(APP_NAME));
        }
    }
    if let Ok(profile) = std::env::var("USERPROFILE") {
        if !profile.trim().is_empty() {
            return Some(PathBuf::from(profile).join(".config").join(APP_NAME));
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn defaults_have_all_four_task_statuses() {
        let colors = Colors::default();
        for s in ["todo", "in_progress", "in_review", "done"] {
            assert_ne!(colors.task_status(s), Color::White, "missing color for {s}");
        }
    }

    #[test]
    fn partial_override_keeps_other_defaults() {
        let raw: RawConfig = serde_json::from_str(r##"{"theme":{"priority":{"urgent":"#FF3B6B"}}}"##).unwrap();
        let cfg = Config::from_raw(raw);
        assert_eq!(cfg.colors.priority("urgent"), Color::Rgb(0xFF, 0x3B, 0x6B));
        // untouched defaults still present
        assert_eq!(cfg.colors.priority("low"), Color::Rgb(88, 199, 138));
        assert_eq!(cfg.api_base_url, "http://127.0.0.1:8080");
    }

    #[test]
    fn invalid_hex_is_ignored_falls_back_to_default() {
        let raw: RawConfig = serde_json::from_str(r#"{"theme":{"priority":{"urgent":"not-a-color"}}}"#).unwrap();
        let cfg = Config::from_raw(raw);
        assert_eq!(cfg.colors.priority("urgent"), Color::Rgb(240, 90, 90));
    }

    #[test]
    fn card_layout_overrides_apply() {
        let raw: RawConfig = serde_json::from_str(
            r#"{"task_card":{"show_description":true,"show_id_suffix":true}}"#,
        )
        .unwrap();
        let cfg = Config::from_raw(raw);
        assert!(cfg.task_card.show_description);
        assert!(cfg.task_card.show_id_suffix);
        assert!(cfg.task_card.show_priority); // untouched default
    }
}
