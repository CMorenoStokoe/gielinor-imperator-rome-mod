import fs from 'fs'
import path from 'node:path'
import { askAI } from './lib/hooks/askAI'
import { extractImageRegions } from './lib/image/extract'
import { getExistingProvinces } from './lib/image/get-existing-provinces'
import { parseImageProvinces } from './lib/image/parse-provinces'
import { checkBraces } from './lib/utils/checkBraces'
import { checkLocalization } from './lib/utils/checkLocalization'

const DEFINITION_CSV_PATH = 'output/definition.csv'
const DEFINITION_CSV_HEADER = `#Province id 0 is ignored, hard coded.\n0;0;0;0;;x;;;;;;;;;;;;;;;;;,\n`

runProcess()
async function runProcess() {
	const startedAt = Date.now()

	// Extract file data
	const extractedImageData = await extractImageRegions('input/provinces.png')
	console.log(
		extractedImageData.regions.length,
		'regions extracted from image',
	)

	// Reuse existing definitions so we only pay for AI naming (and preview rendering) on genuinely new colors
	const { byColorKey: existingByColorKey, maxId: existingMaxId } =
		getExistingProvinces(DEFINITION_CSV_PATH)

	// Parse provinces within, skipping preview generation for colors we've already processed
	const parsedProvinces = await parseImageProvinces(extractedImageData, {
		skipPreviewForColorKeys: new Set(existingByColorKey.keys()),
	})
	console.log('Parsed provinces from png:', parsedProvinces.provinces.length)

	// Save previews for inspection (only generated for newly-seen colors)
	fs.mkdirSync('output/previews', { recursive: true })
	let previewsWrittenCount = 0
	for (const province of parsedProvinces.provinces) {
		if (!province.previewPngBase64) {
			continue
		}
		fs.writeFileSync(
			`output/previews/province-${province.id}.png`,
			Buffer.from(province.previewPngBase64, 'base64'),
		)
		previewsWrittenCount += 1
	}

	const usedNames = new Set(
		Array.from(existingByColorKey.values()).map((d) => d.name),
	)

	// Send to AI to define names (skipped for colors we've already named)
	const definitions: {
		id: number
		name: string
		color: string
		data: (typeof parsedProvinces.provinces)[number]
	}[] = []
	let nextId = existingMaxId + 1
	let reusedCount = 0
	let newlyNamedCount = 0
	for (const province of parsedProvinces.provinces) {
		const colorKey = `${province.color.r};${province.color.g};${province.color.b}`
		const existing = existingByColorKey.get(colorKey)

		if (existing) {
			reusedCount += 1
			definitions.push({
				id: existing.id,
				name: existing.name,
				color: colorKey,
				data: province,
			})
			continue
		}

		const name = (
			await askAI(
				'You label locations in the fantasy world of Gielinor from the MMORPG RuneScape. Identify the specific location or landmark highlighted in color on this map. Names must be unique and not repeated. Prioritise large city names when you are certain this is the centre of the city (e.g., Lumbridge, Varrok, Falador). Return ONLY the name without any other text or formatting.',
				`Name this location. Already used names are: ${Array.from(usedNames).join(', ')}.`,
				[
					{
						name: `province-${province.id}.png`,
						content: province.previewPngBase64,
					},
				],
			)
		)?.messages?.[2]?.content // Response
		const provinceName = name as string

		usedNames.add(provinceName)
		definitions.push({
			id: nextId,
			name: provinceName,
			color: colorKey,
			data: province,
		})
		console.log('Named new province', nextId, provinceName)
		newlyNamedCount += 1
		nextId += 1
	}

	// Compose output files
	const definitionsCsv = DEFINITION_CSV_HEADER.concat(
		definitions.map((d) => `${d.id};${d.color};${d.name};`).join(',\n'),
	)

	// Write output files (overwrite if exists)
	fs.writeFileSync(DEFINITION_CSV_PATH, definitionsCsv)

	// Lint script and localization files across the mod before finishing
	console.log('Running lint checks...')
	const braceIssues = checkBraces(path.resolve('../../assets'))
	const localizationIssues = checkLocalization(path.resolve('../..'))

	for (const issue of braceIssues) {
		console.error(
			`${path.relative('.', issue.file)}:${issue.line}:${issue.column} - ${issue.message}`,
		)
	}
	for (const issue of localizationIssues) {
		const location = issue.line ? `:${issue.line}` : ''
		console.error(
			`${path.relative('.', issue.file)}${location} - ${issue.message}`,
		)
	}

	const lintPassed =
		braceIssues.length === 0 && localizationIssues.length === 0
	if (lintPassed) {
		console.log('Lint checks passed.')
	} else {
		console.error(
			`Lint checks failed: ${braceIssues.length} brace issue(s), ${localizationIssues.length} localization issue(s).`,
		)
		process.exitCode = 1
	}

	const durationSeconds = ((Date.now() - startedAt) / 1000).toFixed(1)
	console.log('\n===== Run Summary =====')
	console.log(
		`Status: ${lintPassed ? 'SUCCESS' : 'FAILED'} (${durationSeconds}s)`,
	)
	console.log(`Provinces extracted: ${parsedProvinces.provinces.length}`)
	console.log(`  - Reused existing names (AI skipped): ${reusedCount}`)
	console.log(`  - Newly named via AI: ${newlyNamedCount}`)
	console.log(
		`Preview images written: ${previewsWrittenCount} -> output/previews/ (${reusedCount} skipped, already known)`,
	)
	console.log(
		`Definition file: ${DEFINITION_CSV_PATH} (${definitions.length} total entries)`,
	)
	console.log(
		`Lint: ${braceIssues.length} brace issue(s), ${localizationIssues.length} localization issue(s)`,
	)
	console.log('========================\n')
}
