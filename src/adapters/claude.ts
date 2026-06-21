import fs from 'node:fs/promises';
import { atomicWrite, readIfExists, stableJson } from '../files.js';
import { claudeConfigDir, claudeSettingsPath, claudeThemePath, generatedTheme } from '../paths.js';
import type { AppAdapter, ClaudeAppConfig, ResolvedTheme } from '../types.js';

interface JsonObject { [key: string]: unknown }

function overrides(theme: ResolvedTheme): Record<string, string> {
  return {
    autoAccept: theme.ui.success,
    bashBorder: theme.ui.interrupted,
    bashMessageBackgroundColor: theme.ui.elevated,
    briefLabelClaude: theme.ui.special,
    briefLabelYou: theme.ui.accent,
    claude: theme.ui.accent,
    claudeShimmer: theme.ui.info,
    clawd_body: theme.ui.accent,
    diffAdded: theme.ui.elevated,
    diffAddedDimmed: theme.ui.elevated,
    diffAddedWord: theme.ui.success,
    diffRemoved: theme.ui.elevated,
    diffRemovedDimmed: theme.ui.elevated,
    diffRemovedWord: theme.ui.error,
    error: theme.ui.error,
    fastMode: theme.ui.hint,
    fastModeShimmer: theme.ui.info,
    ide: theme.ui.info,
    inactive: theme.ui.textMuted,
    inactiveShimmer: theme.ui.textSubtle,
    inverseText: theme.ui.text,
    memoryBackgroundColor: theme.ui.elevated,
    merged: theme.ui.special,
    messageActionsBackground: theme.ui.selection,
    permission: theme.ui.special,
    permissionShimmer: theme.ui.accent,
    planMode: theme.ui.info,
    promptBorder: theme.ui.border,
    promptBorderShimmer: theme.ui.textSubtle,
    rate_limit_empty: theme.ui.border,
    rate_limit_fill: theme.ui.accent,
    remember: theme.ui.hint,
    selectionBg: theme.ui.selection,
    subtle: theme.ui.border,
    success: theme.ui.success,
    suggestion: theme.ui.accent,
    text: theme.ui.text,
    userMessageBackground: theme.ui.elevated,
    userMessageBackgroundHover: theme.ui.selection,
    warning: theme.ui.warning,
    warningShimmer: theme.ui.interrupted,
  };
}

export function generateClaude(theme: ResolvedTheme): string {
  return stableJson({
    name: generatedTheme(),
    base: 'dark',
    overrides: overrides(theme),
  });
}

async function detectClaude(): Promise<boolean> {
  try {
    const stat = await fs.stat(claudeConfigDir());
    return stat.isDirectory();
  } catch {
    return false;
  }
}

async function currentTheme(): Promise<string | null> {
  const existing = await readIfExists(claudeSettingsPath());
  if (existing === null) return null;
  const settings = JSON.parse(existing) as JsonObject;
  return typeof settings.theme === 'string' ? settings.theme : null;
}

async function writeTheme(theme: string): Promise<void> {
  const file = claudeSettingsPath();
  const existing = await readIfExists(file);
  const settings = existing === null ? {} : JSON.parse(existing) as JsonObject;
  settings.theme = theme;
  await atomicWrite(file, stableJson(settings));
}

async function activateClaude(): Promise<string | undefined> {
  await writeTheme(`custom:${generatedTheme()}`);
  return undefined;
}

export const claudeTarget: AppAdapter<ClaudeAppConfig> = {
  name: 'claude',
  label: 'Claude',
  defaultConfig: {},
  outputPath: claudeThemePath,
  generate: generateClaude,
  detect: detectClaude,
  currentTheme,
  activate: activateClaude,
  deactivate: async config => {
    await writeTheme(config.previousTheme ?? 'dark');
    return undefined;
  },
};
