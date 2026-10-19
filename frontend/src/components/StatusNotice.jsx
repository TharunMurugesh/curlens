import React from 'react';

export default function StatusNotice({ type = 'info', message, details, onRetry, className = '' }) {
  if (!message) return null;

  const typeStyles = {
    info: {
      bg: '#eff6ff',
      border: '#bfdbfe',
      text: '#1e40af',
      icon: 'ℹ️',
    },
    warning: {
      bg: '#fffbeb',
      border: '#fde68a',
      text: '#92400e',
      icon: '⚠️',
    },
    error: {
      bg: '#fef2f2',
      border: '#fecaca',
      text: '#991b1b',
      icon: '❌',
    },
    stale: {
      bg: '#fff7ed',
      border: '#fed7aa',
      text: '#9a3412',
      icon: '🕒',
    },
    success: {
      bg: '#f0fdf4',
      border: '#bbf7d0',
      text: '#166534',
      icon: '✅',
    },
  };

  const style = typeStyles[type] || typeStyles.info;

  return (
    <div
      className={`status-notice ${className}`}
      style={{
        backgroundColor: style.bg,
        border: `1px solid ${style.border}`,
        color: style.text,
        padding: '0.75rem 1rem',
        borderRadius: '8px',
        marginBottom: '1rem',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: '0.75rem',
        fontSize: '0.875rem',
      }}
      role="alert"
    >
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
        <span style={{ fontSize: '1rem', lineHeight: '1.2' }}>{style.icon}</span>
        <div>
          <div style={{ fontWeight: 600 }}>{message}</div>
          {details && <div style={{ fontSize: '0.8125rem', marginTop: '0.25rem', opacity: 0.9 }}>{details}</div>}
        </div>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            background: 'transparent',
            border: `1px solid ${style.text}`,
            color: style.text,
            padding: '0.25rem 0.5rem',
            borderRadius: '4px',
            fontSize: '0.75rem',
            cursor: 'pointer',
            fontWeight: 600,
            whiteSpace: 'nowrap',
          }}
        >
          Retry
        </button>
      )}
    </div>
  );
}

