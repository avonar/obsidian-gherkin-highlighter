/**
 * Copies the built plugin into a vault.
 *
 *   node scripts/install-plugin.mjs "/path/to/vault"
 */
import { copyFile, mkdir, access } from "node:fs/promises";
import { join, resolve } from "node:path";
import process from "node:process";

const FILES = ["main.js", "manifest.json", "styles.css"];

const vault = process.argv[2];
if (!vault) {
	console.error('Usage: node scripts/install-plugin.mjs "/path/to/vault"');
	process.exit(1);
}

const target = resolve(vault, ".obsidian", "plugins", "gherkin-highlighter");

try {
	await access(resolve(vault, ".obsidian"));
} catch {
	console.error(`Not an Obsidian vault (no .obsidian folder): ${vault}`);
	process.exit(1);
}

for (const file of FILES) {
	try {
		await access(file);
	} catch {
		console.error(`Missing ${file}. Run "npm run build" first.`);
		process.exit(1);
	}
}

await mkdir(target, { recursive: true });
for (const file of FILES) {
	await copyFile(file, join(target, file));
}

console.log(`Installed to ${target}`);
console.log("Enable it under Settings -> Community plugins.");
