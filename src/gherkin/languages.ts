/** Code block languages this plugin claims. */
export const GHERKIN_CODE_LANGUAGES = ["gherkin", "feature", "cucumber"];

export function isGherkinCodeLanguage(language: string): boolean {
	return GHERKIN_CODE_LANGUAGES.includes(language.toLowerCase());
}
