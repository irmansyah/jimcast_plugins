//! Small local extensions on the shared `client` crate's wire types —
//! display-only helpers that don't belong in the shared client itself.

use client::TaskView;

pub trait TaskViewExt {
    /// First 8 characters of the UUID, for a compact on-card label when
    /// `task_card.show_id_suffix` is enabled in config.json.
    fn short_id(&self) -> String;
}

impl TaskViewExt for TaskView {
    fn short_id(&self) -> String {
        self.id.to_string().chars().take(8).collect()
    }
}
