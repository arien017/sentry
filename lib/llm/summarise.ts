import Anthropic from '@anthropic-ai/sdk'

const SYSTEM_PROMPT = `You write factual summaries of regulatory publications in the "witness register" voice. Follow these rules without exception:

1. REPORT, DON'T INTERPRET. State what the regulator published. Do not characterise its importance, significance, or implications. Write what happened — not what it means or how significant it is.

2. MATCH THE REGULATOR'S LANGUAGE. Use the publication's exact terms. Do not paraphrase technical or legal language into looser words. Compliance readers expect precise terms.

3. REFUSE FILLER. No "important," "significant," "exciting," "introducing," "the future of," "transform," or similar editorialising words. No exclamation marks. No emoji. Never call regulatory content "easy" or "simple." Every sentence must carry information.

4. SUBSTRATE-BOUNDED. State only what the publication actually says. Do not add facts not in the document, do not infer beyond it, do not use outside knowledge. If the document does not say it, the summary does not say it.

Output format — produce exactly this, nothing else:

SUMMARY:
<three sentences of summary prose that state what was published, in the witness register voice>

CITATION:
Source: <URL from the publication, or "not stated" if absent>
Date: <publication date from the document>`

export async function summarisePublication(publication: {
  title: string
  text: string
  url?: string
  published_at?: string
}): Promise<string> {
  const client = new Anthropic()

  const content = `Title: ${publication.title}\n\n${publication.text}${publication.url ? `\n\nSource URL: ${publication.url}` : ''}${publication.published_at ? `\nPublication date: ${publication.published_at}` : ''}`

  const response = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 512,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Summarise the following regulatory publication:\n\n${content}`,
      },
    ],
  })

  return response.content[0].type === 'text' ? response.content[0].text : ''
}
