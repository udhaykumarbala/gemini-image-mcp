type PathSegment = string | number;

function parsePath(path: string): PathSegment[] {
  const segments: PathSegment[] = [];
  const parts = path.split(".");
  for (const part of parts) {
    const match = part.match(/^(\w+)\[(\d+)\]$/);
    if (match) {
      segments.push(match[1], parseInt(match[2], 10));
    } else {
      segments.push(part);
    }
  }
  return segments;
}

export function getByPath(obj: Record<string, unknown>, path: string): unknown {
  const segments = parsePath(path);
  let current: unknown = obj;
  for (const seg of segments) {
    if (current === null || current === undefined) return undefined;
    current = (current as Record<string | number, unknown>)[seg];
  }
  return current;
}

export function setByPath(obj: Record<string, unknown>, path: string, value: unknown): void {
  const segments = parsePath(path);
  let current: Record<string | number, unknown> = obj;
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i];
    const nextSeg = segments[i + 1];
    if (current[seg] === undefined || current[seg] === null) {
      current[seg] = typeof nextSeg === "number" ? [] : {};
    }
    current = current[seg] as Record<string | number, unknown>;
  }
  current[segments[segments.length - 1]] = value;
}

export function applyChanges(
  blueprint: Record<string, unknown>,
  changes: Record<string, unknown>
): Record<string, unknown> {
  const result = structuredClone(blueprint);
  for (const [path, value] of Object.entries(changes)) {
    setByPath(result, path, value);
  }
  return result;
}

export function listChangedPaths(changes: Record<string, unknown>): string[] {
  return Object.keys(changes);
}
