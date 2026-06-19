import type { JsonObject, JsonValue, ThemeDocument, ThemeLayer } from './types.js';

function isObject(value: JsonValue | undefined): value is JsonObject {
  return value !== null && !Array.isArray(value) && typeof value === 'object';
}

export function merge(base: JsonValue, override: JsonValue): JsonValue {
  if (!isObject(base) || !isObject(override)) return override;
  const result: JsonObject = { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (value === null) {
      delete result[key];
    } else if (isObject(result[key]) && isObject(value)) {
      result[key] = merge(result[key]!, value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

function resolveColor(value: JsonValue, palette: Record<string, JsonValue>, roles: Record<string, string>): JsonValue {
  if (typeof value !== 'string' || (!value.startsWith('@role.') && !value.startsWith('@palette.'))) {
    return value;
  }
  const [namespace, ...rest] = value.slice(1).split('.');
  const key = rest.join('.');
  const paletteKey = namespace === 'role' ? roles[key] : namespace === 'palette' ? key : undefined;
  if (!paletteKey || !(paletteKey in palette)) throw new Error(`unresolved color reference: ${value}`);
  return palette[paletteKey]!;
}

function resolveReferences(value: JsonValue, palette: Record<string, JsonValue>, roles: Record<string, string>): JsonValue {
  if (Array.isArray(value)) return value.map(item => resolveReferences(item, palette, roles));
  if (isObject(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, resolveReferences(item, palette, roles)]));
  }
  return resolveColor(value, palette, roles);
}

export function resolveTheme(document: ThemeDocument): ThemeLayer {
  const palette = merge(document.base.palette, document.overrides.palette) as Record<string, JsonValue>;
  const roles = merge(document.base.roles, document.overrides.roles) as Record<string, string>;
  const targets = merge(
    document.base.targets as unknown as JsonValue,
    document.overrides.targets as unknown as JsonValue,
  ) as unknown as ThemeLayer['targets'];
  return {
    palette,
    roles,
    targets: resolveReferences(targets as unknown as JsonValue, palette, roles) as unknown as ThemeLayer['targets'],
  };
}
