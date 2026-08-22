import { useRef, useState } from "react";
import type { RestWorkspace } from "../hooks/useRestWorkspace";
import type { HeaderKV, HttpMethod } from "../types";
import { METHODS } from "../domain/constants";
import { focusRelative } from "../domain/focusRelative";

export function RequestEditor({ workspace }: { workspace: RestWorkspace }) {
  const req = workspace.selectedRequest!;
  const [activeTab, setActiveTab] = useState<"headers" | "body">("headers");
  const editorRef = useRef<HTMLDivElement>(null);

  function addHeader() {
    workspace.updateHeaders([...req.headers, { key: "", value: "" }]);
  }
  function updateHeader(idx: number, field: "key" | "value", value: string) {
    const next: HeaderKV[] = req.headers.map((h, i) => (i === idx ? { ...h, [field]: value } : h));
    workspace.updateHeaders(next);
  }
  function removeHeader(idx: number) {
    const next = req.headers.filter((_, i) => i !== idx);
    workspace.updateHeaders(next.length ? next : [{ key: "", value: "" }]);
  }

  return (
    <div
      ref={editorRef}
      className="editor"
      onFocus={() => workspace.setActiveZone("editor")}
      onKeyDown={(e) => {
        const tag = (e.target as HTMLElement).tagName;
        const isTextField = tag === "INPUT" || tag === "TEXTAREA";
        const isSelect = tag === "SELECT";
        const lettersOK = !isTextField && !isSelect;
        const arrowsOK = tag !== "SELECT" && tag !== "TEXTAREA";

        if (e.key === "Escape") {
          e.preventDefault();
          workspace.focusSidebarFromEditor();
          return;
        }
        if ((e.key === "h" && lettersOK) || (e.key === "ArrowLeft" && lettersOK)) {
          e.preventDefault();
          workspace.focusSidebarFromEditor();
          return;
        }
        if ((e.key === "ArrowDown" && arrowsOK) || (e.key === "j" && lettersOK)) {
          e.preventDefault();
          focusRelative(editorRef, 1);
          return;
        }
        if ((e.key === "ArrowUp" && arrowsOK) || (e.key === "k" && lettersOK)) {
          e.preventDefault();
          focusRelative(editorRef, -1);
          return;
        }
      }}
    >
      <input
        ref={workspace.nameInputRef}
        className="name-input"
        placeholder="Untitled request — give it a name"
        value={req.name}
        onChange={(e) => workspace.updateSelected({ name: e.target.value })}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            workspace.urlInputRef.current?.focus();
          }
        }}
      />

      <div className="url-row">
        <select
          className="method-select"
          value={req.method}
          onChange={(e) => workspace.updateSelected({ method: e.target.value as HttpMethod })}
        >
          {METHODS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <input
          ref={workspace.urlInputRef}
          className="url-input"
          placeholder="https://api.example.com/resource"
          value={req.url}
          onChange={(e) => workspace.updateSelected({ url: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              workspace.handleSend();
            }
          }}
        />
        <button className="send-btn" disabled={workspace.loading} onClick={() => workspace.handleSend()}>
          {workspace.loading ? "Sending…" : "Send"}
        </button>
      </div>

      <div className="tabs" role="tablist">
        <button
          role="tab"
          aria-selected={activeTab === "headers"}
          className={`tab-btn ${activeTab === "headers" ? "active" : ""}`}
          onClick={() => setActiveTab("headers")}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight" && ["POST", "PUT", "PATCH"].includes(req.method)) setActiveTab("body");
          }}
        >
          Headers{" "}
          {req.headers.filter((h) => h.key.trim()).length > 0 &&
            `(${req.headers.filter((h) => h.key.trim()).length})`}
        </button>
        {["POST", "PUT", "PATCH"].includes(req.method) && (
          <button
            role="tab"
            aria-selected={activeTab === "body"}
            className={`tab-btn ${activeTab === "body" ? "active" : ""}`}
            onClick={() => setActiveTab("body")}
            onKeyDown={(e) => {
              if (e.key === "ArrowLeft") setActiveTab("headers");
            }}
          >
            Body
          </button>
        )}
      </div>

      {activeTab === "headers" ? (
        <div>
          {req.headers.map((h, idx) => (
            <div className="header-row" key={idx}>
              <input placeholder="Header name" value={h.key} onChange={(e) => updateHeader(idx, "key", e.target.value)} />
              <input
                placeholder="Value"
                value={h.value}
                onChange={(e) => updateHeader(idx, "value", e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && idx === req.headers.length - 1) {
                    e.preventDefault();
                    addHeader();
                  }
                }}
              />
              <button title="Remove header" onClick={() => removeHeader(idx)}>
                ×
              </button>
            </div>
          ))}
          <button className="add-header-btn" onClick={addHeader}>
            + Add header
          </button>
        </div>
      ) : (
        <textarea
          className="body-input"
          placeholder='{ "key": "value" }'
          value={req.body}
          onChange={(e) => workspace.updateSelected({ body: e.target.value })}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              workspace.handleSend();
            }
          }}
        />
      )}
    </div>
  );
}
