import React, { useState, useRef, useEffect } from 'react';

interface ChatMessage {
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
}

interface ChatPanelProps {
  messages: ChatMessage[];
  mySessionId: string;
  onSend: (text: string) => void;
}

export function ChatPanel({ messages, mySessionId, onSend }: ChatPanelProps) {
  const [input, setInput] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages.length]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    onSend(text);
    setInput('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, borderRadius: '8px', background: 'var(--surface-panel)', border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
      <div style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border-subtle)', fontWeight: 600, fontSize: '0.8125rem', color: 'var(--text-secondary)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
        Chat
      </div>
      <div ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: '0.5rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
        {messages.length === 0 && (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', textAlign: 'center', marginTop: '2rem' }}>
            No messages yet
          </div>
        )}
        {messages.map((msg, i) => {
          const isMine = msg.senderId === mySessionId;
          const time = new Date(msg.timestamp);
          const timeStr = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          return (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '0.125rem' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.375rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: isMine ? 'var(--accent-warm)' : 'var(--text-secondary)' }}>
                  {msg.senderName}
                </span>
                <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>
                  {timeStr}
                </span>
              </div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-primary)', paddingLeft: '0.25rem' }}>
                {msg.text}
              </div>
            </div>
          );
        })}
      </div>
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '0.5rem', padding: '0.5rem 0.75rem', borderTop: '1px solid var(--border-subtle)' }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          maxLength={200}
          style={{
            flex: 1,
            background: 'var(--surface-panel-raised)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '6px',
            padding: '0.5rem 0.75rem',
            fontSize: '0.8125rem',
            color: 'var(--text-primary)',
            outline: 'none',
          }}
        />
        <button
          type="submit"
          style={{
            background: 'var(--accent-warm)',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            padding: '0.5rem 1rem',
            fontSize: '0.8125rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Send
        </button>
      </form>
    </div>
  );
}
