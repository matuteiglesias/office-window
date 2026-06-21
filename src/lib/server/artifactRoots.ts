import { readdir, readFile, stat } from "fs/promises";
import path from "path";

export type ArtifactText = {
  exists: boolean;
  relPath: string;
  absPath: string;
  content: string;
  size: number | null;
  mtimeMs: number | null;
};

export type ArtifactDirEntry = {
  name: string;
  relPath: string;
  absPath: string;
  isDirectory: boolean;
  isFile: boolean;
  size: number | null;
  mtimeMs: number | null;
};

export function getArtifactsRoot(): string {
  return path.resolve(
    process.env.OFFICE_ARTIFACTS_ROOT ||
      "/home/matias/repos/office-auto-lab/artifacts",
  );
}

function assertSafeSegments(segments: string[]): void {
  for (const segment of segments) {
    if (!segment || segment.includes("\0")) {
      throw new Error("Unsafe empty/null path segment.");
    }
    if (path.isAbsolute(segment)) {
      throw new Error(`Unsafe absolute path segment: ${segment}`);
    }
    const parts = segment.split(/[\\/]+/);
    if (parts.includes("..")) {
      throw new Error(`Unsafe path traversal segment: ${segment}`);
    }
  }
}

export function safeArtifactPath(...segments: string[]): string {
  assertSafeSegments(segments);
  const root = getArtifactsRoot();
  const target = path.resolve(root, ...segments);

  if (target !== root && !target.startsWith(root + path.sep)) {
    throw new Error("Resolved path escaped OFFICE_ARTIFACTS_ROOT.");
  }

  return target;
}

export function relArtifactPath(absPath: string): string {
  return path.relative(getArtifactsRoot(), absPath);
}

export async function readArtifactText(
  segments: string[],
  maxBytes = 512_000,
): Promise<ArtifactText> {
  const absPath = safeArtifactPath(...segments);
  const relPath = relArtifactPath(absPath);

  try {
    const s = await stat(absPath);
    if (!s.isFile()) {
      return { exists: false, relPath, absPath, content: "", size: null, mtimeMs: null };
    }

    const handle = await readFile(absPath);
    const sliced = handle.subarray(0, Math.min(handle.length, maxBytes));
    return {
      exists: true,
      relPath,
      absPath,
      content: sliced.toString("utf8"),
      size: s.size,
      mtimeMs: s.mtimeMs,
    };
  } catch {
    return { exists: false, relPath, absPath, content: "", size: null, mtimeMs: null };
  }
}

export async function listArtifactDir(
  segments: string[],
): Promise<ArtifactDirEntry[]> {
  const absDir = safeArtifactPath(...segments);

  try {
    const entries = await readdir(absDir, { withFileTypes: true });
    const out: ArtifactDirEntry[] = [];

    for (const entry of entries) {
      const absPath = path.join(absDir, entry.name);
      let size: number | null = null;
      let mtimeMs: number | null = null;

      try {
        const s = await stat(absPath);
        size = s.size;
        mtimeMs = s.mtimeMs;
      } catch {
        // Keep listing robust.
      }

      out.push({
        name: entry.name,
        relPath: relArtifactPath(absPath),
        absPath,
        isDirectory: entry.isDirectory(),
        isFile: entry.isFile(),
        size,
        mtimeMs,
      });
    }

    return out.sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}
