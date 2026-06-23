import { ChatView } from '@/components/home/ChatView'

// Server page for the Chat view. Inside the auth-gated /home layout, so it does not
// re-gate. It supplies this view's centre+right island (the layout owns only rail +
// children). It fetches NO briefings — the /api/chat endpoint owns the substrate
// server-side per request; the client only sends messages and reads the stream.
export default function ChatPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <header style={{ padding: '20px 24px', borderBottom: '1px solid var(--hairline)' }}>
        <h1 className="t-title" style={{ margin: 0 }}>
          Chat
        </h1>
      </header>
      <div style={{ flex: 1, minHeight: 0 }}>
        <ChatView />
      </div>
    </div>
  )
}
