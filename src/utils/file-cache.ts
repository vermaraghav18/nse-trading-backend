import { promises as fs } from "fs";
import path from "path";

const CACHE_DIR = path.join(process.cwd(), ".cache");

async function ensureCacheDir(): Promise<void> {
  await fs.mkdir(CACHE_DIR, { recursive: true });
}

function getCacheFilePath(fileName: string): string {
  return path.join(CACHE_DIR, fileName);
}

export async function readJsonCacheFile<T>(fileName: string): Promise<T | null> {
  try {
    await ensureCacheDir();
    const filePath = getCacheFilePath(fileName);
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch (error: any) {
    if (error?.code !== "ENOENT") {
      console.error(`[file-cache] Failed reading ${fileName}:`, error);
    }
    return null;
  }
}

export async function writeJsonCacheFile<T>(
  fileName: string,
  value: T
): Promise<void> {
  try {
    await ensureCacheDir();
    const filePath = getCacheFilePath(fileName);
    await fs.writeFile(filePath, JSON.stringify(value, null, 2), "utf8");
  } catch (error) {
    console.error(`[file-cache] Failed writing ${fileName}:`, error);
  }
}