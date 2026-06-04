import * as fs from 'node:fs/promises'
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

type ExtractedRegion = {
	color: RgbaColor
	colorKey: string
	pixelCount: number
	bounds: RegionBounds
	pixels: PixelCoordinate[]
}

type ExtractedImageRegions = {
	width: number
	height: number
	data: Buffer
	regions: ExtractedRegion[]
	bitDepth: number
	colorType: number
	hasAnyTransparency: boolean
}

type LoadedPngImage = {
	width: number
	height: number
	data: Buffer
	bitDepth: number
	colorType: number
}

const makeColorKey = (r: number, g: number, b: number, a: number) =>
	`${r},${g},${b},${a}`

const getPixelOffset = (x: number, y: number, width: number) =>
	(y * width + x) * 4

const colorAt = (
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

const matchesColor = (
	data: Buffer,
	x: number,
	y: number,
	width: number,
	target: RgbaColor,
) => {
	const offset = getPixelOffset(x, y, width)

	return (
		data[offset] === target.r &&
		data[offset + 1] === target.g &&
		data[offset + 2] === target.b &&
		data[offset + 3] === target.a
	)
}

const readPngHeader = (buffer: Buffer) => ({
	// PNG IHDR chunk: signature(8) + length(4) + type(4) + width(4) + height(4) + bitDepth(1) + colorType(1)
	bitDepth: buffer[24],
	colorType: buffer[25],
})

const loadPngImage = async (pngFilePath: string): Promise<LoadedPngImage> => {
	const buffer = await fs.readFile(pngFilePath)
	const image = PNG.sync.read(buffer)
	const { bitDepth, colorType } = readPngHeader(buffer)

	return {
		width: image.width,
		height: image.height,
		data: image.data,
		bitDepth,
		colorType,
	}
}

const extractImageRegionsFromLoadedImage = (
	image: LoadedPngImage,
): ExtractedImageRegions => {
	const { width, height, data } = image

	const visited = new Uint8Array(width * height)
	const regions: ExtractedRegion[] = []
	const queue: PixelCoordinate[] = []

	for (let y = 0; y < height; y += 1) {
		for (let x = 0; x < width; x += 1) {
			const startIndex = y * width + x
			if (visited[startIndex] === 1) {
				continue
			}

			const regionColor = colorAt(data, x, y, width)
			const pixels: PixelCoordinate[] = []
			let minX = x
			let minY = y
			let maxX = x
			let maxY = y

			queue.length = 0
			queue.push({ x, y })
			visited[startIndex] = 1

			while (queue.length > 0) {
				const current = queue.pop()!
				pixels.push(current)

				if (current.x < minX) minX = current.x
				if (current.y < minY) minY = current.y
				if (current.x > maxX) maxX = current.x
				if (current.y > maxY) maxY = current.y

				const neighbors: PixelCoordinate[] = [
					{ x: current.x - 1, y: current.y },
					{ x: current.x + 1, y: current.y },
					{ x: current.x, y: current.y - 1 },
					{ x: current.x, y: current.y + 1 },
				]

				for (const neighbor of neighbors) {
					if (
						neighbor.x < 0 ||
						neighbor.y < 0 ||
						neighbor.x >= width ||
						neighbor.y >= height
					) {
						continue
					}

					const neighborIndex = neighbor.y * width + neighbor.x
					if (visited[neighborIndex] === 1) {
						continue
					}

					if (
						!matchesColor(
							data,
							neighbor.x,
							neighbor.y,
							width,
							regionColor,
						)
					) {
						continue
					}

					visited[neighborIndex] = 1
					queue.push(neighbor)
				}
			}

			regions.push({
				color: regionColor,
				colorKey: makeColorKey(
					regionColor.r,
					regionColor.g,
					regionColor.b,
					regionColor.a,
				),
				pixelCount: pixels.length,
				bounds: {
					minX,
					minY,
					maxX,
					maxY,
				},
				pixels,
			})
		}
	}

	return {
		width,
		height,
		data,
		regions,
		bitDepth: image.bitDepth,
		colorType: image.colorType,
		hasAnyTransparency: data.some(
			(value, index) => index % 4 === 3 && value !== 255,
		),
	}
}

export const extractImageRegions = async (
	pngFilePath: string,
): Promise<ExtractedImageRegions> => {
	const image = await loadPngImage(pngFilePath)
	return extractImageRegionsFromLoadedImage(image)
}
