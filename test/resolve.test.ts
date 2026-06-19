import assert from 'node:assert/strict';
import test from 'node:test';
import { merge, resolveTheme } from '../src/resolve.js';
import type { ThemeDocument } from '../src/types.js';

test('merge deletes keys set to null in overrides', () => {
  assert.deepEqual(
    merge({ fg: '#ffffff', bg: '#000000' }, { bg: null }),
    { fg: '#ffffff' },
  );
});

test('resolveTheme resolves semantic role and palette references', () => {
  const document: ThemeDocument = {
    schemaVersion: 1,
    name: 'test',
    source: {
      type: 'neovim',
      colorscheme: 'test',
      runtimePath: '/tmp/test',
      revision: null,
      importedAt: '2026-01-01T00:00:00.000Z',
    },
    base: {
      palette: { blue: '#112233', bg: '#000000' },
      roles: { accent: 'blue', background: 'bg' },
      targets: {
        neovim: {
          highlights: {
            Normal: { fg: '@role.accent' },
            '@lsp.type.keyword': { link: '@keyword' },
          },
          terminalColors: {},
        },
        herdr: { colors: { accent: '@palette.blue' } },
      },
    },
    overrides: {
      palette: {},
      roles: {},
      targets: { neovim: { highlights: {} }, herdr: { colors: {} } },
    },
  };

  const resolved = resolveTheme(document);
  assert.equal(resolved.targets.neovim.highlights.Normal?.fg, '#112233');
  assert.equal(resolved.targets.neovim.highlights['@lsp.type.keyword']?.link, '@keyword');
  assert.equal(resolved.targets.herdr.colors.accent, '#112233');
});
