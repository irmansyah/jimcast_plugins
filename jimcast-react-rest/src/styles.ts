export const restStyles = `
  @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=IBM+Plex+Sans:wght@400;500;600&display=swap');

  :root {
    --bg: #0F1419;
    --panel: #151B23;
    --panel-2: #1B222C;
    --border: #2A313C;
    --border-soft: #232A34;
    --accent: #4FD1C5;
    --text: #E6EDF3;
    --text-muted: #8B949E;
    --text-dim: #5B6472;
    --get: #4FD1C5;
    --post: #79C0FF;
    --put: #F2CC60;
    --patch: #D2A8FF;
    --delete: #FF7B72;
    --danger-bg: #2E1416;
    --font-mono: 'IBM Plex Mono', ui-monospace, Menlo, monospace;
    --font-sans: 'IBM Plex Sans', system-ui, sans-serif;
  }
  * { box-sizing: border-box; }
  .app-shell {
    font-family: var(--font-sans);
    background: var(--bg);
    color: var(--text);
    height: 100vh;
    min-height: 640px;
    display: grid;
    grid-template-columns: 300px 1fr;
    grid-template-rows: 52px 1fr 34px;
    grid-template-areas: "topbar topbar" "sidebar main" "footer footer";
    border: 1px solid var(--border);
  }
  .req-item:focus-visible {
    outline: none;
  }
  .req-item[data-active="true"] {
    outline: 2px solid var(--accent);
    outline-offset: -2px;
  }
  button, input, select, textarea { font-family: inherit; color: inherit; }

  .topbar {
    grid-area: topbar;
    display: flex; align-items: center; justify-content: space-between;
    padding: 0 16px; border-bottom: 1px solid var(--border);
    background: var(--panel);
  }
  .brand { display: flex; align-items: center; gap: 8px; font-family: var(--font-mono); font-weight: 600; letter-spacing: 0.02em; }
  .brand .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 8px var(--accent); }
  .help-btn { background: transparent; border: 1px solid var(--border); color: var(--text-muted); border-radius: 6px; padding: 4px 10px; font-size: 12px; cursor: pointer; font-family: var(--font-mono); }
  .help-btn:hover { color: var(--text); border-color: var(--accent); }

  .sidebar { grid-area: sidebar; border-right: 1px solid var(--border); background: var(--panel); overflow-y: auto; display: flex; flex-direction: column; }
  .sidebar-head { padding: 12px 14px 8px; display: flex; align-items: center; justify-content: space-between; }
  .sidebar-head h2 { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-dim); margin: 0; font-weight: 600; }
  .new-btn { background: var(--panel-2); border: 1px solid var(--border); color: var(--text); border-radius: 6px; width: 22px; height: 22px; cursor: pointer; font-size: 14px; line-height: 1; }
  .new-btn:hover { border-color: var(--accent); color: var(--accent); }
  .req-list { list-style: none; margin: 0; padding: 4px 8px; display: flex; flex-direction: column; gap: 3px; }
  .req-item { position: relative; padding: 8px 10px 8px 12px; border-radius: 7px; border: 1px solid transparent; cursor: pointer; display: flex; flex-direction: column; gap: 3px; background: transparent; }
  .req-item.selected { background: var(--panel-2); border-color: var(--border-soft); }
  .req-item:hover { background: var(--panel-2); }
  .req-item .accent-bar { position: absolute; left: 0; top: 6px; bottom: 6px; width: 3px; border-radius: 2px; opacity: 0; }
  .req-item.selected .accent-bar { opacity: 1; }
  .req-row1 { display: flex; align-items: center; gap: 7px; }
  .method-badge { font-family: var(--font-mono); font-size: 10px; font-weight: 700; padding: 1px 6px; border-radius: 4px; letter-spacing: 0.02em; }
  .req-name { font-size: 13px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .req-url { font-family: var(--font-mono); font-size: 11px; color: var(--text-dim); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding-left: 1px; }
  .confirm-row { display: flex; align-items: center; justify-content: space-between; font-size: 11.5px; background: var(--danger-bg); border: 1px solid var(--delete); border-radius: 6px; padding: 6px 8px; margin-top: 2px; }
  .confirm-row kbd { margin: 0 2px; }
  .empty-list { padding: 20px 14px; font-size: 12px; color: var(--text-dim); }

  .method-badge.GET { background: rgba(79,209,197,0.15); color: var(--get); }
  .method-badge.POST { background: rgba(121,192,255,0.15); color: var(--post); }
  .method-badge.PUT { background: rgba(242,204,96,0.15); color: var(--put); }
  .method-badge.PATCH { background: rgba(210,168,255,0.15); color: var(--patch); }
  .method-badge.DELETE { background: rgba(255,123,114,0.15); color: var(--delete); }
  .req-item.selected.GET .accent-bar { background: var(--get); }
  .req-item.selected.POST .accent-bar { background: var(--post); }
  .req-item.selected.PUT .accent-bar { background: var(--put); }
  .req-item.selected.PATCH .accent-bar { background: var(--patch); }
  .req-item.selected.DELETE .accent-bar { background: var(--delete); }

  .main { grid-area: main; display: flex; flex-direction: column; overflow: hidden; }
  .editor { flex: 0 0 auto; max-height: 58%; overflow-y: auto; padding: 16px 20px; border-bottom: 1px solid var(--border); }
  .empty-editor { flex: 1; display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 12px; color: var(--text-dim); font-size: 13px; }
  .empty-editor button { background: var(--panel-2); border: 1px solid var(--border); color: var(--text); padding: 7px 14px; border-radius: 7px; cursor: pointer; font-size: 12.5px; }
  .empty-editor button:hover { border-color: var(--accent); color: var(--accent); }

  .url-row { display: flex; gap: 8px; align-items: stretch; }
  select.method-select { font-family: var(--font-mono); font-weight: 700; font-size: 13px; background: var(--panel-2); border: 1px solid var(--border); border-radius: 7px; padding: 0 10px; cursor: pointer; }
  input.url-input { flex: 1; background: var(--panel-2); border: 1px solid var(--border); border-radius: 7px; padding: 0 12px; font-family: var(--font-mono); font-size: 13px; height: 36px; }
  select.method-select { height: 36px; }
  .send-btn { background: var(--accent); color: #0B1116; border: none; border-radius: 7px; padding: 0 16px; font-weight: 700; font-size: 13px; cursor: pointer; height: 36px; }
  .send-btn:disabled { opacity: 0.5; cursor: default; }
  .send-btn:hover:not(:disabled) { filter: brightness(1.08); }

  input.name-input { width: 100%; background: transparent; border: none; border-bottom: 1px dashed var(--border-soft); padding: 4px 2px 8px; font-size: 15px; font-weight: 600; margin-bottom: 12px; color: var(--text); }
  input.name-input::placeholder { color: var(--text-dim); font-weight: 400; }

  .tabs { display: flex; gap: 2px; margin-top: 16px; border-bottom: 1px solid var(--border-soft); }
  .tab-btn { background: transparent; border: none; color: var(--text-dim); padding: 7px 4px; margin-right: 18px; font-size: 12.5px; cursor: pointer; border-bottom: 2px solid transparent; font-weight: 500; }
  .tab-btn.active { color: var(--text); border-bottom-color: var(--accent); }

  .header-row { display: grid; grid-template-columns: 1fr 1fr 28px; gap: 6px; margin-top: 8px; }
  .header-row input { background: var(--panel-2); border: 1px solid var(--border); border-radius: 6px; padding: 6px 9px; font-family: var(--font-mono); font-size: 12.5px; }
  .header-row button { background: transparent; border: 1px solid var(--border); color: var(--text-dim); border-radius: 6px; cursor: pointer; font-size: 13px; }
  .header-row button:hover { color: var(--delete); border-color: var(--delete); }
  .add-header-btn { margin-top: 8px; background: transparent; border: 1px dashed var(--border); color: var(--text-muted); border-radius: 6px; padding: 5px 10px; font-size: 12px; cursor: pointer; }
  .add-header-btn:hover { color: var(--accent); border-color: var(--accent); }

  textarea.body-input { width: 100%; min-height: 120px; background: var(--panel-2); border: 1px solid var(--border); border-radius: 7px; padding: 10px 12px; font-family: var(--font-mono); font-size: 12.5px; margin-top: 8px; resize: vertical; }

  .response { flex: 1; overflow-y: auto; padding: 16px 20px; }
  .resp-empty { color: var(--text-dim); font-size: 12.5px; padding-top: 6px; }
  .resp-status-row { display: flex; align-items: center; gap: 12px; }
  .status-pill { font-family: var(--font-mono); font-weight: 700; font-size: 12px; padding: 3px 9px; border-radius: 5px; }
  .status-2xx { background: rgba(126,231,135,0.15); color: #7EE787; }
  .status-3xx { background: rgba(121,192,255,0.15); color: #79C0FF; }
  .status-4xx { background: rgba(242,204,96,0.15); color: #F2CC60; }
  .status-5xx { background: rgba(255,123,114,0.15); color: #FF7B72; }
  .resp-meta { font-family: var(--font-mono); font-size: 11.5px; color: var(--text-dim); }
  .resp-error { background: var(--danger-bg); border: 1px solid var(--delete); color: #FFB3AD; border-radius: 8px; padding: 12px 14px; font-size: 12.5px; margin-top: 10px; font-family: var(--font-mono); }
  pre.resp-body { font-family: var(--font-mono); font-size: 12px; white-space: pre-wrap; word-break: break-word; background: var(--panel-2); border: 1px solid var(--border); border-radius: 7px; padding: 12px 14px; margin-top: 10px; max-height: none; }
  .resp-headers-table { width: 100%; border-collapse: collapse; margin-top: 10px; font-family: var(--font-mono); font-size: 11.5px; }
  .resp-headers-table td { padding: 4px 8px; border-bottom: 1px solid var(--border-soft); vertical-align: top; }
  .resp-headers-table td:first-child { color: var(--text-muted); white-space: nowrap; }

  .footer { grid-area: footer; border-top: 1px solid var(--border); background: var(--panel); display: flex; align-items: stretch; padding: 0 14px; font-family: var(--font-mono); font-size: 11px; color: var(--text-muted); }
  kbd { background: var(--panel-2); border: 1px solid var(--border); border-bottom-width: 2px; border-radius: 4px; padding: 1px 5px; font-family: var(--font-mono); font-size: 10.5px; color: var(--text); }
  .footer-hint { flex: 1; display: flex; align-items: center; justify-content: space-between; cursor: pointer; border: none; background: transparent; }
  .footer-hint:hover .cmd-affordance { color: var(--text); }
  .cmd-affordance { color: var(--text-dim); display: flex; align-items: center; gap: 4px; }
  .command-bar { flex: 1; display: flex; align-items: center; gap: 8px; }
  .command-prompt { color: var(--accent); font-weight: 700; font-size: 13px; }
  input.command-input { flex: 1; background: transparent; border: none; color: var(--text); font-family: var(--font-mono); font-size: 12px; height: 100%; padding: 0; }
  input.command-input:focus { outline: none; }
  input.command-input::placeholder { color: var(--text-dim); }

  .modal-overlay { position: fixed; inset: 0; background: rgba(6,9,12,0.7); display: flex; align-items: center; justify-content: center; z-index: 50; }
  .modal { background: var(--panel); border: 1px solid var(--border); border-radius: 12px; width: 420px; max-width: 90vw; padding: 20px 22px; }
  .modal h3 { margin: 0 0 14px; font-size: 14px; font-family: var(--font-mono); color: var(--accent); }
  .shortcut-row { display: flex; justify-content: space-between; align-items: center; padding: 6px 0; font-size: 12.5px; border-bottom: 1px solid var(--border-soft); }
  .shortcut-row:last-child { border-bottom: none; }
  .modal-close { margin-top: 16px; width: 100%; background: var(--panel-2); border: 1px solid var(--border); color: var(--text); border-radius: 7px; padding: 8px; cursor: pointer; font-size: 12.5px; }
  .modal-close:hover { border-color: var(--accent); color: var(--accent); }
`;
