import React, { useState, useRef, useEffect } from 'react';
import { useScale } from '../../hooks/useScale.js';

export interface ChatMessageData {
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
}

interface ChatPanelProps {
  messages: ChatMessageData[];
  mySessionId: string;
  onSend: (text: string) => void;
}

export function ChatPanel({ messages, mySessionId, onSend }: ChatPanelProps) {
  const [input, setInput] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const scale = useScale();
  const chatThemeVars = {
    '--mj-chat-surface': 'var(--mj-table-panel, var(--surface-panel))',
    '--mj-chat-surface-raised': 'var(--mj-table-panel-strong, var(--surface-panel-raised))',
    '--mj-chat-border': 'var(--mj-table-border, var(--border-subtle))',
    '--mj-chat-text': 'var(--mj-table-text, var(--text-primary))',
    '--mj-chat-muted': 'var(--mj-table-muted, var(--text-secondary))',
    '--mj-chat-accent': 'var(--accent-warm)',
  } as React.CSSProperties;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    onSend(text);
    setInput('');
  };

  const hasUnread = !isOpen && messages.length > 0;

  return (
    <div style={{
      ...chatThemeVars,
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-start',
      flexShrink: 0,
      color: 'var(--mj-chat-text)',
      textShadow: 'none',
    }}>
      {/* Popup panel - opens upward */}
      {isOpen && (
        <div className="mj-table-chat" style={{
          position: 'absolute',
          bottom: '100%',
          right: 0,
          marginBottom: 4,
          width: Math.min(280, window.innerWidth - 24),
          background: 'var(--mj-chat-surface)',
          border: '1px solid var(--mj-chat-border)',
          borderRadius: 10,
          display: 'flex',
          flexDirection: 'column',
          maxHeight: 280,
          overflow: 'hidden',
          zIndex: 50,
          boxShadow: '0 -4px 20px rgba(0,0,0,0.3)',
        }}>
          {/* Messages */}
          <div
            ref={scrollRef}
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '8px 8px 4px',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              maxHeight: 200,
            }}
          >
            {messages.length === 0 && (
              <span style={{
                color: 'var(--mj-chat-muted)',
                fontSize: `${0.8125 * scale}rem`,
                textAlign: 'center',
                padding: '1rem 0',
              }}>
                No messages yet
              </span>
            )}
            {messages.map((msg, i) => {
              const isMe = msg.senderId === mySessionId;
              return (
                <div key={i} style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1,
                  alignItems: isMe ? 'flex-end' : 'flex-start',
                }}>
                  <span style={{
                    fontSize: `${0.6875 * scale}rem`,
                    color: isMe ? 'var(--mj-chat-accent)' : 'var(--mj-chat-muted)',
                    fontWeight: 600,
                  }}>
                    {msg.senderName}
                  </span>
                  <span style={{
                    fontSize: `${0.8125 * scale}rem`,
                    color: 'var(--mj-chat-text)',
                    lineHeight: 1.3,
                    wordBreak: 'break-word',
                  }}>
                    {msg.text}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Input */}
          <form onSubmit={handleSubmit} style={{
            display: 'flex',
            borderTop: '1px solid var(--mj-chat-border)',
          }}>
            <input
              className="mj-table-chat__input"
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message..."
              maxLength={200}
              style={{
                flex: 1,
                background: 'var(--mj-chat-surface-raised)',
                border: 'none',
                color: 'var(--mj-chat-text)',
                fontSize: `${0.8125 * scale}rem`,
                padding: '8px 10px',
                outline: 'none',
              }}
            />
            <button
              type="submit"
              style={{
                background: 'var(--mj-chat-accent)',
                color: '#fff',
                border: 'none',
                borderRadius: '0 0 9px 0',
                padding: '8px 12px',
                fontSize: `${0.75 * scale}rem`,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Send
            </button>
          </form>
        </div>
      )}

      {/* Toggle button */}
      <button
        className="mj-table-chat"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          background: hasUnread ? 'var(--mj-chat-accent)' : 'color-mix(in srgb, var(--mj-chat-surface) 88%, transparent)',
          color: hasUnread ? '#fff' : 'var(--mj-chat-muted)',
          border: hasUnread ? '1px solid var(--mj-chat-accent)' : '1px solid var(--mj-chat-border)',
          borderRadius: 8,
          padding: `${4 * scale}px ${10 * scale}px`,
          fontSize: `${0.8125 * scale}rem`,
          fontWeight: 600,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          ...(hasUnread ? { boxShadow: '0 0 10px 2px rgba(184, 92, 58, 0.5)', animation: 'chatGlow 2s ease-in-out infinite' } : {}),
        }}
      >
        <svg width={14 * scale} height={14 * scale} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        Chat
        {hasUnread && (
          <span style={{
            background: '#fff',
            color: 'var(--mj-chat-accent)',
            borderRadius: '50%',
            width: 18,
            height: 18,
            fontSize: '0.5625rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
          }}>
            {messages.length > 9 ? '9+' : messages.length}
          </span>
        )}
      </button>
    </div>
  );
}
