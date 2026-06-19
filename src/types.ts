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
  targets: {
    neovim: NeovimThemeData;
    herdr: { colors: Record<string, string> };
  };
}

export interface ThemeOverrides {
  palette: Record<string, JsonValue>;
  roles: Record<string, string>;
  targets: {
    neovim: { highlights: Record<string, Record<string, JsonValue>> };
    herdr: { colors: Record<string, string> };
  };
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
