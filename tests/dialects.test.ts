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

	it("orders keywords longest first so that prefixes do not win", () => {
		const dialect = resolveDialect("en");
		const outline = dialect.scenarioOutline.indexOf("Scenario Outline:");
		const template = dialect.scenarioOutline.indexOf("Scenario Template:");
		expect(outline).toBeGreaterThanOrEqual(0);
		expect(template).toBeGreaterThanOrEqual(0);
		for (let i = 1; i < dialect.given.length; i++) {
			expect(dialect.given[i - 1].length).toBeGreaterThanOrEqual(
				dialect.given[i].length,
			);
		}
	});
});
