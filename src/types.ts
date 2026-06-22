export type Appearance = 'dark' | 'light';
export type ColorRef = `@color.${string}`;
export type ColorValue = `#${string}` | ColorRef;

export interface SyntaxStyle {
  color: ColorValue;
  italic?: boolean;
  bold?: boolean;
  underline?: boolean;
}

export type SyntaxValue = ColorValue | SyntaxStyle;

export interface UiTheme {
  background: ColorValue;
  panel: ColorValue;
  elevated: ColorValue;
  selection: ColorValue;
  border: ColorValue;
  borderFocused: ColorValue;
  text: ColorValue;
  textMuted: ColorValue;
  textSubtle: ColorValue;
  file: ColorValue;
  directory: ColorValue;
  ignored: ColorValue;
  lineNumber: ColorValue;
  cursorLine: ColorValue;
  accent: ColorValue;
  success: ColorValue;
  warning: ColorValue;
  error: ColorValue;
  info: ColorValue;
  hint: ColorValue;
  special: ColorValue;
  interrupted: ColorValue;
  gitAdded: ColorValue;
  gitChanged: ColorValue;
  gitDeleted: ColorValue;
  diffAdded: ColorValue;
  diffChanged: ColorValue;
  diffDeleted: ColorValue;
}

export interface TerminalTheme {
  black: ColorValue;
  red: ColorValue;
  green: ColorValue;
  yellow: ColorValue;
  blue: ColorValue;
  magenta: ColorValue;
  cyan: ColorValue;
  white: ColorValue;
  brightBlack: ColorValue;
  brightRed: ColorValue;
  brightGreen: ColorValue;
  brightYellow: ColorValue;
  brightBlue: ColorValue;
  brightMagenta: ColorValue;
  brightCyan: ColorValue;
  brightWhite: ColorValue;
}

export interface ThemeDocument {
  $schema?: string;
  name: string;
  appearance: Appearance;
  colors: Record<string, `#${string}`>;
  ui: UiTheme;
  syntax: Record<string, SyntaxValue>;
  terminal: TerminalTheme;
}

export type AppName = string;

export interface AppConfigBase {
  previousTheme?: string;
}

export interface NeovimAppConfig extends AppConfigBase {
  transparency: boolean;
}

export interface HerdrAppConfig extends AppConfigBase {
  transparency: boolean;
}

export interface GhosttyAppConfig extends AppConfigBase {}

export interface ClaudeAppConfig extends AppConfigBase {}

export interface CodexAppConfig extends AppConfigBase {}

export type AppConfig = AppConfigBase & {
  transparency?: boolean;
};

export interface OneThemeConfig {
  $schema?: string;
  activeTheme: string;
  apps: {
    neovim: NeovimAppConfig;
    herdr: HerdrAppConfig;
    ghostty: GhosttyAppConfig;
    claude: ClaudeAppConfig;
    codex: CodexAppConfig;
  } & Record<string, AppConfig>;
}

export interface ResolvedSyntaxStyle {
  color: string;
  italic?: boolean;
  bold?: boolean;
  underline?: boolean;
}

export interface ResolvedTheme {
  name: string;
  appearance: Appearance;
  colors: Record<string, string>;
  ui: Record<keyof UiTheme, string>;
  syntax: Record<string, ResolvedSyntaxStyle>;
  terminal: Record<keyof TerminalTheme, string>;
}

export interface GeneratedOutput {
  target: string;
  path: string;
  content: string;
}

export interface AppAdapter<TConfig extends AppConfigBase = AppConfigBase> {
  name: AppName;
  label: string;
  defaultConfig: TConfig;
  outputPath(): string;
  generate(theme: ResolvedTheme, config: TConfig): string;
  writeGenerated?: boolean;
  detect(): Promise<boolean>;
  currentTheme(): Promise<string | null>;
  activate(config: TConfig, theme?: ResolvedTheme): Promise<string | undefined>;
  deactivate(config: TConfig): Promise<string | undefined>;
}
