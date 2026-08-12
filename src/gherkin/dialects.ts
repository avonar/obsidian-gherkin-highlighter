/**
 * Gherkin keyword tables. Kept free of Obsidian imports so that the tokenizer
 * can be unit tested without an Obsidian runtime.
 */

export const DEFAULT_LANGUAGE = "en";

/** The keyword categories a dialect defines. */
export interface DialectKeywords {
	/** Human readable name, shown in the settings tab. */
	name: string;
	feature: string[];
	background: string[];
	rule: string[];
	scenario: string[];
	scenarioOutline: string[];
	examples: string[];
	given: string[];
	when: string[];
	then: string[];
	and: string[];
	but: string[];
}

export interface Dialect extends DialectKeywords {
	/** Language code this dialect was resolved from. */
	language: string;
	/** Block keywords (they end with a colon), longest first. */
	blockKeywords: string[];
	/** Step keywords, longest first. `*` is handled by the tokenizer. */
	stepKeywords: string[];
}

const RAW_DIALECTS: Record<string, DialectKeywords> = {
	en: {
		name: "English",
		feature: ["Feature:", "Business Need:", "Ability:"],
		background: ["Background:"],
		rule: ["Rule:"],
		scenario: ["Scenario:", "Example:"],
		scenarioOutline: ["Scenario Outline:", "Scenario Template:"],
		examples: ["Examples:", "Scenarios:"],
		given: ["Given"],
		when: ["When"],
		then: ["Then"],
		and: ["And"],
		but: ["But"],
	},
	ru: {
		name: "Русский",
		feature: [
			"Функция:",
			"Функциональность:",
			"Функционал:",
			"Функциональная возможность:",
			"Свойство:",
		],
		background: ["Предыстория:", "Контекст:"],
		rule: ["Правило:"],
		scenario: ["Сценарий:", "Пример:"],
		scenarioOutline: ["Структура сценария:", "Шаблон сценария:"],
		examples: ["Примеры:"],
		given: ["Допустим", "Дано", "Пусть"],
		when: ["Когда", "Если"],
		then: ["Тогда", "Затем", "То"],
		and: ["К тому же", "Также", "И", "А"],
		but: ["Иначе", "Но", "А"],
	},
};

/** Language codes this plugin knows about, in menu order. */
export const SUPPORTED_LANGUAGES: Array<{ code: string; name: string }> =
	Object.keys(RAW_DIALECTS).map((code) => ({
		code,
		name: RAW_DIALECTS[code].name,
	}));

/** Longest first, so that `Scenario Outline:` wins over `Scenario:`. */
function byLengthDesc(keywords: string[]): string[] {
	return Array.from(new Set(keywords)).sort((a, b) => b.length - a.length);
}

const CACHE = new Map<string, Dialect>();

/**
 * Returns the keyword tables for a language code, falling back to the default
 * language when the code is unknown.
 */
export function resolveDialect(language: string): Dialect {
	const code = language.toLowerCase();
	const cached = CACHE.get(code);
	if (cached) return cached;

	const raw = RAW_DIALECTS[code];
	if (!raw) return resolveDialect(DEFAULT_LANGUAGE);

	const dialect = buildDialect(code, raw);
	CACHE.set(code, dialect);
	return dialect;
}

function buildDialect(code: string, raw: DialectKeywords): Dialect {
	return {
		...raw,
		language: code,
		feature: byLengthDesc(raw.feature),
		background: byLengthDesc(raw.background),
		rule: byLengthDesc(raw.rule),
		scenario: byLengthDesc(raw.scenario),
		scenarioOutline: byLengthDesc(raw.scenarioOutline),
		examples: byLengthDesc(raw.examples),
		given: byLengthDesc(raw.given),
		when: byLengthDesc(raw.when),
		then: byLengthDesc(raw.then),
		and: byLengthDesc(raw.and),
		but: byLengthDesc(raw.but),
		blockKeywords: byLengthDesc([
			...raw.feature,
			...raw.background,
			...raw.rule,
			...raw.scenario,
			...raw.scenarioOutline,
			...raw.examples,
		]),
		stepKeywords: byLengthDesc([
			...raw.given,
			...raw.when,
			...raw.then,
			...raw.and,
			...raw.but,
		]),
	};
}

/** True when the code names a dialect this plugin ships. */
export function isSupportedLanguage(language: string): boolean {
	return Object.prototype.hasOwnProperty.call(
		RAW_DIALECTS,
		language.toLowerCase(),
	);
}

const LANGUAGE_DIRECTIVE = /^\s*#\s*language\s*:\s*([A-Za-z0-9-]+)\s*$/;

/**
 * Reads the language code out of a `# language: xx` comment, or returns null
 * when the line is not such a directive.
 */
export function detectLanguageDirective(line: string): string | null {
	const match = LANGUAGE_DIRECTIVE.exec(line);
	return match ? match[1].toLowerCase() : null;
}
