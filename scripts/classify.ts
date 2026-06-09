import Anthropic from '@anthropic-ai/sdk'

const PUBLICATION_TEXT = `
Media Releases
APRA finalises new IRB accreditation pathway for banks
Thursday 4 June 2026

The Australian Prudential Regulation Authority (APRA) has finalised a new, more accessible pathway for banks to become accredited to use the internal ratings-based (IRB) approach to calculate credit risk-weighted assets.

The new pathway has the potential to boost competition while still supporting financial safety by incentivising banks to invest in advanced risk management capabilities. The IRB approach allows banks to better match capital to their actual risk, which can reduce their capital requirements and enable more competitive pricing.

The IRB method is one of two approaches banks can use to calculate risk-weighted assets, which determines the amount of regulatory capital they need to hold for credit risk. While the vast majority of banks use the standardised approach, APRA has approved six of the largest banks to use the IRB approach.

In a letter to industry published today, APRA confirmed its intention to proceed with plans to make IRB accreditation more attainable for medium-sized banks by making the process more flexible and transparent.

The changes deliver on APRA's commitment to review and streamline the IRB accreditation process in response to Action 2 of the Council of Financial Regulators' Review of Small and Medium-sized Banks.

Footnotes: Banks accredited to use the IRB approach are the four major banks, Macquarie Bank and ING Bank Australia.
`.trim()

const FIRMS = [
  {
    name: 'Commonwealth Bank',
    profile: {
      size: 'Very large — one of Australia\'s four major banks',
      creditRiskApproach: 'IRB (internal ratings-based) — already accredited',
      riskCapability: 'Full advanced risk management capability',
      relevantContext: 'Already holds IRB accreditation; this pathway is for banks seeking accreditation, not those already holding it',
    },
  },
  {
    name: 'Bendigo and Adelaide Bank',
    profile: {
      size: 'Mid-size Australian ADI',
      creditRiskApproach: 'Standardised approach — not currently IRB-accredited',
      riskCapability: 'Standard risk management capability',
      relevantContext: 'Growth-focused; a more accessible IRB pathway directly opens a route to reduced capital requirements and more competitive pricing',
    },
  },
]

const SYSTEM_PROMPT = `You are a regulatory materiality classifier for Australian financial institutions.

Your task: given a regulatory publication and a firm profile, score how MATERIAL the publication is to that specific firm on a scale of 0–100.

Materiality means: does this publication actually affect this firm's obligations, risk, capital, operations, or competitive position? A publication can be major industry news but score low if it does not affect this particular firm, and vice versa.

Critical rule — substrate-bounded reasoning: reason ONLY from the publication text and firm profile provided. Do not invent facts about the firm or the regulation. Do not use outside knowledge to fill gaps. If the publication does not contain enough information to judge materiality for this firm, score low and say so in the rationale.

Respond with ONLY a JSON object in exactly this shape, no preamble, no markdown fences:
{ "materiality_score": <integer 0-100>, "rationale": "<one sentence>" }`

interface ClassifierResult {
  materiality_score: number
  rationale: string
}

async function classify(firmName: string, firmProfile: object): Promise<ClassifierResult> {
  const client = new Anthropic()

  const userMessage = `PUBLICATION:\n${PUBLICATION_TEXT}\n\nFIRM PROFILE:\nFirm name: ${firmName}\n${JSON.stringify(firmProfile, null, 2)}`

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

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('Error: ANTHROPIC_API_KEY environment variable is not set.')
    process.exit(1)
  }

  for (const firm of FIRMS) {
    console.log(`\n--- ${firm.name} ---`)
    try {
      const result = await classify(firm.name, firm.profile)
      console.log(`Score:     ${result.materiality_score}/100`)
      console.log(`Rationale: ${result.rationale}`)
    } catch (err) {
      console.error(`Error classifying ${firm.name}:`, err)
    }
  }
}

main()
