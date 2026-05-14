import React, { useState, useRef, useEffect } from 'react';

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

  const unreadCount = isOpen ? 0 : messages.length;

  return (
    <div style={{
      position: 'absolute',
      right: 8,
      top: 48,
      zIndex: 40,
      display: 'flex',
      flexDirection: 'column',
      width: isOpen ? 260 : undefined,
      maxHeight: 'calc(100% - 60px)',
    }}>
      {/* Toggle button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          alignSelf: 'flex-end',
          background: 'rgba(0,0,0,0.55)',
          color: '#fff',
          border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: 8,
          padding: '4px 10px',
          fontSize: '0.75rem',
          fontWeight: 600,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          backdropFilter: 'blur(6px)',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        Chat
        {unreadCount > 0 && (
          <span style={{
            background: 'var(--accent-warm, #B85C3A)',
            color: '#fff',
            borderRadius: '50%',
            width: 16,
            height: 16,
            fontSize: '0.5625rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Chat panel */}
      {isOpen && (
        <div style={{
          marginTop: 4,
          background: 'rgba(0,0,0,0.6)',
          border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: 10,
          display: 'flex',
          flexDirection: 'column',
          maxHeight: 320,
          backdropFilter: 'blur(8px)',
          overflow: 'hidden',
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
              maxHeight: 240,
            }}
          >
            {messages.length === 0 && (
              <span style={{
                color: 'rgba(255,255,255,0.4)',
                fontSize: '0.6875rem',
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
                  <span
                    style={{
                      fontSize: '0.5625rem',
                      color: 'rgba(255,255,255,0.5)',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      WebkitTextStroke: '0.3px rgba(0,0,0,0.8)',
                      paintOrder: 'stroke fill',
                    }}
                  >
                    {msg.senderName}
                  </span>
                  <span
                    style={{
                      fontSize: '0.8125rem',
                      color: '#fff',
                      lineHeight: 1.3,
                      wordBreak: 'break-word',
                      WebkitTextStroke: '0.8px rgba(0,0,0,0.9)',
                      paintOrder: 'stroke fill',
                      textShadow: '-1px -1px 0 rgba(0,0,0,0.7), 1px -1px 0 rgba(0,0,0,0.7), -1px 1px 0 rgba(0,0,0,0.7), 1px 1px 0 rgba(0,0,0,0.7), 0 0 4px rgba(0,0,0,0.5)',
                    }}
                  >
                    {msg.text}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Input */}
          <form onSubmit={handleSubmit} style={{
            display: 'flex',
            borderTop: '1px solid rgba(255,255,255,0.1)',
          }}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message..."
              maxLength={200}
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                color: '#fff',
                fontSize: '0.8125rem',
                padding: '8px 10px',
                outline: 'none',
              }}
            />
            <button
              type="submit"
              style={{
                background: 'var(--accent-warm, #B85C3A)',
                color: '#fff',
                border: 'none',
                borderRadius: '0 0 9px 0',
                padding: '8px 12px',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Send
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
