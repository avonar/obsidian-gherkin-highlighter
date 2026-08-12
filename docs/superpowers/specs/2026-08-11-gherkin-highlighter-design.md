# Obsidian Gherkin Highlighter — Design

Date: 2026-08-11

## Goal

An Obsidian plugin that syntax-highlights Gherkin (Cucumber) in two places:

1. Fenced code blocks tagged `gherkin` or `feature` inside regular notes.
2. Standalone `.feature` files opened in the vault.

Highlighting must work in Reading mode, Live Preview, and Source mode. Keyword
sets cover English and Russian dialects, selected automatically from a
`# language: xx` directive.

## Architecture

The Gherkin logic lives in a pure, dependency-free tokenizer. Obsidian-specific
layers only turn tokens into DOM or editor decorations. This is the seam that
makes the parsing testable without an Obsidian runtime.

```
src/gherkin/dialects.ts     keyword tables (en, ru) + `# language:` resolution
src/gherkin/tokenizer.ts    line-oriented state machine -> Token[]
src/reading/processor.ts    markdown code block processor -> <span class="gk-*">
src/editor/streamMode.ts    the same tokenizer exposed as a CodeMirror mode
src/view/featureView.ts     TextFileView backed by CodeMirror 6 for .feature
src/settings.ts             settings tab + colour overrides as CSS variables
src/main.ts                 plugin entry, wires the layers together
styles.css                  token classes on var(--gk-*) with theme fallbacks
```

Data flow: text -> `tokenize(lines, dialect)` -> `Token { type, from, to }` ->
either DOM spans (Reading mode) or editor tokens (Live Preview, Source, and the
`.feature` view). One source of truth, three consumers.

## Token types

| Construct | Class | Example |
| --- | --- | --- |
| Feature, Rule, Background, Scenario, Scenario Outline, Examples | `gk-keyword` | `Функция:` |
| Given, When, Then, And, But, `*` | `gk-step` | `Когда я нажимаю` |
| Tags | `gk-tag` | `@smoke` |
| Comments | `gk-comment` | `# note` |
| Doc strings (`"""` or ` ``` `) | `gk-docstring` | multi-line payloads |
| Data tables | `gk-table`, first row `gk-table-header` | `\| a \| b \|` |
| Placeholders | `gk-placeholder` | `<username>` |
| Quoted strings, numbers | `gk-string`, `gk-number` | `"admin"`, `42` |
| Free-form description after Feature | `gk-description` | |

Tokenizer state carries: whether the scanner is inside a doc string (and with
which delimiter), whether the previous line was a table row (to mark the first
row as a header), and the active dialect.

## Obsidian layers

**Reading mode.** `registerMarkdownCodeBlockProcessor` for both `gherkin` and
`feature` renders a `<pre class="gherkin-highlight"><code>` with one span per
token.

**Live Preview / Source.** The tokenizer is registered as a CodeMirror stream
mode under the `gherkin` and `feature` aliases, which is the mechanism Obsidian
uses to highlight fenced block contents in CM6. If that registration point is
unavailable at runtime, the fallback is a CM6 `StreamLanguage` plus a
`ViewPlugin` that decorates the block ranges directly.

**`.feature` files.** `registerExtensions(["feature"])` plus a `TextFileView`
backed by a CodeMirror 6 `EditorView`, so files get real editing, undo, and
save — not a markdown wrapper that would mangle Gherkin punctuation.

**Failure handling.** A tokenizer error on one line degrades that line to plain
text; it never breaks the surrounding render.

## Settings

- Enable/disable editor highlighting.
- Default dialect: auto (from `# language:`), `en`, or `ru`.
- Use theme colours (on by default) or override six token colours.

Overrides are written to `document.body.style` as `--gk-keyword` and friends.
The stylesheet already reads those variables, so no re-render is needed.

## Testing

Vitest unit tests against the tokenizer: English and Russian keywords, the
`# language: ru` directive, doc strings, tables with escaped `\|`, placeholders,
and negative cases (a keyword in the middle of a step is plain text). The
Obsidian layers are verified by hand in a real vault.

## Build

esbuild, following the official sample plugin: `obsidian` and `@codemirror/*`
marked external, output is `main.js` next to `manifest.json` and `styles.css`.
