export type JsonScalar = string | number | boolean | null;
export type JsonValue = JsonScalar | JsonObject | JsonValue[];
export interface JsonObject { [key: string]: JsonValue }

export interface ThemeSource {
  type: 'neovim';
  colorscheme: string;
  runtimePath: string;
  revision: string | null;
  importedAt: string;
}

export interface NeovimThemeData {
  highlights: Record<string, Record<string, JsonValue>>;
  terminalColors: Record<string, string>;
}

export interface ThemeLayer {
  palette: Record<string, JsonValue>;
  roles: Record<string, string>;
  targets: ThemeTargets;
}

export interface ThemeOverrides {
  palette: Record<string, JsonValue>;
  roles: Record<string, string>;
  targets: ThemeTargetOverrides;
}

export interface ThemeDocument {
  schemaVersion: 1;
  name: string;
  source: ThemeSource;
  base: ThemeLayer;
  overrides: ThemeOverrides;
}

export interface ImportedNeovimTheme {
  palette: Record<string, JsonValue>;
  highlights: Record<string, Record<string, JsonValue>>;
  terminalColors: Record<string, string>;
}

export interface ColorMappedTarget {
  colors: Record<string, string>;
}

export interface ThemeTargets {
  neovim: NeovimThemeData;
  herdr: ColorMappedTarget;
  claude?: ColorMappedTarget;
  codex?: ColorMappedTarget;
  [target: string]: JsonValue | NeovimThemeData | ColorMappedTarget | undefined;
}

export interface ThemeTargetOverrides {
  neovim: { highlights: Record<string, Record<string, JsonValue>> };
  herdr: ColorMappedTarget;
  claude?: ColorMappedTarget;
  codex?: ColorMappedTarget;
  [target: string]: JsonValue | { highlights: Record<string, Record<string, JsonValue>> } | ColorMappedTarget | undefined;
}
