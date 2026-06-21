import { resolveTheme } from './resolve.js';
import type { AppAdapter, AppConfigBase, GeneratedOutput, OneThemeConfig, ThemeDocument } from './types.js';

export function adapterConfig<TConfig extends AppConfigBase>(
  adapter: AppAdapter<TConfig>,
  config: OneThemeConfig,
): TConfig {
  return {
    ...adapter.defaultConfig,
    ...config.apps[adapter.name],
  } as TConfig;
}

export function generatedOutputs(theme: ThemeDocument, config: OneThemeConfig, adapters: AppAdapter[]): GeneratedOutput[] {
  const resolved = resolveTheme(theme);
  return adapters.map(adapter => ({
    target: adapter.name,
    path: adapter.outputPath(),
    content: adapter.generate(resolved, adapterConfig(adapter, config)),
  }));
}
