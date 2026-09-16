export type RgbaColor = {
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
