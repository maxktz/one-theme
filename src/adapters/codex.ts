import { atomicWrite, readIfExists, realPathIfExists } from '../files.js';
import { codexConfigPath, codexThemePath } from '../paths.js';
import type { TargetAdapter } from '../targets.js';
import type { ThemeLayer } from '../types.js';

export const defaultCodexColors: Record<string, string> = {
  foreground: '@role.foreground',
  background: '@palette.bg',
  comment: '@role.muted',
  string: '@role.success',
  keyword: '@role.special',
  function: '@role.info',
  variable: '@role.foreground',
  type: '@role.accent',
  constant: '@role.interrupted',
  operator: '@role.secondary',
  heading: '@role.accent',
  link: '@role.info',
  inserted: '@role.success',
  deleted: '@role.error',
  insertedBackground: '@role.elevated',
  deletedBackground: '@role.elevated',
};

interface ScopeRule {
  name: string;
  scope?: string;
  foreground?: string;
  background?: string;
  fontStyle?: string;
}

function color(value: unknown, key: string): string {
  if (typeof value !== 'string') throw new Error(`Codex color ${key} must resolve to a string`);
  if (value.toUpperCase() === 'NONE') throw new Error(`Codex color ${key} cannot be NONE`);
  return value;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function setting(key: string, value: string): string {
  return `<key>${key}</key><string>${escapeXml(value)}</string>`;
}

function ruleXml(rule: ScopeRule): string {
  const settings = [
    rule.foreground ? setting('foreground', rule.foreground) : undefined,
    rule.background ? setting('background', rule.background) : undefined,
    rule.fontStyle ? setting('fontStyle', rule.fontStyle) : undefined,
  ].filter(Boolean).join('\n');
  return `<dict>
<key>name</key><string>${escapeXml(rule.name)}</string>
${rule.scope ? `<key>scope</key><string>${escapeXml(rule.scope)}</string>` : ''}
<key>settings</key><dict>
${settings}
</dict>
</dict>`;
}

export function generateCodex(name: string, theme: ThemeLayer): string {
  const target = theme.targets.codex;
  if (!target || !('colors' in target)) throw new Error('Codex target mapping is missing');
  const colors = target.colors;
  const c = (key: string) => color(colors[key], key);
  const rules: ScopeRule[] = [
    { name: 'Global', foreground: c('foreground'), background: c('background') },
    { name: 'Comments', scope: 'comment', foreground: c('comment'), fontStyle: 'italic' },
    { name: 'Strings', scope: 'string, markup.underline.link', foreground: c('string') },
    { name: 'Keywords', scope: 'keyword, keyword.control, storage, storage.type, storage.modifier', foreground: c('keyword') },
    { name: 'Functions', scope: 'entity.name.function, entity.name.tag, support.function', foreground: c('function') },
    { name: 'Variables', scope: 'variable', foreground: c('variable') },
    { name: 'Types', scope: 'entity.name.type, support.type', foreground: c('type') },
    { name: 'Constants', scope: 'constant, constant.numeric, constant.language, constant.other', foreground: c('constant') },
    { name: 'Operators', scope: 'keyword.operator', foreground: c('operator') },
    { name: 'Headings', scope: 'markup.heading, entity.name.section', foreground: c('heading') },
    { name: 'Links', scope: 'markup.underline.link', foreground: c('link') },
    { name: 'Inserted', scope: 'markup.inserted, diff.inserted', foreground: c('inserted'), background: c('insertedBackground') },
    { name: 'Deleted', scope: 'markup.deleted, diff.deleted', foreground: c('deleted'), background: c('deletedBackground') },
    { name: 'Invalid', scope: 'invalid, invalid.illegal', foreground: c('deleted') },
  ];

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
<key>name</key><string>ot-${escapeXml(name)}</string>
<key>settings</key>
<array>
${rules.map(ruleXml).join('\n')}
</array>
</dict>
</plist>
`;
}

function setTomlStringInSection(content: string, section: string, key: string, value: string): string {
  const line = `${key} = ${JSON.stringify(value)}`;
  const lines = content.split('\n');
  const sectionHeader = `[${section}]`;
  let sectionStart = lines.findIndex(item => item.trim() === sectionHeader);
  if (sectionStart === -1) {
    const prefix = content.endsWith('\n') || content.length === 0 ? content : `${content}\n`;
    return `${prefix}\n${sectionHeader}\n${line}\n`;
  }

  let sectionEnd = lines.length;
  for (let index = sectionStart + 1; index < lines.length; index += 1) {
    if (/^\s*\[.*]\s*$/.test(lines[index]!)) {
      sectionEnd = index;
      break;
    }
  }

  const keyPattern = new RegExp(`^\\s*${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*=`);
  for (let index = sectionStart + 1; index < sectionEnd; index += 1) {
    if (keyPattern.test(lines[index]!)) {
      lines[index] = line;
      return lines.join('\n');
    }
  }

  sectionStart += 1;
  lines.splice(sectionStart, 0, line);
  return lines.join('\n');
}

async function activateCodex(name: string): Promise<string | undefined> {
  const file = await realPathIfExists(codexConfigPath());
  const existing = await readIfExists(file);
  const next = setTomlStringInSection(existing ?? '', 'tui', 'theme', `ot-${name}`);
  await atomicWrite(file, next.endsWith('\n') ? next : `${next}\n`);
  return 'Codex may need a new session, /theme reload, or restart to pick up the theme.';
}

export const codexTarget: TargetAdapter = {
  name: 'codex',
  defaultColors: defaultCodexColors,
  outputPath: codexThemePath,
  generate: generateCodex,
  activate: activateCodex,
};
