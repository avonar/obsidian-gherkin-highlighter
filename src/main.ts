import { MarkdownView, Plugin, type Editor } from "obsidian";
import type { Extension } from "@codemirror/state";
import { GHERKIN_CODE_LANGUAGES } from "./gherkin/languages";
import { DEFAULT_LANGUAGE, resolveDialect } from "./gherkin/dialects";
import { renderGherkin } from "./reading/processor";
import { gherkinHighlighter } from "./editor/highlighter";
import { FeatureView, VIEW_TYPE_FEATURE } from "./view/featureView";
import {
	DEFAULT_COLORS,
	DEFAULT_SETTINGS,
	GherkinSettingTab,
	applyColors,
	clearColors,
	type GherkinSettings,
} from "./settings";

export default class GherkinHighlighterPlugin extends Plugin {
	settings: GherkinSettings = { ...DEFAULT_SETTINGS };
	/** Mutable array so settings changes can be picked up by updateOptions(). */
	private editorExtensions: Extension[] = [];

	async onload(): Promise<void> {
		await this.loadSettings();
		applyColors(this.settings);

		for (const language of GHERKIN_CODE_LANGUAGES) {
			this.registerMarkdownCodeBlockProcessor(language, (source, el) => {
				renderGherkin(source, el, this.settings.defaultLanguage);
			});
		}

		this.editorExtensions.push(
			gherkinHighlighter({
				getLanguage: () => this.settings.defaultLanguage,
				isEnabled: () => this.settings.highlightInEditor,
			}),
		);
		this.registerEditorExtension(this.editorExtensions);

		this.registerView(
			VIEW_TYPE_FEATURE,
			(leaf) => new FeatureView(leaf, this),
		);
		this.registerFeatureExtension();

		this.addCommand({
			id: "insert-scenario",
			name: "Insert Gherkin scenario block",
			editorCallback: (editor: Editor) => {
				editor.replaceSelection(
					scenarioTemplate(this.settings.defaultLanguage),
				);
			},
		});

		this.addSettingTab(new GherkinSettingTab(this.app, this));
	}

	onunload(): void {
		clearColors();
	}

	/**
	 * Another plugin may already own `.feature`; Obsidian throws in that case,
	 * and losing our highlighting is better than failing to load.
	 */
	private registerFeatureExtension(): void {
		if (!this.settings.handleFeatureFiles) return;
		try {
			this.registerExtensions(["feature"], VIEW_TYPE_FEATURE);
		} catch (error) {
			console.warn(
				"Gherkin Highlighter: .feature is handled by another plugin",
				error,
			);
		}
	}

	async loadSettings(): Promise<void> {
		const stored = (await this.loadData()) as Partial<GherkinSettings> | null;
		this.settings = {
			...DEFAULT_SETTINGS,
			...stored,
			colors: { ...DEFAULT_COLORS, ...stored?.colors },
		};
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
		applyColors(this.settings);
		// Rebuilds editor decorations with the new language and enabled flag.
		this.app.workspace.updateOptions();
		this.rerenderReadingViews();
	}

	private rerenderReadingViews(): void {
		for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
			const view = leaf.view;
			if (view instanceof MarkdownView) view.previewMode.rerender(true);
		}
	}
}

/** A starter scenario in the configured dialect. */
function scenarioTemplate(language: string): string {
	const dialect = resolveDialect(language);
	const lines = ["```gherkin"];
	if (dialect.language !== DEFAULT_LANGUAGE) {
		lines.push(`# language: ${dialect.language}`);
	}
	lines.push(
		`${dialect.feature[0]} `,
		"",
		`  ${dialect.scenario[0]} `,
		`    ${dialect.given[0]} `,
		`    ${dialect.when[0]} `,
		`    ${dialect.then[0]} `,
		"```",
	);
	return lines.join("\n");
}
