import fs from 'fs'
import { askAI } from './lib/hooks/askAI'
import { extractImageRegions } from './lib/image/extract'
import { parseImageProvinces } from './lib/image/parse-provinces'

runProcess()
async function runProcess() {
	// Extract file data
	const extractedImageData = await extractImageRegions('input/provinces.png')
	console.log(extractedImageData)

	// Parse provinces within
	const parsedProvinces = await parseImageProvinces(extractedImageData)
	console.log('Parsed provinces from png:', parsedProvinces.provinces.length)

	// Save previews for inspection
	fs.mkdirSync('output/previews', { recursive: true })
	for (const province of parsedProvinces.provinces) {
		fs.writeFileSync(
			`output/previews/province-${province.id}.png`,
			Buffer.from(province.previewPngBase64, 'base64'),
		)
	}

	// Send to AI to define names
	const definitions: {
		id: number
		name: string
		color: string
		data: (typeof parsedProvinces.provinces)[number]
	}[] = []
	for (const province of parsedProvinces.provinces) {
		const name = (
			await askAI(
				'You label locations in the fantasy world of Gielinor from the MMORPG RuneScape. Identify the specific location or landmark highlighted in color on this map. Names must be unique and not repeated. Prioritise large city names when you are certain this is the centre of the city (e.g., Lumbridge, Varrok, Falador). Return ONLY the name without any other text or formatting.',
				`Name this location. Already used names are: ${definitions.map((d) => d.name).join(', ')}.`,
				[
					{
						name: `province-${province.id}.png`,
						content: province.previewPngBase64,
					},
				],
			)
		)?.messages?.[2]?.content // Response
		definitions.push({
			id: province.id,
			name: name as string,
			color: `${province.color.r};${province.color.g};${province.color.b}`,
			data: province,
		})
		console.log('Named province', province.id, name)
	}

	// Compose output files
	const definitionsCsv = `#Province id 0 is ignored, hard coded.
0;0;0;0;;x;;;;;;;;;;;;;;;;;,\n`.concat(
		definitions.map((d) => `${d.id};${d.color};${d.name};`).join(',\n'),
	)

	// Write output files (overwrite if exists)
	fs.writeFileSync('output/definition.csv', definitionsCsv)
}
