import { extractImageRegions } from './extract'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

type RgbaColor = {
	r: number
	g: number
	b: number
	a: number
}

export type DisconnectedColorIssue = {
	color: RgbaColor
	colorKey: string
	blobCount: number
}

export type ProvinceImageValidationResult = {
	isValid: boolean
	issues: DisconnectedColorIssue[]
	provinceZero: ProvinceZeroValidationResult
	resolution: ResolutionValidationResult
	antiAliasing: AntiAliasingValidationResult
	smallProvinces: SmallProvinceValidationResult
	maxProvinceSize: MaxProvinceSizeValidationResult
	format: FormatValidationResult
}

export type ProvinceZeroValidationResult = {
	detected: boolean
	detectedPixelCount: number
	removedByParser: boolean
	remainingProvinceCountAfterRemoval: number
}

export type ResolutionValidationResult = {
	isValid: boolean
	width: number
	height: number
	rule: string
	widthValid: boolean
	heightValid: boolean
}

export type AntiAliasedPixelIssue = {
	x: number
	y: number
	color: RgbaColor
	neighborColors: string[]
}

export type AntiAliasingValidationResult = {
	isValid: boolean
	suspiciousPixelCount: number
	samples: AntiAliasedPixelIssue[]
}

export type SmallProvinceIssue = {
	color: RgbaColor
	colorKey: string
	pixelCount: number
}

export type SmallProvinceValidationResult = {
	isValid: boolean
	thresholdPixels: number
	issues: SmallProvinceIssue[]
}

export type LargeProvinceIssue = {
	color: RgbaColor
	colorKey: string
	pixelCount: number
	thresholdPixels: number
	mapCoveragePercent: number
}

export type MaxProvinceSizeValidationResult = {
	isValid: boolean
	thresholdPixels: number
	thresholdSidePixels: number
	issues: LargeProvinceIssue[]
}

export type FormatValidationResult = {
	isValid: boolean
	bitDepth: number
	colorType: number
	hasAnyTransparency: boolean
	issues: string[]
}

export type ProvinceImageValidationOptions = {
	maxProvinceSidePercent?: number
	antiAliasSampleLimit?: number
}

const isDimensionAligned = (value: number) =>
	value > 1 && (value - 1) % 33 === 0

const isPowerOfTwo = (value: number) => value > 0 && (value & (value - 1)) === 0

const isResolutionDimensionValid = (value: number) =>
	isDimensionAligned(value) || isPowerOfTwo(value)

const isPureBlack = (color: RgbaColor) =>
	color.r === 0 && color.g === 0 && color.b === 0

const getPixelOffset = (x: number, y: number, width: number) =>
	(y * width + x) * 4

const readColorKeyAt = (data: Buffer, x: number, y: number, width: number) => {
	const offset = getPixelOffset(x, y, width)
	return `${data[offset]},${data[offset + 1]},${data[offset + 2]},${data[offset + 3]}`
}

const readColorAt = (
	data: Buffer,
	x: number,
	y: number,
	width: number,
): RgbaColor => {
	const offset = getPixelOffset(x, y, width)

	return {
		r: data[offset],
		g: data[offset + 1],
		b: data[offset + 2],
		a: data[offset + 3],
	}
}

export const validateProvinceImageColors = async (
	pngFilePath: string,
	options: ProvinceImageValidationOptions = {},
): Promise<ProvinceImageValidationResult> => {
	const maxProvinceSidePercent = options.maxProvinceSidePercent ?? 0.1
	const antiAliasSampleLimit = options.antiAliasSampleLimit ?? 50
	const smallProvinceThresholdPixels = 20

	const extracted = await extractImageRegions(pngFilePath)
	const colorBlobCounts = new Map<string, number>()
	const colorValues = new Map<string, RgbaColor>()

	for (const region of extracted.regions) {
		colorBlobCounts.set(
			region.colorKey,
			(colorBlobCounts.get(region.colorKey) ?? 0) + 1,
		)

		if (!colorValues.has(region.colorKey)) {
			colorValues.set(region.colorKey, region.color)
		}
	}

	const issues: DisconnectedColorIssue[] = []

	for (const [colorKey, blobCount] of colorBlobCounts.entries()) {
		if (blobCount <= 1) {
			continue
		}

		issues.push({
			color: colorValues.get(colorKey)!,
			colorKey,
			blobCount,
		})
	}

	const blackRegions = extracted.regions.filter((region) =>
		isPureBlack(region.color),
	)

	const provinceZero: ProvinceZeroValidationResult = {
		detected: blackRegions.length > 0,
		detectedPixelCount: blackRegions.reduce(
			(sum, region) => sum + region.pixelCount,
			0,
		),
		removedByParser: blackRegions.length > 0,
		remainingProvinceCountAfterRemoval:
			extracted.regions.length - blackRegions.length,
	}

	const resolution: ResolutionValidationResult = {
		isValid:
			isResolutionDimensionValid(extracted.width) &&
			isResolutionDimensionValid(extracted.height),
		width: extracted.width,
		height: extracted.height,
		rule: 'power-of-two OR (n * 33) + 1',
		widthValid: isResolutionDimensionValid(extracted.width),
		heightValid: isResolutionDimensionValid(extracted.height),
	}

	const thresholdSidePixels = Math.max(
		1,
		Math.floor(
			Math.max(extracted.width, extracted.height) *
				maxProvinceSidePercent,
		),
	)
	const thresholdPixels = thresholdSidePixels * thresholdSidePixels

	const maxProvinceSizeIssues: LargeProvinceIssue[] = []

	for (const region of extracted.regions) {
		if (isPureBlack(region.color)) {
			continue
		}

		if (region.pixelCount < thresholdPixels) {
			continue
		}

		maxProvinceSizeIssues.push({
			color: region.color,
			colorKey: region.colorKey,
			pixelCount: region.pixelCount,
			thresholdPixels,
			mapCoveragePercent:
				(region.pixelCount / (extracted.width * extracted.height)) *
				100,
		})
	}

	const maxProvinceSize: MaxProvinceSizeValidationResult = {
		isValid: maxProvinceSizeIssues.length === 0,
		thresholdPixels,
		thresholdSidePixels,
		issues: maxProvinceSizeIssues,
	}

	const suspiciousAntiAliasedSamples: AntiAliasedPixelIssue[] = []
	let suspiciousPixelCount = 0

	for (let y = 1; y < extracted.height - 1; y += 1) {
		for (let x = 1; x < extracted.width - 1; x += 1) {
			const centerColorKey = readColorKeyAt(
				extracted.data,
				x,
				y,
				extracted.width,
			)
			const neighborColorKeys = [
				readColorKeyAt(extracted.data, x - 1, y, extracted.width),
				readColorKeyAt(extracted.data, x + 1, y, extracted.width),
				readColorKeyAt(extracted.data, x, y - 1, extracted.width),
				readColorKeyAt(extracted.data, x, y + 1, extracted.width),
			]

			const matchingNeighborCount = neighborColorKeys.filter(
				(key) => key === centerColorKey,
			).length

			if (matchingNeighborCount > 0) {
				continue
			}

			const uniqueNeighborColors = Array.from(new Set(neighborColorKeys))
			if (uniqueNeighborColors.length < 2) {
				continue
			}

			suspiciousPixelCount += 1

			if (suspiciousAntiAliasedSamples.length >= antiAliasSampleLimit) {
				continue
			}

			suspiciousAntiAliasedSamples.push({
				x,
				y,
				color: readColorAt(extracted.data, x, y, extracted.width),
				neighborColors: uniqueNeighborColors,
			})
		}
	}

	const antiAliasing: AntiAliasingValidationResult = {
		isValid: suspiciousPixelCount === 0,
		suspiciousPixelCount,
		samples: suspiciousAntiAliasedSamples,
	}

	const smallProvinceIssues: SmallProvinceIssue[] = []

	for (const region of extracted.regions) {
		if (region.pixelCount >= smallProvinceThresholdPixels) {
			continue
		}

		smallProvinceIssues.push({
			color: region.color,
			colorKey: region.colorKey,
			pixelCount: region.pixelCount,
		})
	}

	const smallProvinces: SmallProvinceValidationResult = {
		isValid: smallProvinceIssues.length === 0,
		thresholdPixels: smallProvinceThresholdPixels,
		issues: smallProvinceIssues,
	}

	let hasAnyTransparency = false
	for (let i = 3; i < extracted.data.length; i += 4) {
		if (extracted.data[i] !== 255) {
			hasAnyTransparency = true
			break
		}
	}

	const formatIssues: string[] = []
	const is24BitRgb = extracted.colorType === 2 && extracted.bitDepth === 8
	const is8BitIndexed = extracted.colorType === 3 && extracted.bitDepth === 8

	if (!is24BitRgb && !is8BitIndexed) {
		formatIssues.push(
			`Unsupported PNG encoding: colorType=${extracted.colorType}, bitDepth=${extracted.bitDepth}. Expected 24-bit RGB (type 2, depth 8) or 8-bit indexed (type 3, depth 8).`,
		)
	}

	if (hasAnyTransparency) {
		formatIssues.push(
			'Transparency detected in pixel data (alpha < 255). provinces maps should be fully opaque.',
		)
	}

	const format: FormatValidationResult = {
		isValid: formatIssues.length === 0,
		bitDepth: extracted.bitDepth,
		colorType: extracted.colorType,
		hasAnyTransparency,
		issues: formatIssues,
	}

	return {
		isValid:
			issues.length === 0 &&
			resolution.isValid &&
			antiAliasing.isValid &&
			smallProvinces.isValid &&
			maxProvinceSize.isValid &&
			format.isValid,
		issues,
		provinceZero,
		resolution,
		antiAliasing,
		smallProvinces,
		maxProvinceSize,
		format,
	}
}

const getCliImagePath = () => {
	const userArgPath = process.argv[2]
	if (userArgPath) {
		return path.resolve(process.cwd(), userArgPath)
	}

	return path.resolve(process.cwd(), 'input/provinces.png')
}

const runCli = async () => {
	const imagePath = getCliImagePath()
	const result = await validateProvinceImageColors(imagePath)
	console.log(`Validation results for ${imagePath}`)
	console.dir(result, { depth: null })

	if (!result.isValid) {
		process.exitCode = 1
	}
}

const isDirectRun =
	process.argv[1] !== undefined &&
	fileURLToPath(import.meta.url) === path.resolve(process.argv[1])

if (isDirectRun) {
	runCli().catch((error) => {
		console.error('Validation failed:', error)
		process.exitCode = 1
	})
}
