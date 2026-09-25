import { Scope, TextFileView, type WorkspaceLeaf } from "obsidian";
import { EditorState } from "@codemirror/state";
import {
	EditorView,
	drawSelection,
	highlightActiveLine,
	keymap,
	lineNumbers,
} from "@codemirror/view";
import {
	defaultKeymap,
	history,
	historyKeymap,
	indentWithTab,
} from "@codemirror/commands";
import {
	findNext,
	findPrevious,
	highlightSelectionMatches,
	openSearchPanel,
	search,
	searchKeymap,
} from "@codemirror/search";
import { gherkinHighlighter } from "../editor/highlighter";
import type GherkinHighlighterPlugin from "../main";

export const VIEW_TYPE_FEATURE = "gherkin-feature-view";

/**
 * Editor for standalone `.feature` files. The file is plain Gherkin, not
 * markdown, so it gets its own CodeMirror instance rather than being squeezed
 * through the markdown editor.
 */
export class FeatureView extends TextFileView {
	private plugin: GherkinHighlighterPlugin;
	private editor: EditorView | null = null;
	/** Guards against reporting a change we made ourselves as a user edit. */
	private applyingExternalChange = false;

	constructor(leaf: WorkspaceLeaf, plugin: GherkinHighlighterPlugin) {
		super(leaf);
		this.plugin = plugin;
		this.scope = this.buildScope();
	}

	/**
	 * Obsidian pushes a view's scope while that view is active, so these fire
	 * even when focus is not inside the CodeMirror content — which is where
	 * Obsidian's own "Search current file" would otherwise swallow Cmd+F.
	 */
	private buildScope(): Scope {
		const scope = new Scope(this.app.scope);
		const bind = (
			modifiers: Parameters<Scope["register"]>[0],
			key: string,
			command: (view: EditorView) => boolean,
		) => {
			scope.register(modifiers, key, () => {
				if (!this.editor) return true;
				command(this.editor);
				return false;
			});
		};
		bind(["Mod"], "f", openSearchPanel);
		bind(["Mod", "Alt"], "f", openSearchPanel);
		bind(["Mod"], "g", findNext);
		bind(["Mod", "Shift"], "g", findPrevious);
		return scope;
	}

	getViewType(): string {
		return VIEW_TYPE_FEATURE;
	}

	getDisplayText(): string {
		return this.file ? this.file.basename : "Feature";
	}

	getIcon(): string {
		return "file-code";
	}

	getViewData(): string {
		return this.editor ? this.editor.state.doc.toString() : this.data;
	}

	setViewData(data: string, clear: boolean): void {
		this.data = data;
		if (!this.editor) return;

		this.applyingExternalChange = true;
		try {
			this.editor.dispatch({
				changes: {
					from: 0,
					to: this.editor.state.doc.length,
					insert: data,
				},
				selection: clear ? { anchor: 0 } : undefined,
				scrollIntoView: clear,
			});
		} finally {
			this.applyingExternalChange = false;
		}
	}

	clear(): void {
		this.setViewData("", true);
	}

	async onOpen(): Promise<void> {
		this.contentEl.empty();
		const wrapper = this.contentEl.createDiv({
			cls: "gherkin-feature-editor",
		});

		this.editor = new EditorView({
			parent: wrapper,
			state: EditorState.create({
				doc: this.data,
				extensions: [
					lineNumbers(),
					history(),
					drawSelection(),
					highlightActiveLine(),
					highlightSelectionMatches(),
					// Obsidian's own Cmd+F only knows its markdown editor, so
					// the view brings CodeMirror's search panel along.
					search({ top: true }),
					EditorView.lineWrapping,
					keymap.of([
						...defaultKeymap,
						...historyKeymap,
						...searchKeymap,
						indentWithTab,
					]),
					gherkinHighlighter({
						wholeDocument: true,
						getLanguage: () =>
							this.plugin.settings.defaultLanguage,
					}),
					EditorView.updateListener.of((update) => {
						if (!update.docChanged) return;
						if (this.applyingExternalChange) return;
						this.data = update.state.doc.toString();
						this.requestSave();
					}),
				],
			}),
		});
		this.editor.focus();
	}

	async onClose(): Promise<void> {
		this.editor?.destroy();
		this.editor = null;
	}
}
