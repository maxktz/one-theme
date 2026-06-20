import { atomicWrite, readIfExists, stableJson } from '../files.js';
import { claudeSettingsPath, claudeThemePath } from '../paths.js';
import type { TargetAdapter } from '../targets.js';
import type { JsonObject, ThemeLayer } from '../types.js';

export const defaultClaudeColors: Record<string, string> = {
  claude: '@role.accent',
  claudeShimmer: '@role.info',
  text: '@role.foreground',
  inverseText: '@role.foreground',
  inactive: '@role.muted',
  inactiveShimmer: '@role.mutedStrong',
  subtle: '@role.separator',
  suggestion: '@role.accent',
  permission: '@role.special',
  permissionShimmer: '@role.accent',
  remember: '@role.hint',
  success: '@role.success',
  error: '@role.error',
  warning: '@role.warning',
  warningShimmer: '@role.interrupted',
  merged: '@role.special',
  promptBorder: '@role.separator',
  promptBorderShimmer: '@role.mutedStrong',
  planMode: '@role.info',
  autoAccept: '@role.success',
  bashBorder: '@role.interrupted',
  ide: '@role.info',
  fastMode: '@role.hint',
  fastModeShimmer: '@role.info',
  diffAdded: '@role.elevated',
  diffRemoved: '@role.elevated',
  diffAddedDimmed: '@role.elevated',
  diffRemovedDimmed: '@role.elevated',
  diffAddedWord: '@role.success',
  diffRemovedWord: '@role.error',
  userMessageBackground: '@role.elevated',
  userMessageBackgroundHover: '@role.selection',
  messageActionsBackground: '@role.selection',
  bashMessageBackgroundColor: '@role.elevated',
  clawd_body: '@role.accent',
  memoryBackgroundColor: '@role.elevated',
  selectionBg: '@role.selection',
  rate_limit_fill: '@role.accent',
  rate_limit_empty: '@role.separator',
  briefLabelYou: '@role.accent',
  briefLabelClaude: '@role.special',
};

function color(value: unknown, key: string): string {
  if (typeof value !== 'string') throw new Error(`Claude color ${key} must resolve to a string`);
  if (value.toUpperCase() === 'NONE') throw new Error(`Claude color ${key} cannot be NONE`);
  return value;
}

export function generateClaude(name: string, theme: ThemeLayer): string {
  const target = theme.targets.claude;
  if (!target || !('colors' in target)) throw new Error('Claude target mapping is missing');
  const overrides = Object.fromEntries(
    Object.entries(target.colors).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => [key, color(value, key)]),
  );
  return stableJson({
    name: `ot-${name}`,
    base: 'dark',
    overrides,
  });
}

async function activateClaude(name: string): Promise<string | undefined> {
  const file = claudeSettingsPath();
  const existing = await readIfExists(file);
  const settings = existing === null ? {} : JSON.parse(existing) as JsonObject;
  settings.theme = `custom:ot-${name}`;
  await atomicWrite(file, stableJson(settings));
  return undefined;
}

export const claudeTarget: TargetAdapter = {
  name: 'claude',
  defaultColors: defaultClaudeColors,
  outputPath: claudeThemePath,
  generate: generateClaude,
  activate: activateClaude,
};
