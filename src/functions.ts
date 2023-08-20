import { mkdir, writeFile } from "fs/promises";

export function log(message: string): void {
  console.log(`[${new Date().toISOString()}]: ${message}`);
}

export async function writeJSON(name: string, data: Record<string, unknown>) {
  await mkdir("data/playlists", { recursive: true });
  await mkdir("data/top/artists", { recursive: true });
  await mkdir("data/top/tracks", { recursive: true });
  await mkdir("data/shows", { recursive: true });
  writeFile(`data/${name}.json`, JSON.stringify(data), {});
}

export async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function* chunk<T>(arr: T[], n: number): Generator<T[], void> {
  for (let i = 0; i < arr.length; i += n) {
    yield arr.slice(i, i + n);
  }
}

export function difference<T>(setA: Set<T>, setB: Set<T>) {
  const _difference = new Set(setA);
  for (const elem of setB) {
    _difference.delete(elem);
  }
  return _difference;
}
