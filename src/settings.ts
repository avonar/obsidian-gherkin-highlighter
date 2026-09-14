import { App, PluginSettingTab, Setting } from "obsidian";
import { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } from "./gherkin/dialects";
import type GherkinHighlighterPlugin from "./main";

/** Token colours the settings tab lets the user override. */
export const COLOR_KEYS = [
	"keyword",
	"name",
	"step",
	"tag",
	"comment",
	"string",
	"placeholder",
] as const;

export type ColorKey = (typeof COLOR_KEYS)[number];

export const COLOR_LABELS: Record<ColorKey, string> = {
	keyword: "Feature, Scenario, Examples",
	name: "Feature and scenario titles, table headers",
	step: "Given, When, Then",
	tag: "Tags",
	comment: "Comments",
	string: "Strings, doc strings, table cells",
	placeholder: "Placeholders <like this>",
};

/**
 * Default palette, modelled on Notion's light-mode code blocks: teal keywords,
 * orange titles and table headers, blue steps, green strings.
 */
export const DEFAULT_COLORS: Record<ColorKey, string> = {
	keyword: "#0b6e99",
	name: "#d9730d",
	step: "#2e7cd6",
	tag: "#6940a5",
	comment: "#787774",
	string: "#448c27",
	placeholder: "#d9730d",
};

export interface GherkinSettings {
	/** Highlight Gherkin while editing, not just in reading mode. */
	highlightInEditor: boolean;
	/** Dialect used until a `# language:` directive says otherwise. */
	defaultLanguage: string;
	/** Take colours from the active Obsidian theme instead of the palette. */
	useThemeColors: boolean;
	colors: Record<ColorKey, string>;
	/** Open `.feature` files in the plugin's own editor. */
	handleFeatureFiles: boolean;
}

export const DEFAULT_SETTINGS: GherkinSettings = {
	highlightInEditor: true,
	defaultLanguage: DEFAULT_LANGUAGE,
	useThemeColors: false,
	colors: { ...DEFAULT_COLORS },
	handleFeatureFiles: true,
};

const THEME_CLASS = "gherkin-theme-colors";

/**
 * Pushes the palette onto the document as CSS variables, or flags the body so
 * the stylesheet switches to theme colours. Nothing needs re-rendering.
 */
export function applyColors(settings: GherkinSettings): void {
	const style = document.body.style;
	document.body.classList.toggle(THEME_CLASS, settings.useThemeColors);
	for (const key of COLOR_KEYS) {
		const variable = `--gk-${key}`;
		if (settings.useThemeColors) {
			style.removeProperty(variable);
		} else {
			style.setProperty(variable, settings.colors[key]);
		}
	}
}

/** Removes everything this plugin put on <body>, for a clean unload. */
export function clearColors(): void {
	document.body.classList.remove(THEME_CLASS);
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
				"Follow the active theme's palette instead of the built-in Notion-like one. Turn off to pick colours yourself.",
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
