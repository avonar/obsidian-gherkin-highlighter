# Gherkin Highlighter for Obsidian

Syntax highlighting for Gherkin (Cucumber) inside Obsidian — in fenced code
blocks and in standalone `.feature` files, in reading mode, Live Preview and
source mode alike.

## Features

- **Code blocks.** Anything tagged ` ```gherkin `, ` ```feature ` or
  ` ```cucumber ` is highlighted.
- **`.feature` files.** They open in a dedicated Gherkin editor with line
  numbers, undo and search, and save like any other file.
- **English and Russian dialects.** A `# language: ru` directive switches the
  keyword set for that block; the fallback dialect is a setting.
- **Notion-like colours.** The default palette mirrors Notion's code blocks:
  teal keywords, orange titles, blue steps, green strings, warm grey
  background. Every colour can be
  changed in the settings tab, or you can switch to the active theme's palette.
- **Full Gherkin syntax:** feature and scenario keywords, steps, tags,
  comments, doc strings, data tables, placeholders, strings and numbers.

````markdown
```gherkin
@checkout
Feature: Shopping cart

  Scenario Outline: Adding items
    Given a cart with <count> items
    When I add "<product>"
    Then the cart shows <total> items

    Examples:
      | count | product | total |
      | 0     | apple   | 1     |
      | 3     | pear    | 4     |
```
````

Russian works the same way:

````markdown
```gherkin
# language: ru
Функция: Корзина

  Сценарий: Добавление товара
    Дано пустая корзина
    Когда я добавляю "яблоко"
    Тогда в корзине 1 товар
```
````

## Install

### From this repository

```bash
npm install && npm run build
```

Then copy `main.js`, `manifest.json` and `styles.css` into
`<vault>/.obsidian/plugins/gherkin-highlighter/`, or let the helper script do
it:

```bash
npm run install-plugin -- "/path/to/your/vault"
```

Enable **Gherkin Highlighter** under Settings → Community plugins.

## Settings

| Setting | What it does |
| --- | --- |
| Highlight while editing | Colours Gherkin in Live Preview and source mode. Reading mode is always highlighted. |
| Default language | Keyword set used when a block has no `# language:` directive. |
| Open .feature files | Registers the `.feature` extension with the plugin's editor. |
| Use theme colours | Off by default (Notion-like palette). On: follow the active theme's palette instead. |

Themes and CSS snippets can restyle any token directly — every token carries a
`gk-*` class (`gk-keyword`, `gk-step`, `gk-tag`, `gk-comment`, `gk-string`,
`gk-placeholder`, `gk-table-header`, and so on).

## Commands

- **Insert Gherkin scenario block** — drops a starter block at the cursor, in
  the configured dialect.

## Development

```bash
npm run dev     # watch build
npm test        # unit and integration tests
npm run build   # typecheck plus production bundle
```

The Gherkin logic lives in `src/gherkin/`, has no Obsidian imports, and is
covered by tests. The Obsidian layers (`src/reading/`, `src/editor/`,
`src/view/`) only turn its tokens into DOM or editor decorations, so
highlighting cannot drift between modes. The design notes are in
[docs/superpowers/specs](docs/superpowers/specs).

## License

MIT
