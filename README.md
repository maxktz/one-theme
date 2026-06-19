# one-theme

Personal theme compiler for Neovim and Herdr. It imports a Neovim colorscheme into one canonical
JSON file, preserves personal overrides, and generates standalone target themes.

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
