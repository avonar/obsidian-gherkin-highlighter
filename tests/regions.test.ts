import { describe, expect, it } from "vitest";
import { findFencedRegions } from "../src/editor/regions";

/** Regions are given as 1-based, inclusive line numbers. */
function regions(text: string) {
	return findFencedRegions(text.split("\n")).map((region) => [
		region.fromLine,
		region.toLine,
	]);
}

describe("findFencedRegions", () => {
	it("finds a gherkin block", () => {
		expect(regions("intro\n```gherkin\nFeature: x\n```\nouttro")).toEqual([
			[3, 3],
		]);
	});

	it("accepts the feature and cucumber aliases", () => {
		expect(regions("```feature\na\n```\n\n```cucumber\nb\n```")).toEqual([
			[2, 2],
			[6, 6],
		]);
	});

	it("is case insensitive about the language", () => {
		expect(regions("```Gherkin\na\n```")).toEqual([[2, 2]]);
	});

	it("ignores blocks in other languages", () => {
		expect(regions("```js\nconst a = 1\n```")).toEqual([]);
	});

	it("does not look inside a non-gherkin block", () => {
		expect(
			regions("```md\n```gherkin\nnot real\n```\n```\nFeature: x"),
		).toEqual([]);
	});

	it("supports tilde fences", () => {
		expect(regions("~~~gherkin\nFeature: x\n~~~")).toEqual([[2, 2]]);
	});

	it("does not close a backtick fence with a tilde fence", () => {
		expect(regions("```gherkin\nFeature: x\n~~~\nGiven y\n```")).toEqual([
			[2, 4],
		]);
	});

	it("allows a longer closing fence", () => {
		expect(regions("```gherkin\na\n`````")).toEqual([[2, 2]]);
	});

	it("does not close on a shorter fence", () => {
		expect(regions("````gherkin\na\n```\nb\n````")).toEqual([[2, 4]]);
	});

	it("tolerates up to three spaces of indentation", () => {
		expect(regions("   ```gherkin\n   Feature: x\n   ```")).toEqual([
			[2, 2],
		]);
	});

	it("runs an unclosed block to the end of the document", () => {
		expect(regions("```gherkin\nFeature: x\nGiven y")).toEqual([[2, 3]]);
	});

	it("skips an empty block", () => {
		expect(regions("```gherkin\n```")).toEqual([]);
	});

	it("ignores an info string that only starts with gherkin", () => {
		expect(regions("```gherkinish\na\n```")).toEqual([]);
	});

	it("finds several blocks in one document", () => {
		expect(
			regions("```gherkin\na\n```\ntext\n```gherkin\nb\nc\n```"),
		).toEqual([
			[2, 2],
			[6, 7],
		]);
	});
});
