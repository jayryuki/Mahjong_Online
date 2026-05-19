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
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-start',
      flexShrink: 0,
    }}>
      {/* Popup panel - opens upward */}
      {isOpen && (
        <div style={{
          position: 'absolute',
          bottom: '100%',
          right: 0,
          marginBottom: 4,
          width: Math.min(280, window.innerWidth - 24),
          background: 'var(--surface-panel)',
          border: '1px solid var(--border-subtle)',
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
                color: 'var(--text-muted)',
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
                    color: 'var(--text-muted)',
                    fontWeight: 600,
                  }}>
                    {msg.senderName}
                  </span>
                  <span style={{
                    fontSize: `${0.8125 * scale}rem`,
                    color: 'var(--text-primary)',
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
            borderTop: '1px solid var(--border-subtle)',
          }}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message..."
              maxLength={200}
              style={{
                flex: 1,
                background: 'var(--surface-panel-raised)',
                border: 'none',
                color: 'var(--text-primary)',
                fontSize: `${0.8125 * scale}rem`,
                padding: '8px 10px',
                outline: 'none',
              }}
            />
            <button
              type="submit"
              style={{
                background: 'var(--accent-warm)',
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
        onClick={() => setIsOpen(!isOpen)}
        style={{
          background: hasUnread ? 'var(--accent-warm)' : 'rgba(0,0,0,0.15)',
          color: hasUnread ? '#fff' : 'var(--text-secondary)',
          border: hasUnread ? '1px solid var(--accent-warm)' : '1px solid var(--border-subtle)',
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
            color: 'var(--accent-warm)',
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
