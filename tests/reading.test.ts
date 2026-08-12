// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import "./setup/obsidianDom";
import { renderGherkin } from "../src/reading/processor";

const SOURCE = [
	"@smoke",
	"Feature: Login",
	"  As a user I want in",
	"",
	"  Scenario: Happy path",
	'    Given a user "admin"',
	"    When they log in",
	"    Then they see 2 tabs",
	"",
	"    | name | role |",
	"    | ann  | dev  |",
].join("\n");

describe("renderGherkin", () => {
	let container: HTMLElement;

	beforeEach(() => {
		document.body.innerHTML = "";
		container = document.createElement("div");
		document.body.appendChild(container);
	});

	function render(source: string, language = "en"): HTMLElement {
		renderGherkin(source, container, language);
		return container.querySelector("code") as HTMLElement;
	}

	it("reproduces the source text exactly", () => {
		expect(render(SOURCE).textContent).toBe(SOURCE);
	});

	it("drops a single trailing newline, as fenced blocks carry one", () => {
		expect(render("Feature: x\n").textContent).toBe("Feature: x");
	});

	it("wraps the output in a pre/code pair", () => {
		render(SOURCE);
		const pre = container.querySelector("pre.gherkin-highlight");
		expect(pre).not.toBeNull();
		expect(pre?.firstElementChild?.tagName).toBe("CODE");
	});

	it("marks keywords, steps, tags and strings", () => {
		const code = render(SOURCE);
		const textOf = (selector: string) =>
			Array.from(code.querySelectorAll(selector)).map(
				(el) => el.textContent,
			);

		expect(textOf(".gk-keyword")).toEqual(["Feature:", "Scenario:"]);
		expect(textOf(".gk-step")).toEqual(["Given", "When", "Then"]);
		expect(textOf(".gk-tag")).toEqual(["@smoke"]);
		expect(textOf(".gk-string")).toEqual(['"admin"']);
		expect(textOf(".gk-number")).toEqual(["2"]);
		expect(textOf(".gk-table-header")).toEqual([" name ", " role "]);
	});

	it("keeps indentation as plain text outside the spans", () => {
		const code = render("  Given x");
		expect(code.textContent).toBe("  Given x");
		expect(code.querySelector(".gk-step")?.textContent).toBe("Given");
	});

	it("uses the language passed in", () => {
		const code = render("Функция: Вход", "ru");
		expect(code.querySelector(".gk-keyword")?.textContent).toBe("Функция:");
	});

	it("renders an empty source without throwing", () => {
		expect(render("").textContent).toBe("");
	});
});
