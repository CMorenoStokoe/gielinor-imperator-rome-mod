export type RgbaColor = {
	r: number
	g: number
	b: number
	a: number
}

export type PixelCoordinate = {
	x: number
	y: number
}

export type RegionBounds = {
	minX: number
	minY: number
	maxX: number
	maxY: number
}

export type ExtractedRegion = {
	color: RgbaColor
	colorKey: string
	pixelCount: number
	bounds: RegionBounds
	pixels: PixelCoordinate[]
}

export type ExtractedImageRegions = {
	width: number
	height: number
	data: Buffer
	regions: ExtractedRegion[]
	bitDepth: number
	colorType: number
	hasAnyTransparency: boolean
}

export type LoadedPngImage = {
	width: number
	height: number
	data: Buffer
	bitDepth: number
	colorType: number
}
