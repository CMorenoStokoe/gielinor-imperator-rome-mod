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

export type Province = {
	id: number
	color: RgbaColor
	colorKey: string
	pixelCount: number
	bounds: RegionBounds
	pixels: PixelCoordinate[]
	previewPngBase64: string
}

export type ParsedProvinceMap = {
	width: number
	height: number
	provinces: Province[]
}

export type ParseImageProvincesOptions = {
	/** Color keys to skip preview rendering for (already known, so no AI naming needed). */
	skipPreviewForColorKeys?: Set<string>
}
