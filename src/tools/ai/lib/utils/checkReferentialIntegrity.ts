import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { walkFiles } from './walkFiles'
import { getExistingProvinces } from '../image/get-existing-provinces'
import type { ReferentialIssue } from '../../types/checkReferentialIntegrity'

const TAG_MAPPING_PATTERN = /^([A-Z0-9]{3})\s*=\s*"([^"]+)"/
const HISTORY_COUNTRY_FILE_PATTERN = /^([A-Z0-9]{3}) - .+\.txt$/
const HISTORY_PROVINCE_FILE_PATTERN = /^(\d+) - .+\.txt$/
const CAPITAL_LINE_PATTERN = /^\s*capital\s*=\s*(\d+)/m
const OWNER_LINE_PATTERN =
	/^\s*(?:owner|controller|add_core)\s*=\s*([A-Z0-9]{3})/gm

/**
 * Cross-checks generated country/province files under `outputsRoot` for consistency:
 * every declared tag must have a country definition + history file, every history/provinces
 * file's id and every owner/controller/add_core/capital reference must exist in definition.csv.
 */
export const checkReferentialIntegrity = (
	outputsRoot: string,
	definitionCsvPath: string,
): ReferentialIssue[] => {
	const issues: ReferentialIssue[] = []

	const { byColorKey } = getExistingProvinces(definitionCsvPath)
	const knownProvinceIds = new Set(
		Array.from(byColorKey.values()).map((d) => d.id),
	)

	const countryTagsDir = path.join(outputsRoot, 'common', 'country_tags')
	const countriesDir = path.join(outputsRoot, 'common', 'countries')
	const historyCountriesDir = path.join(outputsRoot, 'history', 'countries')
	const historyProvincesDir = path.join(outputsRoot, 'history', 'provinces')

	const declaredTags = new Map<string, string>()
	for (const file of walkFiles(countryTagsDir, { extensions: ['.txt'] })) {
		const content = fs.readFileSync(file, 'utf8')
		for (const line of content.split('\n')) {
			const match = TAG_MAPPING_PATTERN.exec(line.trim())
			if (match) {
				declaredTags.set(match[1], match[2])
			}
		}
	}

	if (declaredTags.size === 0) {
		issues.push({
			message: `No country tags declared under ${countryTagsDir}.`,
		})
	}

	for (const [tag, countryFilePath] of declaredTags) {
		const countryFile = path.join(
			countriesDir,
			path.basename(countryFilePath),
		)
		if (!fs.existsSync(countryFile)) {
			issues.push({
				message: `Tag ${tag} references missing country file: ${countryFilePath}`,
			})
		}

		const historyFiles = fs.existsSync(historyCountriesDir)
			? fs.readdirSync(historyCountriesDir)
			: []
		const hasHistoryFile = historyFiles.some(
			(name) => HISTORY_COUNTRY_FILE_PATTERN.exec(name)?.[1] === tag,
		)
		if (!hasHistoryFile) {
			issues.push({
				message: `Tag ${tag} has no matching history/countries/${tag} - *.txt file.`,
			})
		}
	}

	if (fs.existsSync(historyCountriesDir)) {
		for (const name of fs.readdirSync(historyCountriesDir)) {
			const match = HISTORY_COUNTRY_FILE_PATTERN.exec(name)
			if (!match) continue
			const tag = match[1]
			if (!declaredTags.has(tag)) {
				issues.push({
					message: `history/countries/${name} uses tag ${tag}, which is not declared in common/country_tags.`,
				})
			}

			const content = fs.readFileSync(
				path.join(historyCountriesDir, name),
				'utf8',
			)
			const capitalMatch = CAPITAL_LINE_PATTERN.exec(content)
			if (capitalMatch) {
				const capitalId = Number(capitalMatch[1])
				if (!knownProvinceIds.has(capitalId)) {
					issues.push({
						message: `history/countries/${name} sets capital = ${capitalId}, which does not exist in definition.csv.`,
					})
				}
			}
		}
	}

	if (fs.existsSync(historyProvincesDir)) {
		for (const name of fs.readdirSync(historyProvincesDir)) {
			const match = HISTORY_PROVINCE_FILE_PATTERN.exec(name)
			if (!match) continue
			const provinceId = Number(match[1])
			if (!knownProvinceIds.has(provinceId)) {
				issues.push({
					message: `history/provinces/${name} refers to province id ${provinceId}, which does not exist in definition.csv.`,
				})
			}

			const content = fs.readFileSync(
				path.join(historyProvincesDir, name),
				'utf8',
			)
			let ownerMatch: RegExpExecArray | null
			OWNER_LINE_PATTERN.lastIndex = 0
			while ((ownerMatch = OWNER_LINE_PATTERN.exec(content))) {
				const tag = ownerMatch[1]
				if (!declaredTags.has(tag)) {
					issues.push({
						message: `history/provinces/${name} references undeclared tag ${tag}.`,
					})
				}
			}
		}
	}

	return issues
}

const runCli = () => {
	const outputsRoot = process.argv[2]
		? path.resolve(process.cwd(), process.argv[2])
		: path.resolve(process.cwd(), '../../../outputs')
	const definitionCsvPath = process.argv[3]
		? path.resolve(process.cwd(), process.argv[3])
		: path.resolve(process.cwd(), 'output/definition.csv')

	console.log(`Checking referential integrity of ${outputsRoot}`)
	const issues = checkReferentialIntegrity(outputsRoot, definitionCsvPath)

	if (issues.length === 0) {
		console.log('No referential integrity issues found.')
		return
	}

	console.error(`Found ${issues.length} referential integrity issue(s):`)
	for (const issue of issues) {
		console.error(`- ${issue.message}`)
	}
	process.exitCode = 1
}

const isDirectRun =
	process.argv[1] !== undefined &&
	fileURLToPath(import.meta.url) === path.resolve(process.argv[1])

if (isDirectRun) {
	runCli()
}
