// [plugin] jim-finder/src/colors.ts
import { extOf } from "./shell.js";

export type FileCategory =
  | "image" | "video" | "audio" | "document" | "text"
  | "code" | "data" | "archive" | "executable" | "other";

const sets: Record<Exclude<FileCategory, "other">, string[]> = {
  image: ["png", "jpg", "jpeg", "gif", "webp", "bmp", "tif", "tiff", "heic", "heif", "ico", "svg", "raw", "psd"],
  video: ["mp4", "mov", "mkv", "avi", "webm", "m4v", "wmv", "flv"],
  audio: ["mp3", "wav", "flac", "aac", "m4a", "ogg", "aiff", "opus"],
  document: ["pdf", "doc", "docx", "pages", "ppt", "pptx", "key", "xls", "xlsx", "numbers", "odt", "rtf", "epub"],
  text: ["txt", "md", "markdown", "log", "rst", "tex"],
  code: ["ts", "tsx", "js", "jsx", "mjs", "cjs", "py", "rb", "go", "rs", "c", "h", "cpp", "hpp", "java", "kt", "swift",
         "sh", "zsh", "bash", "fish", "php", "lua", "sql", "html", "css", "scss", "vue", "svelte"],
  data: ["json", "yaml", "yml", "toml", "xml", "ini", "csv", "tsv", "plist", "env", "conf", "lock"],
  archive: ["zip", "tar", "gz", "tgz", "bz2", "xz", "7z", "rar", "zst", "iso", "dmg"],
  executable: ["app", "pkg", "exe", "bin", "command", "dylib", "so"],
};

const BY_EXT = new Map<string, FileCategory>();
for (const [cat, exts] of Object.entries(sets)) for (const e of exts) BY_EXT.set(e, cat as FileCategory);

const CODE_NAMES = new Set(["makefile", "dockerfile", "rakefile", "gemfile", "procfile"]);

export function fileCategory(name: string): FileCategory {
  const lower = name.toLowerCase();
  if (CODE_NAMES.has(lower)) return "code";
  if (lower.startsWith(".") && lower.indexOf(".", 1) === -1) return "data"; // .zshrc, .gitignore
  return BY_EXT.get(extOf(lower)) ?? "other";
}
