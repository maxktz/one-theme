import assert from 'node:assert/strict';
import test from 'node:test';
import { generateHerdr } from '../src/adapters/herdr.js';
import { generateNeovim } from '../src/adapters/neovim.js';
import type { ThemeLayer } from '../src/types.js';

const herdrColors = {
  accent: '#111111', panel_bg: 'NONE', surface0: '#222222', active_space_bg: '#333333',
  surface1: '#444444', surface_dim: '#555555', separator: '#666666', overlay0: '#777777',
  overlay1: '#888888', text: '#999999', subtext0: '#aaaaaa', mauve: '#bbbbbb',
  green: '#00ff00', yellow: '#ffff00', red: '#ff0000', blue: '#0000ff',
  teal: '#00ffff', peach: '#ffaa00',
};

const theme: ThemeLayer = {
  palette: {},
  roles: {},
  targets: {
    neovim: {
      highlights: { Normal: { fg: '#999999' }, CursorLine: {} },
      terminalColors: { '0': '#000000' },
    },
    herdr: { colors: herdrColors },
  },
};

test('Neovim generator emits a standalone colorscheme', () => {
  const output = generateNeovim('test', theme);
  assert.match(output, /vim\.g\.colors_name = "ot-test"/);
  assert.match(output, /nvim_set_hl\(0, "Normal"/);
  assert.match(output, /vim\.g\.terminal_color_0 = "#000000"/);
});

test('Herdr generator emits a complete external theme and maps NONE to reset', () => {
  const output = generateHerdr('test', theme);
  assert.match(output, /name = "ot-test"/);
  assert.match(output, /panel_bg = "reset"/);
  assert.match(output, /separator = "#666666"/);
});
