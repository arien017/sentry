import { redirect } from 'next/navigation'

// /home lands on the default view. The auth gate now lives in app/home/layout.tsx.
// NOTE: /home/today does not exist until commit 2, so this 404s for now (expected).
export default function HomePage() {
  redirect('/home/today')
}
