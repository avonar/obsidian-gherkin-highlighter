// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { gherkinHighlighter } from "../src/editor/highlighter";

let view: EditorView | null = null;

afterEach(() => {
	view?.destroy();
	view = null;
});

/** Mounts an editor and returns the decorated [class, text] pairs. */
function decorate(
	doc: string,
	options: Parameters<typeof gherkinHighlighter>[0],
): Array<[string, string]> {
	view = new EditorView({
		state: EditorState.create({
			doc,
			extensions: [gherkinHighlighter(options)],
		}),
		parent: document.body,
	});
	return Array.from(view.dom.querySelectorAll("[class*='gk-']")).map((el) => [
		el.className,
		el.textContent ?? "",
	]);
}

const ENGLISH = { getLanguage: () => "en" };

describe("gherkinHighlighter in a markdown document", () => {
	it("decorates the contents of a gherkin block", () => {
		const marks = decorate(
			"# Note\n\n```gherkin\nFeature: Login\n  Given a user\n```\n",
			ENGLISH,
		);
		expect(marks).toContainEqual(["gk-keyword", "Feature:"]);
		expect(marks).toContainEqual(["gk-name", "Login"]);
		expect(marks).toContainEqual(["gk-step", "Given"]);
	});

	it("leaves text outside the block alone", () => {
		const marks = decorate(
			"Feature: not in a block\n\n```gherkin\nFeature: in a block\n```",
			ENGLISH,
		);
		expect(marks.filter(([cls]) => cls === "gk-keyword")).toHaveLength(1);
		expect(marks).toContainEqual(["gk-name", "in a block"]);
	});

	it("ignores blocks of other languages", () => {
		expect(decorate("```js\nFeature: x\n```", ENGLISH)).toEqual([]);
	});

	it("carries doc string state across lines", () => {
		const marks = decorate(
			'```gherkin\nGiven a payload\n"""\nGiven not a step\n"""\n```',
			ENGLISH,
		);
		expect(marks).toContainEqual(["gk-docstring", "Given not a step"]);
		expect(marks.filter(([cls]) => cls === "gk-step")).toHaveLength(1);
	});

	it("produces nothing when highlighting is switched off", () => {
		expect(
			decorate("```gherkin\nFeature: x\n```", {
				...ENGLISH,
				isEnabled: () => false,
			}),
		).toEqual([]);
	});

	it("honours the configured language", () => {
		const marks = decorate("```gherkin\nФункция: Вход\n```", {
			getLanguage: () => "ru",
		});
		expect(marks).toContainEqual(["gk-keyword", "Функция:"]);
	});

	it("follows a language directive inside the block", () => {
		const marks = decorate(
			"```gherkin\n# language: ru\nСценарий: Вход\n```",
			ENGLISH,
		);
		expect(marks).toContainEqual(["gk-keyword", "Сценарий:"]);
	});
});

describe("gherkinHighlighter over a whole document", () => {
	it("decorates every line without needing a fence", () => {
		const marks = decorate("Feature: Login\n  Given a user\n", {
			...ENGLISH,
			wholeDocument: true,
		});
		expect(marks).toContainEqual(["gk-keyword", "Feature:"]);
		expect(marks).toContainEqual(["gk-step", "Given"]);
	});

	it("handles an empty document", () => {
		expect(decorate("", { ...ENGLISH, wholeDocument: true })).toEqual([]);
	});
});

describe("decorations after edits", () => {
	it("re-highlights when the document changes", () => {
		view = new EditorView({
			state: EditorState.create({
				doc: "```gherkin\n\n```",
				extensions: [gherkinHighlighter(ENGLISH)],
			}),
			parent: document.body,
		});
		expect(view.dom.querySelectorAll("[class*='gk-']")).toHaveLength(0);

		view.dispatch({ changes: { from: 11, insert: "Feature: x" } });
		const marks = Array.from(
			view.dom.querySelectorAll("[class*='gk-']"),
		).map((el) => el.textContent);
		expect(marks).toContain("Feature:");
	});
});
