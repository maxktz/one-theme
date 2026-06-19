import type { JsonObject, JsonValue, ThemeDocument } from './types.js';

function object(value: JsonValue | unknown, label: string): JsonObject {
  if (value === null || Array.isArray(value) || typeof value !== 'object') {
    throw new Error(`${label} must be an object`);
  }
  return value as JsonObject;
}

function string(value: JsonValue | unknown, label: string): string {
  if (typeof value !== 'string') throw new Error(`${label} must be a string`);
  return value;
}

export function parseThemeDocument(raw: string): ThemeDocument {
  const value = object(JSON.parse(raw), 'theme');
  if (value.schemaVersion !== 1) throw new Error('theme.schemaVersion must be 1');
  string(value.name, 'theme.name');
  const source = object(value.source, 'theme.source');
  if (source.type !== 'neovim') throw new Error('theme.source.type must be "neovim"');
  string(source.colorscheme, 'theme.source.colorscheme');
  string(source.runtimePath, 'theme.source.runtimePath');
  string(source.importedAt, 'theme.source.importedAt');
  object(value.base, 'theme.base');
  object(value.overrides, 'theme.overrides');
  return value as unknown as ThemeDocument;
}
