import { RangeSetBuilder, type Extension } from "@codemirror/state";
import {
	Decoration,
	type DecorationSet,
	EditorView,
	ViewPlugin,
	type ViewUpdate,
} from "@codemirror/view";
import {
	createState,
	tokenizeLine,
	type TokenType,
} from "../gherkin/tokenizer";
import { findFencedRegions, type GherkinRegion } from "./regions";

export interface HighlighterOptions {
	/** Treat the whole document as Gherkin instead of scanning for fences. */
	wholeDocument?: boolean;
	/** Dialect used until a `# language:` directive says otherwise. */
	getLanguage: () => string;
	/** Lets the user switch editor highlighting off without a reload. */
	isEnabled?: () => boolean;
}

const MARKS = new Map<TokenType, Decoration>();

function markFor(type: TokenType): Decoration {
	let mark = MARKS.get(type);
	if (!mark) {
		mark = Decoration.mark({ class: `gk-${type}` });
		MARKS.set(type, mark);
	}
	return mark;
}

/**
 * Colours Gherkin in the editor. Tokens come from the same tokenizer that
 * reading mode uses, so the two never disagree.
 */
export function gherkinHighlighter(options: HighlighterOptions): Extension {
	return ViewPlugin.fromClass(
		class {
			decorations: DecorationSet;

			constructor(view: EditorView) {
				this.decorations = buildDecorations(view, options);
			}

			update(update: ViewUpdate) {
				if (update.docChanged || update.viewportChanged) {
					this.decorations = buildDecorations(update.view, options);
				}
			}
		},
		{ decorations: (value) => value.decorations },
	);
}

function buildDecorations(
	view: EditorView,
	options: HighlighterOptions,
): DecorationSet {
	if (options.isEnabled && !options.isEnabled()) return Decoration.none;

	const doc = view.state.doc;
	const lines: string[] = [];
	for (const line of doc.iterLines()) lines.push(line);

	const regions: GherkinRegion[] = options.wholeDocument
		? [{ fromLine: 1, toLine: doc.lines }]
		: findFencedRegions(lines);
	if (regions.length === 0) return Decoration.none;

	const builder = new RangeSetBuilder<Decoration>();
	const language = options.getLanguage();

	for (const region of regions) {
		// Tokenizing starts at the region head even when only its tail is on
		// screen: doc strings and tables need the state from the lines above.
		const state = createState({ defaultLanguage: language });
		for (
			let number = region.fromLine;
			number <= region.toLine && number <= doc.lines;
			number++
		) {
			const line = doc.line(number);
			const tokens = tokenizeLine(lines[number - 1], state);
			if (!isVisible(view, line.from, line.to)) continue;
			for (const token of tokens) {
				builder.add(
					line.from + token.from,
					line.from + token.to,
					markFor(token.type),
				);
			}
		}
	}

	return builder.finish();
}

function isVisible(view: EditorView, from: number, to: number): boolean {
	for (const range of view.visibleRanges) {
		if (from <= range.to && to >= range.from) return true;
	}
	return false;
}
