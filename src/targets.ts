import { resolveTheme } from './resolve.js';
import type { ThemeDocument, ThemeLayer } from './types.js';

export interface GeneratedOutput {
  target: string;
  path: string;
  content: string;
}

export interface TargetAdapter {
  name: string;
  defaultColors?: Record<string, string>;
  outputPath(name: string): string;
  generate(name: string, theme: ThemeLayer): string;
  activate?(name: string): Promise<string | undefined>;
  activationHint?(name: string): string | undefined;
}

export function applyTargetDefaults(document: ThemeDocument, adapters: TargetAdapter[]): ThemeDocument {
  const baseTargets = { ...document.base.targets };
  const overrideTargets = { ...document.overrides.targets };

  for (const adapter of adapters) {
    if (adapter.defaultColors && !(adapter.name in baseTargets)) {
      baseTargets[adapter.name] = { colors: adapter.defaultColors };
    }
    if (adapter.defaultColors && !(adapter.name in overrideTargets)) {
      overrideTargets[adapter.name] = { colors: {} };
    }
  }

  return {
    ...document,
    base: { ...document.base, targets: baseTargets },
    overrides: { ...document.overrides, targets: overrideTargets },
  };
}

export function generatedOutputs(name: string, document: ThemeDocument, adapters: TargetAdapter[]): GeneratedOutput[] {
  const upgraded = applyTargetDefaults(document, adapters);
  const resolved = resolveTheme(upgraded);
  return adapters.map(adapter => ({
    target: adapter.name,
    path: adapter.outputPath(name),
    content: adapter.generate(name, resolved),
  }));
}
