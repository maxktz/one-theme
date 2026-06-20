# one-theme

Personal theme compiler for Neovim, Herdr, Claude Code, Pi Agent, and partial Codex theming. It
imports a Neovim colorscheme into one canonical JSON file, preserves personal overrides, and
generates standalone target themes.

## Setup

```sh
pnpm install
pnpm build
pnpm link --global
```

## Usage

```sh
one-theme import neovim tokyonight-night --name tokyonight
one-theme apply tokyonight
one-theme diff tokyonight
one-theme check tokyonight
```

Themes live in `~/.config/one-theme/themes/`. Re-import without losing overrides:

```sh
one-theme import neovim tokyonight-night --name tokyonight --refresh
```

Neovim activation is manual:

```vim
:colorscheme ot-tokyonight
```

Claude Code activation is automatic and writes `~/.claude/themes/ot-<name>.json`.

Codex activation is automatic and writes `~/.codex/themes/ot-<name>.tmTheme`. Codex custom themes
currently cover syntax highlighting, diffs, and some scope-derived UI colors; they do not cover every
TUI surface.

Pi Agent activation is automatic and writes `~/.pi/agent/themes/ot-<name>.json`, then sets
`theme` in `~/.pi/agent/settings.json`. Pi may need `/theme reload` or a restart to pick it up.

## Targets

Targets are small adapter files under `src/adapters/`. Color-mapped apps keep their semantic token
mapping in `targets.<app>.colors` inside the canonical theme JSON, so per-app overrides stay local
to the theme file.
