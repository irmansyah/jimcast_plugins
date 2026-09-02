//! Plain-text table + `--json` rendering for CLI output. No extra
//! dependency needed — just fixed-width formatting.

use client::{ProjectView, TaskView};

pub fn print_projects(projects: &[ProjectView], json: bool) {
    if json {
        println!("{}", serde_json::to_string_pretty(projects).unwrap());
        return;
    }
    if projects.is_empty() {
        println!("No projects.");
        return;
    }
    println!(
        "{:<36}  {:<28}  {:<10}  {}",
        "ID", "NAME", "STATUS", "CREATED"
    );
    for p in projects {
        println!(
            "{:<36}  {:<28}  {:<10}  {}",
            p.id,
            truncate(&p.name, 28),
            p.status,
            p.created_at
        );
    }
}

pub fn print_project(p: &ProjectView, json: bool) {
    if json {
        println!("{}", serde_json::to_string_pretty(p).unwrap());
        return;
    }
    println!("ID:          {}", p.id);
    println!("Name:        {}", p.name);
    println!(
        "Description: {}",
        p.description.as_deref().unwrap_or("(none)")
    );
    println!("Status:      {}", p.status);
    println!("Created:     {}", p.created_at);
    println!("Updated:     {}", p.updated_at);
}

pub fn print_tasks(tasks: &[TaskView], json: bool) {
    if json {
        println!("{}", serde_json::to_string_pretty(tasks).unwrap());
        return;
    }
    if tasks.is_empty() {
        println!("No tasks.");
        return;
    }
    println!(
        "{:<36}  {:<28}  {:<12}  {:<8}  {}",
        "ID", "TITLE", "STATUS", "PRIORITY", "CREATED"
    );
    for t in tasks {
        println!(
            "{:<36}  {:<28}  {:<12}  {:<8}  {}",
            t.id,
            truncate(&t.title, 28),
            t.status,
            t.priority,
            t.created_at
        );
    }
}

pub fn print_task(t: &TaskView, json: bool) {
    if json {
        println!("{}", serde_json::to_string_pretty(t).unwrap());
        return;
    }
    println!("ID:          {}", t.id);
    println!("Project ID:  {}", t.project_id);
    println!("Title:       {}", t.title);
    println!(
        "Description: {}",
        t.description.as_deref().unwrap_or("(none)")
    );
    println!("Status:      {}", t.status);
    println!("Priority:    {}", t.priority);
    println!("Created:     {}", t.created_at);
    println!("Updated:     {}", t.updated_at);
}

fn truncate(s: &str, max: usize) -> String {
    if s.chars().count() <= max {
        s.to_string()
    } else {
        let t: String = s.chars().take(max.saturating_sub(1)).collect();
        format!("{t}\u{2026}")
    }
}
