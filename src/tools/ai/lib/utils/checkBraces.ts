import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { walkFiles } from './walkFiles'
import type { BraceMismatchIssue } from '../../types/checkBraces'

/**
 * Scans Paradox script text for unbalanced `{ }` pairs, ignoring braces that
 * appear inside `"quoted strings"` or after a `#` comment marker.
 */
export const findBraceMismatchesInSource = (
	source: string,
): Omit<BraceMismatchIssue, 'file'>[] => {
	const issues: Omit<BraceMismatchIssue, 'file'>[] = []
	const openStack: { line: number; column: number }[] = []

	const lines = source.split(/\r\n|\r|\n/)

	for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
		const line = lines[lineIndex]
		let inQuotes = false

		for (let column = 0; column < line.length; column += 1) {
			const char = line[column]

			if (char === '"') {
				inQuotes = !inQuotes
				continue
			}

			if (inQuotes) {
				continue
			}

			if (char === '#') {
				break // Rest of the line is a comment.
			}

			if (char === '{') {
				openStack.push({ line: lineIndex + 1, column: column + 1 })
				continue
			}

			if (char === '}') {
				if (openStack.length === 0) {
					issues.push({
						line: lineIndex + 1,
						column: column + 1,
						message:
							'Unmatched closing brace `}` with no corresponding `{`.',
					})
					continue
				}
				openStack.pop()
			}
		}
	}

	for (const unclosed of openStack) {
		issues.push({
			line: unclosed.line,
			column: unclosed.column,
			message: 'Unclosed opening brace `{` was never closed.',
		})
	}

	return issues
}

export const findBraceMismatchesInFile = (
	filePath: string,
): BraceMismatchIssue[] => {
	const source = fs.readFileSync(filePath, 'utf8')
	return findBraceMismatchesInSource(source).map((issue) => ({
		file: filePath,
		...issue,
	}))
}

export const checkBraces = (rootDir: string): BraceMismatchIssue[] => {
	const files = walkFiles(rootDir, { extensions: ['.txt'] })
	const issues: BraceMismatchIssue[] = []

	for (const file of files) {
		issues.push(...findBraceMismatchesInFile(file))
	}

	return issues
}

const runCli = () => {
	const rootDir = process.argv[2]
		? path.resolve(process.cwd(), process.argv[2])
		: path.resolve(process.cwd(), '../../assets')

	console.log(`Checking for brace mismatches under ${rootDir}`)
	const issues = checkBraces(rootDir)

	if (issues.length === 0) {
		console.log('No brace mismatches found.')
		return
	}

	console.error(`Found ${issues.length} brace mismatch issue(s):`)
	for (const issue of issues) {
		console.error(
			`${path.relative(rootDir, issue.file)}:${issue.line}:${issue.column} - ${issue.message}`,
		)
	}
	process.exitCode = 1
}

const isDirectRun =
	process.argv[1] !== undefined &&
	fileURLToPath(import.meta.url) === path.resolve(process.argv[1])

if (isDirectRun) {
	runCli()
}
