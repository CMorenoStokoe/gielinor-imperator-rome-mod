import * as fs from 'node:fs'
import * as path from 'node:path'
import type { WalkFilesOptions } from '../../types/walkFiles'

const DEFAULT_IGNORED_DIRS = new Set([
	'.git',
	'node_modules',
	'output',
	'previews',
])

/** Recursively collects file paths under `rootDir` matching the given extensions. */
export const walkFiles = (
	rootDir: string,
	options: WalkFilesOptions = {},
): string[] => {
	const extensions = options.extensions
	const ignoredDirs = options.ignoredDirs ?? DEFAULT_IGNORED_DIRS
	const results: string[] = []

	if (!fs.existsSync(rootDir)) {
		return results
	}

	const entries = fs.readdirSync(rootDir, { withFileTypes: true })

	for (const entry of entries) {
		const fullPath = path.join(rootDir, entry.name)

		if (entry.isDirectory()) {
			if (ignoredDirs.has(entry.name)) {
				continue
			}
			results.push(...walkFiles(fullPath, options))
			continue
		}

		if (!extensions || extensions.includes(path.extname(entry.name))) {
			results.push(fullPath)
		}
	}

	return results
}
