import fs from 'node:fs/promises';
import { atomicWrite, readIfExists, realPathIfExists } from '../files.js';
import { codexConfigPath, codexThemePath, generatedTheme } from '../paths.js';
import type { AppAdapter, CodexAppConfig, ResolvedSyntaxStyle, ResolvedTheme } from '../types.js';

interface ThemeEntry {
  name: string;
  scope?: string;
  foreground?: string;
  fontStyle?: string | undefined;
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function syntax(theme: ResolvedTheme, key: string, fallback: string): ResolvedSyntaxStyle {
  return theme.syntax[key] ?? { color: fallback };
}

function fontStyle(style: ResolvedSyntaxStyle): string | undefined {
  const styles = [
    style.italic ? 'italic' : '',
    style.bold ? 'bold' : '',
    style.underline ? 'underline' : '',
  ].filter(Boolean);
  return styles.length > 0 ? styles.join(' ') : undefined;
}

function entryXml(entry: ThemeEntry): string {
  const lines = ['    <dict>', `      <key>name</key><string>${escapeXml(entry.name)}</string>`];
  if (entry.scope) lines.push(`      <key>scope</key><string>${escapeXml(entry.scope)}</string>`);
  lines.push('      <key>settings</key><dict>');
  if (entry.foreground) lines.push(`        <key>foreground</key><string>${entry.foreground}</string>`);
  if (entry.fontStyle !== undefined) lines.push(`        <key>fontStyle</key><string>${escapeXml(entry.fontStyle)}</string>`);
  lines.push('      </dict>');
  lines.push('    </dict>');
  return lines.join('\n');
}

export function generateCodex(theme: ResolvedTheme): string {
  const keyword = syntax(theme, 'keyword', theme.ui.special);
  const string = syntax(theme, 'string', theme.ui.success);
  const comment = syntax(theme, 'comment', theme.ui.textMuted);
  const entries: ThemeEntry[] = [
    { name: 'Global' },
    {
      name: 'Comments',
      scope: 'comment',
      foreground: comment.color,
      fontStyle: fontStyle(comment) ?? '',
    },
    {
      name: 'Strings',
      scope: 'string',
      foreground: string.color,
      fontStyle: fontStyle(string),
    },
    {
      name: 'Links',
      scope: [
        'markup.underline.link',
        'markup.underline.link.markdown',
        'markup.underline.link.image.markdown',
        'markup.underline.link.inline.markdown',
        'string.other.link',
        'string.other.link.description.markdown',
        'string.other.link.title.markdown',
      ].join(', '),
      foreground: theme.ui.accent,
    },
    {
      name: 'Inline Code',
      scope: [
        'markup.inline.raw',
        'markup.inline.raw.string.markdown',
        'markup.raw.inline',
        'markup.raw.inline.markdown',
        'markup.raw',
        'markup.raw.markdown',
        'markup.fenced_code.block.markdown',
        'markup.raw.block.markdown',
      ].join(', '),
      foreground: theme.ui.accent,
    },
    {
      name: 'Keywords',
      scope: 'keyword, keyword.control, storage, storage.type, storage.modifier',
      foreground: keyword.color,
      fontStyle: fontStyle(keyword),
    },
    {
      name: 'Functions',
      scope: 'entity.name.function, entity.name.tag, support.function',
      foreground: theme.ui.text,
    },
    {
      name: 'Variables',
      scope: 'variable',
      foreground: syntax(theme, 'variable', theme.ui.text).color,
    },
    {
      name: 'Properties',
      scope: 'variable.other.property, support.variable.property',
      foreground: syntax(theme, 'property', theme.ui.text).color,
    },
    {
      name: 'Types',
      scope: 'entity.name.type, support.type',
      foreground: theme.ui.accent,
    },
    {
      name: 'Constants',
      scope: 'constant, constant.numeric, constant.language, constant.other',
      foreground: syntax(theme, 'constant', theme.ui.info).color,
    },
    {
      name: 'Operators',
      scope: 'keyword.operator',
      foreground: theme.ui.textSubtle,
    },
    {
      name: 'Punctuation',
      scope: 'punctuation',
      foreground: theme.ui.text,
    },
    {
      name: 'Brackets',
      scope: 'punctuation.definition, punctuation.section',
      foreground: theme.ui.text,
    },
    {
      name: 'Headings',
      scope: 'markup.heading, entity.name.section',
      foreground: theme.ui.accent,
      fontStyle: 'bold',
    },
    {
      name: 'Errors',
      scope: 'invalid, invalid.illegal',
      foreground: theme.ui.error,
    },
  ];

  const globalSettings = [
    '    <dict>',
    '      <key>name</key><string>Global</string>',
    '      <key>settings</key><dict>',
    `        <key>foreground</key><string>${theme.ui.text}</string>`,
    `        <key>background</key><string>${theme.ui.background}</string>`,
    `        <key>selection</key><string>${theme.ui.accent}</string>`,
    `        <key>selectionForeground</key><string>${theme.ui.background}</string>`,
    `        <key>caret</key><string>${theme.ui.accent}</string>`,
    `        <key>lineHighlight</key><string>${theme.ui.elevated}</string>`,
    '      </dict>',
    '    </dict>',
  ].join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
    '<plist version="1.0">',
    '<dict>',
    `  <key>name</key><string>${generatedTheme()}</string>`,
    '  <key>settings</key>',
    '  <array>',
    globalSettings,
    ...entries.slice(1).map(entryXml),
    '  </array>',
    '</dict>',
    '</plist>',
    '',
  ].join('\n');
}

async function detectCodex(): Promise<boolean> {
  try {
    await fs.access(codexConfigPath());
    return true;
  } catch {
    return false;
  }
}

function sectionRange(lines: string[], section: string): { start: number; end: number } | null {
  const header = new RegExp(`^\\s*\\[${section.replace('.', '\\.')}\\]\\s*$`);
  const start = lines.findIndex(line => header.test(line));
  if (start === -1) return null;
  const next = lines.findIndex((line, index) => index > start && /^\s*\[[^\]]+\]\s*$/.test(line));
  return { start, end: next === -1 ? lines.length : next };
}

function parseTuiTheme(content: string): string | null {
  const lines = content.split('\n');
  const range = sectionRange(lines, 'tui');
  if (!range) return null;
  for (let index = range.start + 1; index < range.end; index += 1) {
    const line = lines[index] ?? '';
    const match = line.match(/^\s*theme\s*=\s*"([^"]*)"\s*$/);
    if (match) return match[1] ?? null;
  }
  return null;
}

function setTuiTheme(content: string, theme: string): string {
  const lines = content.split('\n');
  const range = sectionRange(lines, 'tui');
  const themeLine = `theme = ${JSON.stringify(theme)}`;
  if (!range) {
    const prefix = content.endsWith('\n') || content.length === 0 ? content : `${content}\n`;
    return `${prefix}[tui]\n${themeLine}\n`;
  }
  for (let index = range.start + 1; index < range.end; index += 1) {
    if (/^\s*theme\s*=/.test(lines[index] ?? '')) {
      lines[index] = themeLine;
      return lines.join('\n');
    }
  }
  lines.splice(range.start + 1, 0, themeLine);
  return lines.join('\n');
}

async function currentTheme(): Promise<string | null> {
  const existing = await readIfExists(codexConfigPath());
  return existing === null ? null : parseTuiTheme(existing);
}

async function writeTheme(theme: string): Promise<void> {
  const file = await realPathIfExists(codexConfigPath());
  const existing = await readIfExists(file);
  const next = setTuiTheme(existing ?? '', theme);
  await atomicWrite(file, next.endsWith('\n') ? next : `${next}\n`);
}

async function activateCodex(): Promise<string | undefined> {
  await writeTheme(generatedTheme());
  return 'Restart Codex to apply the theme.';
}

export const codexTarget: AppAdapter<CodexAppConfig> = {
  name: 'codex',
  label: 'Codex',
  defaultConfig: {},
  outputPath: codexThemePath,
  generate: generateCodex,
  detect: detectCodex,
  currentTheme,
  activate: activateCodex,
  deactivate: async config => {
    await writeTheme(config.previousTheme ?? 'one-half-dark');
    return 'Restart Codex to apply the restored theme.';
  },
};
