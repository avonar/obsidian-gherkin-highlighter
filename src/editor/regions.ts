import { isGherkinCodeLanguage } from "../gherkin/languages";

/** A run of lines holding Gherkin, in 1-based inclusive line numbers. */
export interface GherkinRegion {
	fromLine: number;
	toLine: number;
}

/** Fence opener: up to three spaces, three or more backticks or tildes. */
const FENCE = /^ {0,3}(`{3,}|~{3,})[ \t]*([^\s`]*)/;

/**
 * Finds the fenced code blocks tagged as Gherkin. Content inside blocks of
 * other languages is skipped, so a nested fence in a ```md block cannot open a
 * region of its own.
 */
export function findFencedRegions(lines: string[]): GherkinRegion[] {
	const regions: GherkinRegion[] = [];
	let open: { marker: string; gherkin: boolean; startLine: number } | null =
		null;

	for (let index = 0; index < lines.length; index++) {
		const line = lines[index];
		if (!startsWithFence(line)) continue;

		const match = FENCE.exec(line);
		if (!match) continue;
		const [, marker, info] = match;

		if (open) {
			const closes =
				marker[0] === open.marker[0] &&
				marker.length >= open.marker.length &&
				info === "";
			if (!closes) continue;
			if (open.gherkin && index > open.startLine) {
				regions.push({ fromLine: open.startLine + 1, toLine: index });
			}
			open = null;
			continue;
		}

		open = {
			marker,
			gherkin: isGherkinCodeLanguage(info),
			startLine: index + 1,
		};
	}

	if (open && open.gherkin && open.startLine < lines.length) {
		regions.push({ fromLine: open.startLine + 1, toLine: lines.length });
	}

	return regions;
}

/** Cheap guard so long notes are not run through the regex line by line. */
function startsWithFence(line: string): boolean {
	const limit = Math.min(line.length, 4);
	for (let i = 0; i < limit; i++) {
		const char = line[i];
		if (char === "`" || char === "~") return true;
		if (char !== " ") return false;
	}
	return false;
}
