import { createState, tokenizeLine } from "../gherkin/tokenizer";

/**
 * Renders Gherkin source into a highlighted `<pre>`. Used by the markdown code
 * block processor, which drives both reading mode and the Live Preview widget.
 */
export function renderGherkin(
	source: string,
	container: HTMLElement,
	defaultLanguage: string,
): void {
	const pre = container.createEl("pre", { cls: "gherkin-highlight" });
	const code = pre.createEl("code", { cls: "gherkin-highlight-code" });

	const state = createState({ defaultLanguage });
	const lines = source.replace(/\n$/, "").split("\n");

	lines.forEach((line, index) => {
		const tokens = tokenizeLine(line, state);
		let position = 0;
		for (const token of tokens) {
			if (token.from > position) {
				code.appendText(line.slice(position, token.from));
			}
			code.createSpan({
				cls: `gk-${token.type}`,
				text: line.slice(token.from, token.to),
			});
			position = token.to;
		}
		if (position < line.length) code.appendText(line.slice(position));
		if (index < lines.length - 1) code.appendText("\n");
	});
}
