import { serve } from 'inngest/next'
import { inngest } from '@/lib/inngest/client'
import {
  pollTgaFeed,
  pollApraListing,
  classifyNewPublication,
  createBriefing,
} from '@/lib/inngest/functions'

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [pollTgaFeed, pollApraListing, classifyNewPublication, createBriefing],
})
