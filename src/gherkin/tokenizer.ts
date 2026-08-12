/**
 * Line oriented Gherkin tokenizer.
 *
 * The tokenizer is pure: it takes a line plus the carried-over state and
 * returns non-overlapping token ranges in ascending order. Every consumer —
 * the reading mode renderer, the editor mode, the `.feature` view — renders
 * these same tokens, so highlighting cannot drift between them.
 */

import {
	DEFAULT_LANGUAGE,
	detectLanguageDirective,
	resolveDialect,
	type Dialect,
} from "./dialects";

export type TokenType =
	| "keyword"
	| "name"
	| "step"
	| "step-text"
	| "tag"
	| "comment"
	| "docstring"
	| "docstring-delimiter"
	| "table"
	| "table-header"
	| "table-separator"
	| "placeholder"
	| "string"
	| "number"
	| "description";

export interface Token {
	type: TokenType;
	/** Offset of the first character, relative to the start of the line. */
	from: number;
	/** Offset one past the last character. */
	to: number;
}

export interface TokenizerState {
	dialect: Dialect;
	/** Set once real content is seen: a later `# language:` no longer applies. */
	languageLocked: boolean;
	/** Delimiter of the doc string currently being scanned, or null. */
	docString: string | null;
	/** True when the previous line was a table row. */
	inTable: boolean;
}

export interface TokenizeOptions {
	/** Language used until a `# language:` directive says otherwise. */
	defaultLanguage?: string;
}

const DOC_STRING_DELIMITERS = ['"""', "```"];

export function createState(options: TokenizeOptions = {}): TokenizerState {
	return {
		dialect: resolveDialect(options.defaultLanguage ?? DEFAULT_LANGUAGE),
		languageLocked: false,
		docString: null,
		inTable: false,
	};
}

export function copyState(state: TokenizerState): TokenizerState {
	return {
		dialect: state.dialect,
		languageLocked: state.languageLocked,
		docString: state.docString,
		inTable: state.inTable,
	};
}

/** Tokenizes a whole document, returning one token list per line. */
export function tokenizeDocument(
	text: string,
	options: TokenizeOptions = {},
): Token[][] {
	const state = createState(options);
	return text.split("\n").map((line) => tokenizeLine(line, state));
}

/**
 * Tokenizes one line and advances the state. A line that matches nothing is
 * reported as a single `description` token, never as an error.
 */
export function tokenizeLine(line: string, state: TokenizerState): Token[] {
	const start = firstNonSpace(line);
	const end = lastNonSpace(line);

	if (state.docString !== null) return docStringLine(line, start, end, state);

	// Blank line: ends a table, carries nothing else.
	if (start >= end) {
		state.inTable = false;
		return [];
	}

	const delimiter = matchDocStringDelimiter(line, start);
	if (delimiter) return openDocString(line, start, end, delimiter, state);

	if (line[start] === "#") return commentLine(line, start, end, state);

	state.languageLocked = true;

	if (line[start] === "@") {
		state.inTable = false;
		return tagLine(line, start, end);
	}

	if (line[start] === "|") return tableRow(line, start, end, state);

	state.inTable = false;

	const block = matchKeyword(line, start, end, state.dialect.blockKeywords);
	if (block !== null) {
		const tokens: Token[] = [{ type: "keyword", from: start, to: block }];
		const nameStart = firstNonSpace(line, block);
		if (nameStart < end) {
			tokens.push(...inlineTokens(line, nameStart, end, "name"));
		}
		return tokens;
	}

	const step = matchStepKeyword(line, start, end, state.dialect);
	if (step !== null) {
		const tokens: Token[] = [{ type: "step", from: start, to: step }];
		const textStart = firstNonSpace(line, step);
		if (textStart < end) {
			tokens.push(...inlineTokens(line, textStart, end, "step-text"));
		}
		return tokens;
	}

	return inlineTokens(line, start, end, "description");
}

function docStringLine(
	line: string,
	start: number,
	end: number,
	state: TokenizerState,
): Token[] {
	const delimiter = state.docString as string;
	if (start < end && line.startsWith(delimiter, start)) {
		state.docString = null;
		const tokens: Token[] = [
			{
				type: "docstring-delimiter",
				from: start,
				to: start + delimiter.length,
			},
		];
		if (start + delimiter.length < end) {
			tokens.push({
				type: "docstring",
				from: start + delimiter.length,
				to: end,
			});
		}
		return tokens;
	}
	return start < end ? [{ type: "docstring", from: start, to: end }] : [];
}

function matchDocStringDelimiter(line: string, start: number): string | null {
	for (const delimiter of DOC_STRING_DELIMITERS) {
		if (line.startsWith(delimiter, start)) return delimiter;
	}
	return null;
}

function openDocString(
	line: string,
	start: number,
	end: number,
	delimiter: string,
	state: TokenizerState,
): Token[] {
	state.docString = delimiter;
	state.inTable = false;
	state.languageLocked = true;

	const tokens: Token[] = [
		{
			type: "docstring-delimiter",
			from: start,
			to: start + delimiter.length,
		},
	];
	// Anything after the delimiter is the content type, e.g. `"""json`.
	if (start + delimiter.length < end) {
		tokens.push({
			type: "docstring",
			from: start + delimiter.length,
			to: end,
		});
	}
	return tokens;
}

function commentLine(
	line: string,
	start: number,
	end: number,
	state: TokenizerState,
): Token[] {
	state.inTable = false;
	if (!state.languageLocked) {
		const language = detectLanguageDirective(line);
		if (language) state.dialect = resolveDialect(language);
	}
	return [{ type: "comment", from: start, to: end }];
}

const TAG = /@[^\s@]+/g;

function tagLine(line: string, start: number, end: number): Token[] {
	const tokens: Token[] = [];
	const slice = line.slice(start, end);
	TAG.lastIndex = 0;
	let match: RegExpExecArray | null;
	while ((match = TAG.exec(slice)) !== null) {
		tokens.push({
			type: "tag",
			from: start + match.index,
			to: start + match.index + match[0].length,
		});
	}
	return tokens;
}

function tableRow(
	line: string,
	start: number,
	end: number,
	state: TokenizerState,
): Token[] {
	const cellType: TokenType = state.inTable ? "table" : "table-header";
	state.inTable = true;

	const tokens: Token[] = [];
	let cellStart = -1;
	let i = start;
	while (i < end) {
		const char = line[i];
		if (char === "\\") {
			// Escaped character, `\|` above all: never a cell boundary.
			i += 2;
			continue;
		}
		if (char === "|") {
			if (cellStart !== -1 && cellStart < i) {
				tokens.push(...inlineTokens(line, cellStart, i, cellType));
			}
			tokens.push({ type: "table-separator", from: i, to: i + 1 });
			cellStart = i + 1;
			i++;
			continue;
		}
		i++;
	}
	// Content trailing an unterminated final cell.
	if (cellStart !== -1 && cellStart < end) {
		tokens.push(...inlineTokens(line, cellStart, end, cellType));
	}
	return tokens;
}

/**
 * Returns the end offset of a block keyword starting at `start`, or null.
 * Block keywords carry their own colon, so no separator check is needed.
 */
function matchKeyword(
	line: string,
	start: number,
	end: number,
	keywords: string[],
): number | null {
	for (const keyword of keywords) {
		const stop = start + keyword.length;
		if (stop <= end && line.startsWith(keyword, start)) return stop;
	}
	return null;
}

/**
 * Returns the end offset of a step keyword, or null. A step keyword must be
 * followed by whitespace or the end of the line, so `Givens` is not a step.
 */
function matchStepKeyword(
	line: string,
	start: number,
	end: number,
	dialect: Dialect,
): number | null {
	if (line[start] === "*" && isStepBoundary(line, start + 1, end)) {
		return start + 1;
	}
	for (const keyword of dialect.stepKeywords) {
		const stop = start + keyword.length;
		if (stop > end) continue;
		if (!line.startsWith(keyword, start)) continue;
		if (isStepBoundary(line, stop, end)) return stop;
	}
	return null;
}

function isStepBoundary(line: string, at: number, end: number): boolean {
	return at >= end || isSpace(line[at]);
}

/**
 * Splits a text range into strings, placeholders and numbers, filling the gaps
 * with `base`. Used for step text, block names and table cells alike.
 */
function inlineTokens(
	line: string,
	start: number,
	end: number,
	base: TokenType,
): Token[] {
	const tokens: Token[] = [];
	let plainStart = start;
	let i = start;

	const flush = (until: number) => {
		if (until > plainStart) {
			tokens.push({ type: base, from: plainStart, to: until });
		}
	};

	while (i < end) {
		const char = line[i];
		let stop = -1;
		let type: TokenType = base;

		if (char === '"' || char === "'") {
			const close = line.indexOf(char, i + 1);
			if (close !== -1 && close < end) {
				stop = close + 1;
				type = "string";
			}
		} else if (char === "<") {
			const close = line.indexOf(">", i + 1);
			if (close !== -1 && close < end) {
				stop = close + 1;
				type = "placeholder";
			}
		} else if (isDigit(char) && !isWordChar(line[i - 1])) {
			let j = i + 1;
			while (j < end && isDigit(line[j])) j++;
			if (j < end && line[j] === "." && isDigit(line[j + 1])) {
				j++;
				while (j < end && isDigit(line[j])) j++;
			}
			if (j >= end || !isWordChar(line[j])) {
				stop = j;
				type = "number";
			}
		}

		if (stop === -1) {
			i++;
			continue;
		}

		flush(i);
		tokens.push({ type, from: i, to: stop });
		i = stop;
		plainStart = i;
	}

	flush(end);
	return tokens;
}

function firstNonSpace(line: string, from = 0): number {
	let i = from;
	while (i < line.length && isSpace(line[i])) i++;
	return i;
}

function lastNonSpace(line: string): number {
	let i = line.length;
	while (i > 0 && isSpace(line[i - 1])) i--;
	return i;
}

function isSpace(char: string | undefined): boolean {
	return char === " " || char === "\t";
}

function isDigit(char: string | undefined): boolean {
	return char !== undefined && char >= "0" && char <= "9";
}

function isWordChar(char: string | undefined): boolean {
	if (char === undefined) return false;
	return /[\p{L}\p{N}_]/u.test(char);
}
