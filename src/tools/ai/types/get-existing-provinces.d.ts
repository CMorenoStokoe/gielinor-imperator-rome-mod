export type ExistingProvinceDefinition = {
	id: number
	name: string
	color: string
}

export type ExistingProvinces = {
	byColorKey: Map<string, ExistingProvinceDefinition>
	maxId: number
}
