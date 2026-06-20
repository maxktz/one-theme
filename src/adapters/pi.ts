import { atomicWrite, readIfExists, stableJson } from '../files.js';
import { piSettingsPath, piThemePath } from '../paths.js';
import type { TargetAdapter } from '../targets.js';
import type { JsonObject, ThemeLayer } from '../types.js';

const schema = 'https://raw.githubusercontent.com/earendil-works/pi/main/packages/coding-agent/src/modes/interactive/theme/theme-schema.json';

const requiredPiColors = [
  'accent', 'border', 'borderAccent', 'borderMuted', 'success', 'error', 'warning', 'muted', 'dim',
  'text', 'thinkingText', 'selectedBg', 'userMessageBg', 'userMessageText', 'customMessageBg',
  'customMessageText', 'customMessageLabel', 'toolPendingBg', 'toolSuccessBg', 'toolErrorBg',
  'toolTitle', 'toolOutput', 'mdHeading', 'mdLink', 'mdLinkUrl', 'mdCode', 'mdCodeBlock',
  'mdCodeBlockBorder', 'mdQuote', 'mdQuoteBorder', 'mdHr', 'mdListBullet', 'toolDiffAdded',
  'toolDiffRemoved', 'toolDiffContext', 'syntaxComment', 'syntaxKeyword', 'syntaxFunction',
  'syntaxVariable', 'syntaxString', 'syntaxNumber', 'syntaxType', 'syntaxOperator',
  'syntaxPunctuation', 'thinkingOff', 'thinkingMinimal', 'thinkingLow', 'thinkingMedium',
  'thinkingHigh', 'thinkingXhigh', 'bashMode',
] as const;

export const defaultPiColors = {
  accent: '@role.accent',
  border: '@role.info',
  borderAccent: '@role.hint',
  borderMuted: '@role.separator',
  success: '@role.success',
  error: '@role.error',
  warning: '@role.warning',
  muted: '@role.muted',
  dim: '@role.mutedStrong',
  text: '@role.foreground',
  thinkingText: '@role.secondary',

  selectedBg: '@role.selection',
  userMessageBg: '@role.elevated',
  userMessageText: '@role.foreground',
  customMessageBg: '@role.elevated',
  customMessageText: '@role.foreground',
  customMessageLabel: '@role.special',
  toolPendingBg: '@role.elevated',
  toolSuccessBg: '@role.elevated',
  toolErrorBg: '@role.elevated',
  toolTitle: '@role.accent',
  toolOutput: '@role.muted',

  mdHeading: '@role.interrupted',
  mdLink: '@role.info',
  mdLinkUrl: '@role.mutedStrong',
  mdCode: '@role.hint',
  mdCodeBlock: '@role.success',
  mdCodeBlockBorder: '@role.separator',
  mdQuote: '@role.muted',
  mdQuoteBorder: '@role.separator',
  mdHr: '@role.separator',
  mdListBullet: '@role.accent',

  toolDiffAdded: '@role.success',
  toolDiffRemoved: '@role.error',
  toolDiffContext: '@role.muted',

  syntaxComment: '@role.muted',
  syntaxKeyword: '@role.special',
  syntaxFunction: '@role.info',
  syntaxVariable: '@role.foreground',
  syntaxString: '@role.success',
  syntaxNumber: '@role.interrupted',
  syntaxType: '@role.accent',
  syntaxOperator: '@role.secondary',
  syntaxPunctuation: '@role.secondary',

  thinkingOff: '@role.mutedStrong',
  thinkingMinimal: '@role.muted',
  thinkingLow: '@role.info',
  thinkingMedium: '@role.hint',
  thinkingHigh: '@role.special',
  thinkingXhigh: '@role.error',

  bashMode: '@role.success',
} satisfies Record<(typeof requiredPiColors)[number], string>;

function piColor(value: unknown, key: string): string | number {
  if (typeof value === 'string') return value.toUpperCase() === 'NONE' ? '' : value;
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 255) return value;
  throw new Error(`Pi color ${key} must resolve to a string or 256-color number`);
}

export function generatePi(name: string, theme: ThemeLayer): string {
  const target = theme.targets.pi;
  if (!target || !('colors' in target)) throw new Error('Pi target mapping is missing');
  const colors = Object.fromEntries(
    requiredPiColors.map(key => [key, piColor(target.colors[key], key)]),
  );
  return stableJson({
    $schema: schema,
    name: `ot-${name}`,
    colors,
  });
}

async function activatePi(name: string): Promise<string | undefined> {
  const file = piSettingsPath();
  const existing = await readIfExists(file);
  const settings = existing === null ? {} : JSON.parse(existing) as JsonObject;
  settings.theme = `ot-${name}`;
  await atomicWrite(file, stableJson(settings));
  return 'Pi may need /theme reload or a restart to pick up the generated theme.';
}

export const piTarget: TargetAdapter = {
  name: 'pi',
  defaultColors: defaultPiColors,
  outputPath: piThemePath,
  generate: generatePi,
  activate: activatePi,
};
