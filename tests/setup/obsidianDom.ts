/**
 * Minimal stand-ins for the DOM helpers Obsidian adds to Element and Node.
 * Only the subset the plugin uses is implemented, which is enough to render the
 * reading mode output in jsdom and assert on it.
 */

interface DomElementInfo {
	cls?: string | string[];
	text?: string;
}

function create<K extends keyof HTMLElementTagNameMap>(
	parent: Node,
	tag: K,
	info?: DomElementInfo,
): HTMLElementTagNameMap[K] {
	const el = document.createElement(tag);
	if (info?.cls) {
		const classes = Array.isArray(info.cls) ? info.cls : info.cls.split(" ");
		el.classList.add(...classes.filter(Boolean));
	}
	if (info?.text !== undefined) el.textContent = info.text;
	parent.appendChild(el);
	return el;
}

const element = HTMLElement.prototype as unknown as Record<string, unknown>;
const node = Node.prototype as unknown as Record<string, unknown>;

element.createEl = function (tag: string, info?: DomElementInfo) {
	return create(this as unknown as Node, tag as "div", info);
};

element.createDiv = function (info?: DomElementInfo) {
	return create(this as unknown as Node, "div", info);
};

element.createSpan = function (info?: DomElementInfo) {
	return create(this as unknown as Node, "span", info);
};

element.empty = function () {
	const self = this as unknown as HTMLElement;
	while (self.firstChild) self.removeChild(self.firstChild);
};

node.appendText = function (text: string) {
	(this as unknown as Node).appendChild(document.createTextNode(text));
};

export {};
