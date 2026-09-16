import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { walkFiles } from './walkFiles'
import type { LocalizationIssue } from '../../types/checkLocalization'

const UTF8_BOM = Buffer.from([0xef, 0xbb, 0xbf])

const HEADER_PATTERN = /^l_[a-z]+:\s*$/
const ENTRY_PATTERN = /^\s*[A-Za-z0-9_.'-]+\s*:\s*\d*\s+".*"\s*(#.*)?$/
const COMMENT_PATTERN = /^\s*#/

/** Validates a single Paradox localisation `.yml` file against the engine's format rules. */
export const checkLocalizationFile = (
	filePath: string,
): LocalizationIssue[] => {
	const issues: LocalizationIssue[] = []
	const buffer = fs.readFileSync(filePath)

	const hasBom = buffer.subarray(0, 3).equals(UTF8_BOM)
	if (!hasBom) {
		issues.push({
			file: filePath,
			message:
				'File is missing the required UTF-8 BOM. Paradox localisation files must be saved as "UTF-8 with BOM".',
		})
	}

	const content = (hasBom ? buffer.subarray(3) : buffer).toString('utf8')

	if (content.length === 0) {
		issues.push({ file: filePath, message: 'File is empty.' })
		return issues
	}

	if (!/\r\n|\n$/.test(content)) {
		issues.push({
			file: filePath,
			message: 'File does not end with a newline.',
		})
	}

	const lines = content.split(/\r\n|\r|\n/)
	let sawHeader = false

	for (let index = 0; index < lines.length; index += 1) {
		const line = lines[index]
		const lineNumber = index + 1
		const trimmed = line.trim()

		if (trimmed.length === 0 || COMMENT_PATTERN.test(trimmed)) {
			continue
		}

		if (!sawHeader) {
			if (!HEADER_PATTERN.test(trimmed)) {
				issues.push({
					file: filePath,
					line: lineNumber,
					message: `Expected a language header like "l_english:" as the first content line, found "${trimmed}".`,
				})
			}
			sawHeader = true
			continue
		}

		if (!ENTRY_PATTERN.test(line)) {
			issues.push({
				file: filePath,
				line: lineNumber,
				message: `Line does not match the expected "key:number \\"value\\"" localisation entry format.`,
			})
		}
	}

	if (!sawHeader) {
		issues.push({
			file: filePath,
			message: 'File has no language header (e.g. "l_english:").',
		})
	}

	return issues
}

export const checkLocalization = (rootDir: string): LocalizationIssue[] => {
	const ymlFiles = walkFiles(rootDir, { extensions: ['.yml'] }).filter(
		(file) => file.split(path.sep).includes('localization'),
	)

	const issues: LocalizationIssue[] = []
	for (const file of ymlFiles) {
		issues.push(...checkLocalizationFile(file))
	}

	return issues
}

const runCli = () => {
	const rootDir = process.argv[2]
		? path.resolve(process.cwd(), process.argv[2])
		: path.resolve(process.cwd(), '../..')

	console.log(`Checking localization files under ${rootDir}`)
	const issues = checkLocalization(rootDir)

	if (issues.length === 0) {
		console.log('No localization files found or all files are valid.')
		return
	}

	console.error(`Found ${issues.length} localization issue(s):`)
	for (const issue of issues) {
		const location = issue.line ? `:${issue.line}` : ''
		console.error(
			`${path.relative(rootDir, issue.file)}${location} - ${issue.message}`,
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
