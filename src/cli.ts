#!/usr/bin/env node
import * as p from '@clack/prompts';
import process from 'node:process';
import { claudeTarget } from './adapters/claude.js';
import { ghosttyTarget } from './adapters/ghostty.js';
import { herdrTarget } from './adapters/herdr.js';
import { neovimTarget } from './adapters/neovim.js';
import { atomicWrite } from './files.js';
import { generatedTheme, normalizeName } from './paths.js';
import { loadPrivateAdapters } from './private-adapters.js';
import { resolveTheme } from './resolve.js';
import { adapterConfig, generatedOutputs } from './targets.js';
import { defaultConfig, listThemes, loadConfig, loadTheme, saveConfig } from './theme-store.js';
import type { AppAdapter, AppName, OneThemeConfig } from './types.js';

interface AppState {
  adapter: AppAdapter;
  currentTheme: string | null;
  active: boolean;
}

const builtinAdapters: AppAdapter[] = [
  neovimTarget,
  herdrTarget,
  ghosttyTarget,
  claudeTarget,
];

function help(): void {
  console.log(`one-theme

Run without arguments to open the theme wizard.

Flags:
  --help, -h   Show this help`);
}

function isOneTheme(theme: string | null): boolean {
  return theme === generatedTheme() || theme === `custom:${generatedTheme()}`;
}

function cancel(): never {
  p.cancel('Cancelled.');
  process.exit(0);
}

function unwrap<T>(value: T | symbol): T {
  if (p.isCancel(value)) cancel();
  return value;
}

function completeConfig(config: OneThemeConfig): OneThemeConfig {
  const defaultApps = Object.fromEntries(
    Object.entries(defaultConfig.apps).map(([name, appConfig]) => [name, { ...appConfig, ...config.apps[name] }]),
  );
  for (const [name, appConfig] of Object.entries(config.apps)) {
    if (!(name in defaultApps)) defaultApps[name] = appConfig;
  }
  return {
    ...defaultConfig,
    ...config,
    apps: defaultApps as OneThemeConfig['apps'],
  };
}

async function detectedApps(appAdapters: AppAdapter[]): Promise<AppState[]> {
  const states: AppState[] = [];
  for (const adapter of appAdapters) {
    if (!(await adapter.detect())) continue;
    const currentTheme = await adapter.currentTheme();
    states.push({ adapter, currentTheme, active: isOneTheme(currentTheme) });
  }
  return states;
}

function updatePreviousThemes(config: OneThemeConfig, states: AppState[], selectedApps: Set<AppName>): OneThemeConfig {
  const next = completeConfig(config);
  for (const state of states) {
    if (!selectedApps.has(state.adapter.name) || state.active || !state.currentTheme) continue;
    const appConfig = next.apps[state.adapter.name] ?? {};
    appConfig.previousTheme = state.currentTheme;
    next.apps[state.adapter.name] = appConfig;
  }
  return next;
}

function appSupportsTransparency(adapter: AppAdapter): boolean {
  return 'transparency' in adapter.defaultConfig;
}

async function applyTheme(config: OneThemeConfig, states: AppState[], selectedApps: Set<AppName>): Promise<string[]> {
  const warnings: string[] = [];
  const themeDocument = await loadTheme(config.activeTheme);
  const outputs = generatedOutputs(themeDocument, config, states.map(state => state.adapter));
  for (const output of outputs) {
    await atomicWrite(output.path, output.content);
  }
  const resolvedTheme = resolveTheme(themeDocument);

  for (const state of states) {
    const adapter = state.adapter;
    const configForApp = adapterConfig(adapter, config);
    let warning: string | undefined;
    if (selectedApps.has(adapter.name)) {
      warning = await adapter.activate(configForApp, resolvedTheme);
    } else if (state.active) {
      warning = await adapter.deactivate(configForApp);
    }
    if (warning) warnings.push(warning);
  }
  await saveConfig(config);
  return warnings;
}

async function wizard(): Promise<void> {
  const appAdapters = [...builtinAdapters, ...await loadPrivateAdapters()];
  const config = completeConfig(await loadConfig());
  const themes = await listThemes();
  if (themes.length === 0) throw new Error('no themes found in ~/.config/one-theme/themes');

  const states = await detectedApps(appAdapters);
  if (states.length === 0) throw new Error('no supported app configs detected');

  p.intro('one-theme');
  p.note(`Current theme: ${config.activeTheme}`);

  const selectedAppValues = unwrap(await p.multiselect<AppName>({
    message: 'Use one-theme in apps',
    options: states.map(state => ({
      value: state.adapter.name,
      label: state.adapter.label,
      hint: state.currentTheme ? `current: ${state.currentTheme}` : 'current: unset',
    })),
    initialValues: states.filter(state => state.active).map(state => state.adapter.name),
    required: false,
  }));

  const selectedTheme = normalizeName(unwrap(await p.select<string>({
    message: 'Theme',
    options: themes.map(theme => ({ value: theme, label: theme })),
    initialValue: themes.includes(config.activeTheme) ? config.activeTheme : themes[0]!,
  })));

  const selectedApps = new Set(selectedAppValues);
  const transparencyApps = states
    .filter(state =>
      selectedApps.has(state.adapter.name)
      && appSupportsTransparency(state.adapter)
    )
    .map(state => state.adapter.name);
  const transparentValues = transparencyApps.length === 0 ? [] : unwrap(await p.multiselect<AppName>({
    message: 'Transparent background',
    options: transparencyApps.map(name => ({
      value: name,
      label: appAdapters.find(adapter => adapter.name === name)?.label ?? name,
    })),
    initialValues: transparencyApps.filter(name => config.apps[name]?.transparency),
    required: false,
  }));

  const transparentApps = new Set(transparentValues);
  const nextConfig = updatePreviousThemes({
    ...config,
    activeTheme: selectedTheme,
    apps: {
      ...config.apps,
      neovim: { ...config.apps.neovim, transparency: selectedApps.has('neovim') ? transparentApps.has('neovim') : config.apps.neovim.transparency },
      herdr: { ...config.apps.herdr, transparency: selectedApps.has('herdr') ? transparentApps.has('herdr') : config.apps.herdr.transparency },
      ...Object.fromEntries(transparencyApps
        .filter(name => name !== 'neovim' && name !== 'herdr')
        .map(name => [name, { ...config.apps[name], transparency: transparentApps.has(name) }])),
    },
  }, states, selectedApps);

  const spinner = p.spinner();
  spinner.start('Applying theme');
  try {
    const warnings = await applyTheme(nextConfig, states, selectedApps);
    spinner.stop('Applied one-theme');
    for (const warning of warnings) p.log.warn(warning);
    p.outro('Done.');
  } catch (error) {
    spinner.error('Failed.');
    throw error;
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    help();
    return;
  }
  if (args.length > 0) {
    throw new Error('one-theme is wizard-only right now; run `one-theme` without subcommands');
  }
  await wizard();
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
