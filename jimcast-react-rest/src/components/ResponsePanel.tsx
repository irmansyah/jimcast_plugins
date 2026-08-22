import { useRef, useState } from "react";
import type { RestWorkspace } from "../hooks/useRestWorkspace";
import { focusRelative } from "../domain/focusRelative";

function statusClass(status?: number) {
  if (!status) return "";
  if (status < 300) return "status-2xx";
  if (status < 400) return "status-3xx";
  if (status < 500) return "status-4xx";
  return "status-5xx";
}

export function ResponsePanel({ workspace }: { workspace: RestWorkspace }) {
  const { response, loading, urlInputRef } = workspace;
  const [respTab, setRespTab] = useState<"body" | "headers">("body");
  const responseRef = useRef<HTMLDivElement>(null);

  return (
    <div
      className="response"
      ref={responseRef}
      onFocus={() => workspace.setActiveZone("response")}
      tabIndex={-1}
      onKeyDown={(e) => {
        const tag = (e.target as HTMLElement).tagName;
        const lettersOK = tag !== "INPUT" && tag !== "TEXTAREA" && tag !== "SELECT";
        if (e.key === "Escape" || (lettersOK && (e.key === "h" || e.key === "ArrowLeft"))) {
          e.preventDefault();
          urlInputRef.current?.focus();
        } else if (lettersOK && (e.key === "j" || e.key === "ArrowDown")) {
          e.preventDefault();
          focusRelative(responseRef, 1);
        } else if (lettersOK && (e.key === "k" || e.key === "ArrowUp")) {
          e.preventDefault();
          focusRelative(responseRef, -1);
        }
      }}
    >
      {loading && <div className="resp-empty">Sending request…</div>}
      {!loading && !response && <div className="resp-empty">Send a request (⌘/Ctrl+↵) to see the response here.</div>}
      {!loading && response && response.error && <div className="resp-error">{response.message}</div>}
      {!loading && response && !response.error && (
        <div>
          <div className="resp-status-row">
            <span className={`status-pill ${statusClass(response.status)}`}>
              {response.status} {response.statusText}
            </span>
            <span className="resp-meta">
              {response.timeMs} ms · {response.sizeBytes} B
            </span>
          </div>
          <div className="tabs" role="tablist" style={{ marginTop: 12 }}>
            <button role="tab" className={`tab-btn ${respTab === "body" ? "active" : ""}`} onClick={() => setRespTab("body")}>
              Body
            </button>
            <button
              role="tab"
              className={`tab-btn ${respTab === "headers" ? "active" : ""}`}
              onClick={() => setRespTab("headers")}
            >
              Headers ({(response.headers || []).length})
            </button>
          </div>
          {respTab === "body" ? (
            <pre className="resp-body">{response.body || "(empty body)"}</pre>
          ) : (
            <table className="resp-headers-table">
              <tbody>
                {(response.headers || []).map(([k, v]) => (
                  <tr key={k}>
                    <td>{k}</td>
                    <td>{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
