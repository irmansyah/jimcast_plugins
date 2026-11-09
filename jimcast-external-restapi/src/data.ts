// [plugin] jimcast-external-restapi/src/data.ts
import {
  DEFAULT_VARIABLE_DIR,
  DIR,
  PRE,
  isNonEmptyFile,
  jqFilter,
  readRawState,
  shPath,
  shq,
  type Exec,
} from "./shell.js";

// ── Config format ───────────────────────────────────────────────────────────
export interface ReqBody {
  body_type?: string;
  body_file?: string;
}

export interface ApiRequest {
  req_tag: string;
  req_title: string;
  req_type: string;
  req_end_point: string;
  req_variable_type?: string;
  req_variable_is_save?: boolean;
  req_variable_response_value?: Record<string, string>;
  req_body?: ReqBody | null;
}

export interface ApiConfig {
  app_title?: string;
  base_url: string;
  variable_dir?: string;
  variable_access_token_file?: string;
  headers?: Record<string, string>;
  requests: ApiRequest[];
}

export const DEFAULT_TOKEN_FILE = "ACCESS_TOKEN.txt";

const METHOD_RE = /^[A-Z]{3,7}$/;
const NAME_RE = /^[A-Za-z0-9_.-]+$/; // variable file names
const PATH_RE = /^[A-Za-z0-9_.[\]-]+$/; // response field paths

// ── Request building ────────────────────────────────────────────────────────
export const methodOf = (r: ApiRequest) => String(r.req_type ?? "GET").toUpperCase();

export const urlOf = (cfg: ApiConfig, r: ApiRequest) =>
  cfg.base_url.replace(/\/+$/, "") +
  (r.req_end_point.startsWith("/") ? r.req_end_point : `/${r.req_end_point}`);

const variableDir = (cfg: ApiConfig) => cfg.variable_dir ?? DEFAULT_VARIABLE_DIR;
export const tokenFile = (cfg: ApiConfig) => cfg.variable_access_token_file ?? DEFAULT_TOKEN_FILE;
export const varPath = (cfg: ApiConfig, name: string) => `${shPath(variableDir(cfg))}"/${name}"`;

export const isBearer = (r: ApiRequest) => (r.req_variable_type ?? "").toLowerCase() === "bearer";

function saveBlock(cfg: ApiConfig, r: ApiRequest): string {
  if (!r.req_variable_is_save || !r.req_variable_response_value) return "";
  const entries = Object.entries(r.req_variable_response_value).filter(
    ([file, path]) => NAME_RE.test(file) && PATH_RE.test(path),
  );
  if (!entries.length) return "";
  const lines = entries.map(
    ([file, path]) => `    v=$(jq -r '${jqFilter(path)} // empty' "$d/body" 2>/dev/null)
    if [ -n "$v" ]; then printf %s "$v" > ${varPath(cfg, file)}; saved="$saved ${file}"; fi`,
  );
  return `case "$code" in
  2*)
    if command -v jq >/dev/null 2>&1; then
      mkdir -p ${shPath(variableDir(cfg))}
${lines.join("\n")}
    else saved=" (jq missing: nothing saved)"; fi;;
esac`;
}

// h = ready-made " -H 'k: v'" args, b = body arg (or empty), u = quoted URL.
// In the built-in these travelled as {h} {b} {u} params; here they are
// interpolated straight into the script (actions are closures now).
function runParts(cfg: ApiConfig, r: ApiRequest): { u: string; h: string; b: string } {
  const h = Object.entries(cfg.headers ?? {})
    .map(([k, v]) => ` -H ${shq(`${k}: ${v}`)}`)
    .join("");
  const file = r.req_body?.body_file;
  const b =
    file && (r.req_body?.body_type ?? "RAW").toUpperCase() === "RAW"
      ? `--data-binary @${shPath(file)}`
      : "";
  return { u: shq(urlOf(cfg, r)), h, b };
}

// Script builder that needs the model types, so it lives here rather than in
// shell.ts (shell.ts must not import from data.ts).
export function runCmd(cfg: ApiConfig, r: ApiRequest): string {
  const bearer = isBearer(r);
  const { u, h, b } = runParts(cfg, r);
  return `${PRE}
d="${DIR}"
rm -f "$d/body" "$d/headers" "$d/err" "$d/out"
printf %s ${shq(r.req_tag)} > "$d/selected"
${bearer ? `tok=$(cat ${varPath(cfg, tokenFile(cfg))} 2>/dev/null)` : ""}
curl -sS -m 15 -X ${methodOf(r)} -D "$d/headers" -o "$d/body" ${h} ${bearer ? '-H "Authorization: Bearer $tok"' : ""} ${b} ${u} 2> "$d/err"
rc=$?
if [ $rc -ne 0 ]; then
  echo "error|$(tr '\\n' ' ' < "$d/err" | cut -c1-200)" > "$d/status"
  : > "$d/out"
  exit 0
fi
line=$(grep -i '^HTTP/' "$d/headers" | tail -1 | tr -d '\\r')
code=$(echo "$line" | cut -d' ' -f2)
saved=""
${saveBlock(cfg, r)}
echo "ok|$line|$saved" > "$d/status"
if command -v jq >/dev/null 2>&1 && jq . "$d/body" > "$d/out" 2>/dev/null; then :; else head -c 20000 "$d/body" > "$d/out"; fi
`;
}

// ── State ───────────────────────────────────────────────────────────────────
export interface State {
  config: string; // active config file name
  configs: string[]; // all config file names
  cfg: ApiConfig | null;
  cfgError: string;
  selected: string; // req_tag of the last run
  status: string; // raw "kind|text|saved"
  out: string[];
  hasToken: boolean;
}

export function parseConfig(raw: string): { cfg: ApiConfig | null; error: string } {
  if (!raw) return { cfg: null, error: "" };
  try {
    const j = JSON.parse(raw);
    if (!j || typeof j.base_url !== "string" || !Array.isArray(j.requests)) {
      return { cfg: null, error: "config needs base_url and requests[]" };
    }
    const requests = (j.requests as ApiRequest[]).filter(
      (r) =>
        r &&
        typeof r.req_tag === "string" &&
        typeof r.req_end_point === "string" &&
        METHOD_RE.test(String(r.req_type ?? "GET").toUpperCase()),
    );
    return { cfg: { ...j, requests }, error: "" };
  } catch (e) {
    return { cfg: null, error: `invalid JSON: ${(e as Error).message}` };
  }
}

export async function loadState(ctx: Exec): Promise<State> {
  const raw = await readRawState(ctx);
  const st: State = {
    config: "",
    configs: [],
    cfg: null,
    cfgError: "",
    selected: "",
    status: "",
    out: [],
    hasToken: false,
  };
  const lines = raw.split("\n");
  const sep = lines.indexOf("---");
  const head = sep < 0 ? lines : lines.slice(0, sep);
  st.out = sep < 0 ? [] : lines.slice(sep + 1);
  for (const line of head) {
    const i = line.indexOf("=");
    if (i < 0) continue;
    const k = line.slice(0, i);
    const v = line.slice(i + 1).trim();
    if (k === "config") st.config = v;
    else if (k === "configs" && v) st.configs.push(v);
    else if (k === "selected") st.selected = v;
    else if (k === "status") st.status = v;
    else if (k === "cfg") {
      const p = parseConfig(v);
      st.cfg = p.cfg;
      st.cfgError = p.error;
    }
  }
  if (st.cfg) {
    st.hasToken = await isNonEmptyFile(ctx, varPath(st.cfg, tokenFile(st.cfg)));
  }
  return st;
}
