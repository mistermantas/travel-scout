import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

interface SeenFile {
  seen_keys?: string[];
}

export class SeenStore {
  private seen = new Set<string>();

  constructor(private readonly storePath: string) {}

  async load(): Promise<void> {
    try {
      const data = JSON.parse(await readFile(this.storePath, "utf8")) as SeenFile;
      this.seen = new Set(data.seen_keys ?? []);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      this.seen = new Set();
    }
  }

  isNew(key: string): boolean {
    return !this.seen.has(key);
  }

  async markMany(keys: string[]): Promise<void> {
    for (const key of keys) this.seen.add(key);
    await mkdir(path.dirname(this.storePath), { recursive: true });
    await writeFile(
      this.storePath,
      `${JSON.stringify({ seen_keys: Array.from(this.seen).sort() }, null, 2)}\n`,
      "utf8"
    );
  }
}
