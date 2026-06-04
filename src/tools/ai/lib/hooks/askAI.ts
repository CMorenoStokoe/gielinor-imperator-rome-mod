import 'dotenv/config'
import { createAgent } from 'langchain'

type Attachment = {
	name: string
	content: string
}

const agent = createAgent({ model: 'openai:gpt-4o-mini' })

export const askAI = async (
	systemPrompt: string,
	userPrompt: string,
	attachments: Attachment[] = [],
) => {
	const userContent =
		attachments.length === 0
			? userPrompt
			: [
					{ type: 'text', text: userPrompt },
					...attachments.map((attachment) => ({
						type: 'image_url',
						image_url: {
							url: attachment.content.startsWith('data:')
								? attachment.content
								: `data:image/png;base64,${attachment.content}`,
						},
					})),
				]

	return agent.invoke({
		messages: [
			{ role: 'system', content: systemPrompt },
			{ role: 'user', content: userContent as any },
		],
	})
}
