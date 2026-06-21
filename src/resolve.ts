import type { ColorValue, ResolvedSyntaxStyle, ResolvedTheme, SyntaxValue, ThemeDocument } from './types.js';

export function resolveColor(theme: ThemeDocument, value: ColorValue): string {
  if (value.startsWith('#')) return value;
  const key = value.slice('@color.'.length);
  const color = theme.colors[key];
  if (!color) throw new Error(`unresolved color reference: ${value}`);
  return color;
}

export function resolveSyntax(theme: ThemeDocument, value: SyntaxValue): ResolvedSyntaxStyle {
  if (typeof value === 'string') return { color: resolveColor(theme, value) };
  return {
    ...value,
    color: resolveColor(theme, value.color),
  };
}

export function resolveTheme(theme: ThemeDocument): ResolvedTheme {
  return {
    name: theme.name,
    appearance: theme.appearance,
    colors: theme.colors,
    ui: Object.fromEntries(Object.entries(theme.ui).map(([key, value]) => [key, resolveColor(theme, value)])) as ResolvedTheme['ui'],
    syntax: Object.fromEntries(Object.entries(theme.syntax).map(([key, value]) => [key, resolveSyntax(theme, value)])),
    terminal: Object.fromEntries(Object.entries(theme.terminal).map(([key, value]) => [key, resolveColor(theme, value)])) as ResolvedTheme['terminal'],
  };
}
