import { describe, expect, it } from "vitest";
import { tokenizeDocument, type Token } from "../src/gherkin/tokenizer";

/** Maps one line of tokens to [type, text] pairs for readable assertions. */
function pairs(line: string, tokens: Token[]): Array<[string, string]> {
	return tokens.map((token) => [
		token.type,
		line.slice(token.from, token.to),
	]);
}

function tokenizeLines(text: string): Array<Array<[string, string]>> {
	const lines = text.split("\n");
	return tokenizeDocument(text).map((tokens, index) =>
		pairs(lines[index], tokens),
	);
}

describe("block keywords", () => {
	it("highlights the keyword and the name separately", () => {
		expect(tokenizeLines("Feature: Login")[0]).toEqual([
			["keyword", "Feature:"],
			["name", "Login"],
		]);
	});

	it("keeps indentation out of the tokens", () => {
		expect(tokenizeLines("    Scenario: Happy path")[0]).toEqual([
			["keyword", "Scenario:"],
			["name", "Happy path"],
		]);
	});

	it("prefers the longest matching keyword", () => {
		expect(tokenizeLines("Scenario Outline: Adding items")[0]).toEqual([
			["keyword", "Scenario Outline:"],
			["name", "Adding items"],
		]);
	});

	it("recognises Rule, Background and Examples", () => {
		const lines = tokenizeLines("Rule: one\nBackground:\nExamples:");
		expect(lines[0][0]).toEqual(["keyword", "Rule:"]);
		expect(lines[1]).toEqual([["keyword", "Background:"]]);
		expect(lines[2]).toEqual([["keyword", "Examples:"]]);
	});

	it("does not treat a keyword in the middle of a line as a keyword", () => {
		expect(tokenizeLines("The Feature: is late")[0]).toEqual([
			["description", "The Feature: is late"],
		]);
	});
});

describe("steps", () => {
	it("splits the step keyword from the step text", () => {
		expect(tokenizeLines("  Given a registered user")[0]).toEqual([
			["step", "Given"],
			["step-text", "a registered user"],
		]);
	});

	it("recognises every English step keyword", () => {
		const lines = tokenizeLines(
			"When x\nThen y\nAnd z\nBut w\n* bullet",
		);
		expect(lines.map((line) => line[0])).toEqual([
			["step", "When"],
			["step", "Then"],
			["step", "And"],
			["step", "But"],
			["step", "*"],
		]);
	});

	it("does not highlight a step keyword inside the step text", () => {
		expect(tokenizeLines("Then I see Given on screen")[0]).toEqual([
			["step", "Then"],
			["step-text", "I see Given on screen"],
		]);
	});

	it("requires whitespace after the keyword", () => {
		expect(tokenizeLines("Givens are not steps")[0]).toEqual([
			["description", "Givens are not steps"],
		]);
	});

	it("highlights a bare keyword with no text", () => {
		expect(tokenizeLines("Given")[0]).toEqual([["step", "Given"]]);
	});
});

describe("inline tokens", () => {
	it("highlights quoted strings", () => {
		expect(tokenizeLines('Given a user "admin" logs in')[0]).toEqual([
			["step", "Given"],
			["step-text", "a user "],
			["string", '"admin"'],
			["step-text", " logs in"],
		]);
	});

	it("highlights single-quoted strings", () => {
		expect(tokenizeLines("Given a user 'admin'")[0]).toEqual([
			["step", "Given"],
			["step-text", "a user "],
			["string", "'admin'"],
		]);
	});

	it("highlights numbers", () => {
		expect(tokenizeLines("Then I have 42 items")[0]).toEqual([
			["step", "Then"],
			["step-text", "I have "],
			["number", "42"],
			["step-text", " items"],
		]);
	});

	it("does not treat digits inside a word as a number", () => {
		expect(tokenizeLines("Then user7 logs in")[0]).toEqual([
			["step", "Then"],
			["step-text", "user7 logs in"],
		]);
	});

	it("highlights placeholders", () => {
		expect(tokenizeLines("When I log in as <username>")[0]).toEqual([
			["step", "When"],
			["step-text", "I log in as "],
			["placeholder", "<username>"],
		]);
	});

	it("highlights inline tokens in the feature name", () => {
		expect(tokenizeLines('Feature: the "big" one')[0]).toEqual([
			["keyword", "Feature:"],
			["name", "the "],
			["string", '"big"'],
			["name", " one"],
		]);
	});
});

describe("tags", () => {
	it("highlights each tag on the line", () => {
		expect(tokenizeLines("  @smoke @wip")[0]).toEqual([
			["tag", "@smoke"],
			["tag", "@wip"],
		]);
	});

	it("supports tags with dots and dashes", () => {
		expect(tokenizeLines("@team-a.slow")[0]).toEqual([
			["tag", "@team-a.slow"],
		]);
	});
});

describe("comments", () => {
	it("highlights a full-line comment", () => {
		expect(tokenizeLines("  # a note")[0]).toEqual([
			["comment", "# a note"],
		]);
	});

	it("does not treat a hash inside a step as a comment", () => {
		expect(tokenizeLines("Given the tag # is typed")[0]).toEqual([
			["step", "Given"],
			["step-text", "the tag # is typed"],
		]);
	});
});

describe("doc strings", () => {
	it("marks the delimiters and the payload", () => {
		const lines = tokenizeLines(
			'Given a payload\n  """\n  Given not a step\n  """\nThen it works',
		);
		expect(lines[1]).toEqual([["docstring-delimiter", '"""']]);
		expect(lines[2]).toEqual([["docstring", "Given not a step"]]);
		expect(lines[3]).toEqual([["docstring-delimiter", '"""']]);
		expect(lines[4][0]).toEqual(["step", "Then"]);
	});

	it("supports backtick doc strings", () => {
		const lines = tokenizeLines("```\nGiven not a step\n```");
		expect(lines[0]).toEqual([["docstring-delimiter", "```"]]);
		expect(lines[1]).toEqual([["docstring", "Given not a step"]]);
	});

	it("keeps a backtick doc string open across a quote delimiter", () => {
		const lines = tokenizeLines('```\n"""\n```');
		expect(lines[1]).toEqual([["docstring", '"""']]);
		expect(lines[2]).toEqual([["docstring-delimiter", "```"]]);
	});

	it("highlights the content type after the delimiter", () => {
		expect(tokenizeLines('"""json')[0]).toEqual([
			["docstring-delimiter", '"""'],
			["docstring", "json"],
		]);
	});
});

describe("tables", () => {
	it("marks the first row as a header and the rest as body", () => {
		const lines = tokenizeLines(
			"| name | age |\n| ann | 30 |",
		);
		expect(lines[0]).toEqual([
			["table-separator", "|"],
			["table-header", " name "],
			["table-separator", "|"],
			["table-header", " age "],
			["table-separator", "|"],
		]);
		expect(lines[1]).toEqual([
			["table-separator", "|"],
			["table", " ann "],
			["table-separator", "|"],
			["table", " "],
			["number", "30"],
			["table", " "],
			["table-separator", "|"],
		]);
	});

	it("starts a new header after the table ends", () => {
		const lines = tokenizeLines(
			"| a |\n| b |\n\n| c |",
		);
		expect(lines[0][1]).toEqual(["table-header", " a "]);
		expect(lines[1][1]).toEqual(["table", " b "]);
		expect(lines[3][1]).toEqual(["table-header", " c "]);
	});

	it("does not split cells on an escaped pipe", () => {
		const lines = tokenizeLines("| a |\n| x \\| y |");
		expect(lines[1]).toEqual([
			["table-separator", "|"],
			["table", " x \\| y "],
			["table-separator", "|"],
		]);
	});

	it("highlights placeholders inside cells", () => {
		const lines = tokenizeLines("| header |\n| <name> |");
		expect(lines[1]).toEqual([
			["table-separator", "|"],
			["table", " "],
			["placeholder", "<name>"],
			["table", " "],
			["table-separator", "|"],
		]);
	});
});

describe("dialects", () => {
	it("highlights Russian keywords after a language directive", () => {
		const lines = tokenizeLines(
			"# language: ru\nФункция: Вход\n  Сценарий: Успешный вход\n    Дано пользователь\n    Когда он входит\n    Тогда он внутри",
		);
		expect(lines[0]).toEqual([["comment", "# language: ru"]]);
		expect(lines[1]).toEqual([
			["keyword", "Функция:"],
			["name", "Вход"],
		]);
		expect(lines[2][0]).toEqual(["keyword", "Сценарий:"]);
		expect(lines[3][0]).toEqual(["step", "Дано"]);
		expect(lines[4][0]).toEqual(["step", "Когда"]);
		expect(lines[5][0]).toEqual(["step", "Тогда"]);
	});

	it("keeps English keywords working without a directive", () => {
		expect(tokenizeLines("Feature: x")[0][0]).toEqual([
			"keyword",
			"Feature:",
		]);
	});

	it("honours an explicit default language", () => {
		const [line] = tokenizeDocument("Функция: Вход", {
			defaultLanguage: "ru",
		});
		expect(line[0].type).toBe("keyword");
	});

	it("ignores a directive that appears after content", () => {
		const lines = tokenizeLines("Feature: x\n# language: ru\nФункция: y");
		expect(lines[2]).toEqual([["description", "Функция: y"]]);
	});
});

describe("plain lines", () => {
	it("treats free text as a description", () => {
		expect(tokenizeLines("  As a user I want to log in")[0]).toEqual([
			["description", "As a user I want to log in"],
		]);
	});

	it("produces no tokens for a blank line", () => {
		expect(tokenizeLines("Feature: x\n\nScenario: y")[1]).toEqual([]);
	});

	it("produces no tokens for a whitespace-only line", () => {
		expect(tokenizeLines("   ")[0]).toEqual([]);
	});
});

describe("document shape", () => {
	it("returns one entry per line", () => {
		expect(tokenizeDocument("a\nb\nc")).toHaveLength(3);
	});

	it("handles an empty document", () => {
		expect(tokenizeDocument("")).toEqual([[]]);
	});

	it("returns tokens in ascending, non-overlapping order", () => {
		const text =
			'@tag\nFeature: "quoted" name\n  Given 5 users <x>\n  | a | b |\n  | 1 | 2 |';
		for (const line of tokenizeDocument(text)) {
			let previous = 0;
			for (const token of line) {
				expect(token.from).toBeGreaterThanOrEqual(previous);
				expect(token.to).toBeGreaterThan(token.from);
				previous = token.to;
			}
		}
	});
});
