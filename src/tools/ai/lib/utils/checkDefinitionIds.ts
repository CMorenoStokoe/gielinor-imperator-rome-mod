import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { DefinitionIssue } from '../../types/checkDefinitionIds'

/** Ensures definition.csv has no colliding province ids or duplicate colors (each color must map to exactly one province). */
export const checkDefinitionIds = (csvContent: string): DefinitionIssue[] => {
	const issues: DefinitionIssue[] = []
	const idFirstSeenAtLine = new Map<number, number>()
	const colorFirstSeenAtLine = new Map<string, number>()

	const lines = csvContent.split('\n')
	for (let index = 0; index < lines.length; index += 1) {
		const line = lines[index].trim().replace(/,$/, '')
		if (!line || line.startsWith('#')) {
			continue
		}

		const [idPart, r, g, b] = line.split(';')
		const id = Number(idPart)
		if (!Number.isFinite(id) || id === 0) {
			continue
		}

		const lineNumber = index + 1
		const colorKey = `${r};${g};${b}`

		const existingIdLine = idFirstSeenAtLine.get(id)
		if (existingIdLine !== undefined) {
			issues.push({
				line: lineNumber,
				message: `Duplicate province id ${id} (first defined on line ${existingIdLine}).`,
			})
		} else {
			idFirstSeenAtLine.set(id, lineNumber)
		}

		const existingColorLine = colorFirstSeenAtLine.get(colorKey)
		if (existingColorLine !== undefined) {
			issues.push({
				line: lineNumber,
				message: `Duplicate color ${colorKey} (first defined on line ${existingColorLine}).`,
			})
		} else {
			colorFirstSeenAtLine.set(colorKey, lineNumber)
		}
	}

	return issues
}

const runCli = () => {
	const csvPath = process.argv[2]
		? path.resolve(process.cwd(), process.argv[2])
		: path.resolve(process.cwd(), 'output/definition.csv')

	console.log(`Checking province id/color uniqueness in ${csvPath}`)
	const csvContent = fs.existsSync(csvPath)
		? fs.readFileSync(csvPath, 'utf8')
		: ''
	const issues = checkDefinitionIds(csvContent)

	if (issues.length === 0) {
		console.log('No duplicate province ids or colors found.')
		return
	}

	console.error(`Found ${issues.length} definition issue(s):`)
	for (const issue of issues) {
		console.error(
			`${path.relative(process.cwd(), csvPath)}:${issue.line} - ${issue.message}`,
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
