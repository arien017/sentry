import { summarisePublication } from '../lib/llm/summarise'

const PUBLICATION = {
  title: 'APRA finalises new IRB accreditation pathway for banks',
  text: `The Australian Prudential Regulation Authority (APRA) has finalised a new, more accessible pathway for banks to become accredited to use the internal ratings-based (IRB) approach to calculate credit risk-weighted assets.

The new pathway has the potential to boost competition while still supporting financial safety by incentivising banks to invest in advanced risk management capabilities. The IRB approach allows banks to better match capital to their actual risk, which can reduce their capital requirements and enable more competitive pricing.

The IRB method is one of two approaches banks can use to calculate risk-weighted assets, which determines the amount of regulatory capital they need to hold for credit risk. While the vast majority of banks use the standardised approach, APRA has approved six of the largest banks to use the IRB approach.

In a letter to industry published today, APRA confirmed its intention to proceed with plans to make IRB accreditation more attainable for medium-sized banks by making the process more flexible and transparent.

The changes deliver on APRA's commitment to review and streamline the IRB accreditation process in response to Action 2 of the Council of Financial Regulators' Review of Small and Medium-sized Banks.

Footnotes: Banks accredited to use the IRB approach are the four major banks, Macquarie Bank and ING Bank Australia.`,
  url: 'https://www.apra.gov.au/news-and-publications/apra-finalises-new-irb-accreditation-pathway-for-banks',
  published_at: 'Thursday 4 June 2026',
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('Error: ANTHROPIC_API_KEY environment variable is not set.')
    process.exit(1)
  }

  const output = await summarisePublication(PUBLICATION)
  console.log('\n' + output)
}

main().catch((err) => {
  console.error('Error:', err)
  process.exit(1)
})
