import Anthropic from '@anthropic-ai/sdk'

const SYSTEM_PROMPT = `You are a regulatory materiality classifier for Australian financial institutions.

Your task: given a regulatory publication and a firm profile, score how MATERIAL the publication is to that specific firm on a scale of 0–100.

Materiality means: does this publication actually affect this firm's obligations, risk, capital, operations, or competitive position? A publication can be major industry news but score low if it does not affect this particular firm, and vice versa.

Critical rule — substrate-bounded reasoning: reason ONLY from the publication text and firm profile provided. Do not invent facts about the firm or the regulation. Do not use outside knowledge to fill gaps. If the publication does not contain enough information to judge materiality for this firm, score low and say so in the rationale.

Respond with ONLY a JSON object in exactly this shape, no preamble, no markdown fences:
{ "materiality_score": <integer 0-100>, "rationale": "<one sentence>" }`

export interface ClassifierResult {
  materiality_score: number
  rationale: string
}

export async function classifyPublication(
  publication: { title: string; text: string },
  firmProfile: { name: string; [key: string]: unknown }
): Promise<ClassifierResult> {
  const client = new Anthropic()

  const userMessage = `PUBLICATION:\nTitle: ${publication.title}\n\n${publication.text}\n\nFIRM PROFILE:\nFirm name: ${firmProfile.name}\n${JSON.stringify(firmProfile, null, 2)}`

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 256,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  })

  const raw = response.content[0].type === 'text' ? response.content[0].text : ''
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()

  try {
    const parsed = JSON.parse(cleaned) as ClassifierResult
    if (typeof parsed.materiality_score !== 'number' || typeof parsed.rationale !== 'string') {
      throw new Error('Unexpected shape: ' + cleaned)
    }
    return parsed
  } catch (err) {
    throw new Error(`Failed to parse classifier response: ${err}\nRaw output: ${raw}`)
  }
}
