import { App, PluginSettingTab, Setting } from "obsidian";
import { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } from "./gherkin/dialects";
import type GherkinHighlighterPlugin from "./main";

/** Token colours the settings tab lets the user override. */
export const COLOR_KEYS = [
	"keyword",
	"step",
	"tag",
	"comment",
	"string",
	"placeholder",
] as const;

export type ColorKey = (typeof COLOR_KEYS)[number];

export const COLOR_LABELS: Record<ColorKey, string> = {
	keyword: "Feature, Scenario, Examples",
	step: "Given, When, Then",
	tag: "Tags",
	comment: "Comments",
	string: 'Strings and doc strings',
	placeholder: "Placeholders <like this>",
};

/** Fallbacks used when the user turns theme colours off without picking one. */
export const DEFAULT_COLORS: Record<ColorKey, string> = {
	keyword: "#a882ff",
	step: "#4c9aff",
	tag: "#e5a33d",
	comment: "#7f8590",
	string: "#5bbd7a",
	placeholder: "#e069b0",
};

export interface GherkinSettings {
	/** Highlight Gherkin while editing, not just in reading mode. */
	highlightInEditor: boolean;
	/** Dialect used until a `# language:` directive says otherwise. */
	defaultLanguage: string;
	/** Take colours from the active Obsidian theme. */
	useThemeColors: boolean;
	colors: Record<ColorKey, string>;
	/** Open `.feature` files in the plugin's own editor. */
	handleFeatureFiles: boolean;
}

export const DEFAULT_SETTINGS: GherkinSettings = {
	highlightInEditor: true,
	defaultLanguage: DEFAULT_LANGUAGE,
	useThemeColors: true,
	colors: { ...DEFAULT_COLORS },
	handleFeatureFiles: true,
};

/**
 * Pushes colour overrides onto the document as CSS variables. The stylesheet
 * already reads these, so nothing needs re-rendering.
 */
export function applyColors(settings: GherkinSettings): void {
	const style = document.body.style;
	for (const key of COLOR_KEYS) {
		const variable = `--gk-${key}`;
		if (settings.useThemeColors) {
			style.removeProperty(variable);
		} else {
			style.setProperty(variable, settings.colors[key]);
		}
	}
}

/** Removes every variable this plugin set, for a clean unload. */
export function clearColors(): void {
	for (const key of COLOR_KEYS) {
		document.body.style.removeProperty(`--gk-${key}`);
	}
}

export class GherkinSettingTab extends PluginSettingTab {
	private plugin: GherkinHighlighterPlugin;

	constructor(app: App, plugin: GherkinHighlighterPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Highlight while editing")
			.setDesc(
				"Colour Gherkin in Live Preview and Source mode. Reading mode is always highlighted.",
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.highlightInEditor)
					.onChange(async (value) => {
						this.plugin.settings.highlightInEditor = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Default language")
			.setDesc(
				"Keyword set used when a block has no `# language:` directive. The directive always wins.",
			)
			.addDropdown((dropdown) => {
				for (const { code, name } of SUPPORTED_LANGUAGES) {
					dropdown.addOption(code, `${name} (${code})`);
				}
				dropdown
					.setValue(this.plugin.settings.defaultLanguage)
					.onChange(async (value) => {
						this.plugin.settings.defaultLanguage = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("Open .feature files")
			.setDesc(
				"Register the .feature extension so those files open in a Gherkin editor. Takes effect after Obsidian reloads the plugin.",
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.handleFeatureFiles)
					.onChange(async (value) => {
						this.plugin.settings.handleFeatureFiles = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl).setName("Colours").setHeading();

		new Setting(containerEl)
			.setName("Use theme colours")
			.setDesc(
				"Follow the active theme's palette. Turn off to pick colours yourself.",
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.useThemeColors)
					.onChange(async (value) => {
						this.plugin.settings.useThemeColors = value;
						await this.plugin.saveSettings();
						this.display();
					}),
			);

		if (this.plugin.settings.useThemeColors) return;

		for (const key of COLOR_KEYS) {
			new Setting(containerEl)
				.setName(COLOR_LABELS[key])
				.addColorPicker((picker) =>
					picker
						.setValue(this.plugin.settings.colors[key])
						.onChange(async (value) => {
							this.plugin.settings.colors[key] = value;
							await this.plugin.saveSettings();
						}),
				);
		}

		new Setting(containerEl).addButton((button) =>
			button
				.setButtonText("Reset colours")
				.onClick(async () => {
					this.plugin.settings.colors = { ...DEFAULT_COLORS };
					await this.plugin.saveSettings();
					this.display();
				}),
		);
	}
}
