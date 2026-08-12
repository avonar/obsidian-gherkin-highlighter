import { describe, expect, it } from "vitest";
import {
	detectLanguageDirective,
	resolveDialect,
	DEFAULT_LANGUAGE,
} from "../src/gherkin/dialects";

describe("detectLanguageDirective", () => {
	it("reads the language code from a directive", () => {
		expect(detectLanguageDirective("# language: ru")).toBe("ru");
	});

	it("tolerates spacing variations", () => {
		expect(detectLanguageDirective("#language:ru")).toBe("ru");
		expect(detectLanguageDirective("   #  language :  ru  ")).toBe("ru");
	});

	it("lowercases the code", () => {
		expect(detectLanguageDirective("# language: RU")).toBe("ru");
	});

	it("returns null for an ordinary comment", () => {
		expect(detectLanguageDirective("# just a note")).toBeNull();
	});

	it("returns null for a non-comment line", () => {
		expect(detectLanguageDirective("Feature: language: ru")).toBeNull();
	});
});

describe("resolveDialect", () => {
	it("resolves English", () => {
		const dialect = resolveDialect("en");
		expect(dialect.language).toBe("en");
		expect(dialect.feature).toContain("Feature:");
		expect(dialect.given).toContain("Given");
	});

	it("resolves Russian", () => {
		const dialect = resolveDialect("ru");
		expect(dialect.language).toBe("ru");
		expect(dialect.feature).toContain("Функция:");
		expect(dialect.when).toContain("Когда");
		expect(dialect.then).toContain("Тогда");
	});

	it("falls back to the default language for unknown codes", () => {
		expect(resolveDialect("klingon").language).toBe(DEFAULT_LANGUAGE);
	});

	it("orders match tables longest first so that prefixes do not win", () => {
		for (const code of ["en", "ru"]) {
			const dialect = resolveDialect(code);
			for (const table of [dialect.blockKeywords, dialect.stepKeywords]) {
				for (let i = 1; i < table.length; i++) {
					expect(table[i - 1].length).toBeGreaterThanOrEqual(
						table[i].length,
					);
				}
			}
		}
	});

	it("keeps the primary keyword of each category first", () => {
		expect(resolveDialect("en").feature[0]).toBe("Feature:");
		expect(resolveDialect("en").given[0]).toBe("Given");
		expect(resolveDialect("ru").feature[0]).toBe("Функция:");
		expect(resolveDialect("ru").given[0]).toBe("Дано");
	});
});
