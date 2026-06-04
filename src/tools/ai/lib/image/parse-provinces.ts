import { extractImageRegions } from './extract'
import * as fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PNG } from 'pngjs'

type RgbaColor = {
	r: number
	g: number
	b: number
	a: number
}

type PixelCoordinate = {
	x: number
	y: number
}

type RegionBounds = {
	minX: number
	minY: number
	maxX: number
	maxY: number
}

type Province = {
	id: number
	color: RgbaColor
	colorKey: string
	pixelCount: number
	bounds: RegionBounds
	pixels: PixelCoordinate[]
	previewPngBase64: string
}

type ParsedProvinceMap = {
	width: number
	height: number
	provinces: Province[]
}

const REFERENCE_MAP_PATH = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	'../../../../assets/reference/gielinor-map.png',
)

const clamp = (value: number, min: number, max: number) =>
	Math.max(min, Math.min(max, value))

const isPureBlack = (color: RgbaColor) =>
	color.r === 0 && color.g === 0 && color.b === 0

const createProvincePreviewPngBase64 = (
	province: {
		color: RgbaColor
		pixels: PixelCoordinate[]
		bounds: RegionBounds
	},
	extractedSize: { width: number; height: number },
	referenceMap: PNG,
) => {
	const scaleX = referenceMap.width / extractedSize.width
	const scaleY = referenceMap.height / extractedSize.height

	const refMinX = clamp(
		Math.floor(province.bounds.minX * scaleX),
		0,
		referenceMap.width - 1,
	)
	const refMinY = clamp(
		Math.floor(province.bounds.minY * scaleY),
		0,
		referenceMap.height - 1,
	)
	const refMaxX = clamp(
		Math.ceil((province.bounds.maxX + 1) * scaleX) - 1,
		0,
		referenceMap.width - 1,
	)
	const refMaxY = clamp(
		Math.ceil((province.bounds.maxY + 1) * scaleY) - 1,
		0,
		referenceMap.height - 1,
	)

	const regionWidth = Math.max(1, refMaxX - refMinX + 1)
	const regionHeight = Math.max(1, refMaxY - refMinY + 1)
	const zoomOutPadding = Math.max(
		16,
		Math.round(Math.max(regionWidth, regionHeight) * 0.2),
	)

	const cropMinX = clamp(refMinX - zoomOutPadding, 0, referenceMap.width - 1)
	const cropMinY = clamp(refMinY - zoomOutPadding, 0, referenceMap.height - 1)
	const cropMaxX = clamp(refMaxX + zoomOutPadding, 0, referenceMap.width - 1)
	const cropMaxY = clamp(refMaxY + zoomOutPadding, 0, referenceMap.height - 1)

	const cropWidth = cropMaxX - cropMinX + 1
	const cropHeight = cropMaxY - cropMinY + 1
	const output = new PNG({ width: cropWidth, height: cropHeight })

	for (let y = 0; y < cropHeight; y += 1) {
		for (let x = 0; x < cropWidth; x += 1) {
			const srcX = cropMinX + x
			const srcY = cropMinY + y
			const srcOffset = (srcY * referenceMap.width + srcX) * 4
			const dstOffset = (y * cropWidth + x) * 4

			output.data[dstOffset] = referenceMap.data[srcOffset]
			output.data[dstOffset + 1] = referenceMap.data[srcOffset + 1]
			output.data[dstOffset + 2] = referenceMap.data[srcOffset + 2]
			output.data[dstOffset + 3] = 255
		}
	}

	for (const pixel of province.pixels) {
		const refX = clamp(
			Math.floor(pixel.x * scaleX),
			0,
			referenceMap.width - 1,
		)
		const refY = clamp(
			Math.floor(pixel.y * scaleY),
			0,
			referenceMap.height - 1,
		)

		if (
			refX < cropMinX ||
			refY < cropMinY ||
			refX > cropMaxX ||
			refY > cropMaxY
		) {
			continue
		}

		const localX = refX - cropMinX
		const localY = refY - cropMinY
		const dstOffset = (localY * cropWidth + localX) * 4

		const baseR = output.data[dstOffset]
		const baseG = output.data[dstOffset + 1]
		const baseB = output.data[dstOffset + 2]

		output.data[dstOffset] = Math.round(
			baseR * 0.5 + province.color.r * 0.5,
		)
		output.data[dstOffset + 1] = Math.round(
			baseG * 0.5 + province.color.g * 0.5,
		)
		output.data[dstOffset + 2] = Math.round(
			baseB * 0.5 + province.color.b * 0.5,
		)
		output.data[dstOffset + 3] = 255
	}

	const pngBuffer = PNG.sync.write(output)
	return pngBuffer.toString('base64')
}

export const parseImageProvinces = async (
	extracted: Awaited<ReturnType<typeof extractImageRegions>>,
): Promise<ParsedProvinceMap> => {
	const referenceMap = PNG.sync.read(fs.readFileSync(REFERENCE_MAP_PATH))
	const provinces: Province[] = []

	let provinceId = 1

	for (const region of extracted.regions) {
		if (isPureBlack(region.color)) {
			continue
		}

		const previewPngBase64 = createProvincePreviewPngBase64(
			region,
			{ width: extracted.width, height: extracted.height },
			referenceMap,
		)

		provinces.push({
			id: provinceId,
			color: region.color,
			colorKey: region.colorKey,
			pixelCount: region.pixelCount,
			bounds: region.bounds,
			pixels: region.pixels,
			previewPngBase64,
		})

		provinceId += 1
	}

	return {
		width: extracted.width,
		height: extracted.height,
		provinces,
	}
}
