import fs from "node:fs/promises";

export async function pathExists(p: string): Promise<boolean> {
  return fs.access(p).then(
    () => true,
    () => false
  );
}

export async function readJson<T>(p: string): Promise<T> {
  const text = await fs.readFile(p, "utf8");
  return JSON.parse(text) as T;
}

// Normalize an MSYS / Git Bash POSIX path like `/c/work/foo` to a Windows
// path `C:/work/foo` when running on win32. Node's path.resolve treats a
// leading "/" as drive-relative, so `/c/work` becomes `C:\c\work` (a phantom
// nested dir). This converter restores the intended drive-letter form.
export function normalizeMsysPath(value: string): string {
  if (!value || process.platform !== "win32") {
    return value;
  }
  const match = value.match(/^\/([a-zA-Z])\/(.*)$/);
  if (!match) {
    return value;
  }
  return `${(match[1] ?? "").toUpperCase()}:/${match[2] ?? ""}`;
}
