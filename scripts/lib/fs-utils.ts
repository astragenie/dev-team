import fs from "node:fs/promises";

export async function pathExists(p: string): Promise<boolean> {
  return fs.access(p).then(() => true, () => false);
}

export async function readJson<T>(p: string): Promise<T> {
  const text = await fs.readFile(p, "utf8");
  return JSON.parse(text) as T;
}
