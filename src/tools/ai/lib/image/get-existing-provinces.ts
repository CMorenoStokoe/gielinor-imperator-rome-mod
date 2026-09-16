import * as fs from 'node:fs'
import type {
	ExistingProvinceDefinition,
	ExistingProvinces,
} from '../../types/get-existing-provinces'

// Colors already present in definition.csv keep their id/name; only new colors are sent to the AI.
export const parseExistingDefinitions = (
	csvContent: string,
): ExistingProvinces => {
	const byColorKey = new Map<string, ExistingProvinceDefinition>()
	let maxId = 0

	for (const rawLine of csvContent.split('\n')) {
		const line = rawLine.trim().replace(/,$/, '')
		if (!line || line.startsWith('#')) {
			continue
		}

		const [idPart, r, g, b, name] = line.split(';')
		const id = Number(idPart)
		if (!Number.isFinite(id) || id === 0) {
			continue
		}

		byColorKey.set(`${r};${g};${b}`, {
			id,
			name: name ?? '',
			color: `${r};${g};${b}`,
		})
		maxId = Math.max(maxId, id)
	}

	return { byColorKey, maxId }
}

export const getExistingProvinces = (
	definitionCsvPath: string,
): ExistingProvinces => {
	const csvContent = fs.existsSync(definitionCsvPath)
		? fs.readFileSync(definitionCsvPath, 'utf8')
		: ''

	return parseExistingDefinitions(csvContent)
}
