import assert from 'node:assert/strict';
import test from 'node:test';
import { deriveGenericPalette } from '../src/adapters/neovim-import.js';

test('generic Neovim palette derives semantic source colors from standard groups', () => {
  const palette = deriveGenericPalette({
    Normal: { fg: 0xc0caf5, bg: 0x1a1b26 },
    CursorLine: { bg: 0x292e42 },
    Visual: { bg: 0x283457 },
    LineNr: { fg: 0x3b4261 },
    Comment: { fg: 0x565f89 },
    Function: { fg: 0x7aa2f7 },
    String: { fg: 0x9ece6a },
    DiagnosticWarn: { fg: 0xe0af68 },
    DiagnosticError: { fg: 0xdb4b4b },
    DiagnosticInfo: { fg: 0x0db9d7 },
    DiagnosticHint: { fg: 0x1abc9c },
    Constant: { fg: 0xff9e64 },
    Statement: { fg: 0xbb9af7 },
  });

  assert.equal(palette.fg, '#c0caf5');
  assert.equal(palette.bg_highlight, '#292e42');
  assert.equal(palette.fg_gutter, '#3b4261');
  assert.equal(palette.error, '#db4b4b');
});
