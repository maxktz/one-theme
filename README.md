# one-theme

Personal theme compiler for Neovim, Herdr, Ghostty, Claude Code, and Codex.

`one-theme` owns a small semantic theme format and writes one stable installed theme named
`one-theme` into each app. Changing theme later rewrites that installed theme instead of adding
more app-specific theme names.

## Setup

```sh
pnpm install
pnpm build
pnpm link --global
```

## Usage

```sh
one-theme
```

The wizard:

1. Shows the current one-theme theme.
2. Lets you choose which detected apps should use `one-theme`.
3. Lets you choose the unified theme.
4. Lets you choose transparent background for Neovim and Herdr.
5. Installs generated theme files and activates/restores app themes in one apply step.

No files are written until all prompts are complete.
App checkboxes are read from each app's current theme config; one-theme stores only the active
unified theme, transparency preferences, and previous app themes for restore.

Themes live in:

```text
~/.config/one-theme/themes/
```

Local one-theme preferences live in:

```text
~/.config/one-theme/config.json
```

Generated app themes are stable:

```text
~/.config/nvim/colors/one-theme.lua
~/.config/ghostty/themes/one-theme
~/.claude/themes/one-theme.json
~/.codex/themes/one-theme.tmTheme
```

## Theme Format

Theme JSON is semantic and app-agnostic:

```json
{
  "$schema": "https://raw.githubusercontent.com/maxktz/one-theme/main/schemas/one-theme.schema.json",
  "name": "tokyonight",
  "appearance": "dark",
  "colors": {},
  "ui": {},
  "syntax": {},
  "terminal": {}
}
```

Adapters own app mappings. Theme files do not contain target-specific output mappings.
