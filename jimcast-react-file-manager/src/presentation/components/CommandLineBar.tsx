// [plugins] jimcast-react-file-manager/src/presentation/components/CommandLineBar.tsx

import { useEffect, useRef, type CSSProperties, type KeyboardEvent } from 'react'
import type { UseCommandLineResult } from '@jimcast/react-sdk/react'
import type { ThemeContext } from '@jimcast/protocol'

export function CommandLineBar({ cl, theme }: { cl: UseCommandLineResult; theme: ThemeContext }) {
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => { if (cl.isOpen) inputRef.current?.focus() }, [cl.isOpen, cl.pendingConfirm])

  if (!cl.isOpen && !cl.feedback && !cl.busy) return null

  const colors = theme.colors as unknown as Record<string, string>
  const bar: CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px',
    background: colors.bg3, borderTop: `1px solid ${colors.bg4}`, fontFamily: 'inherit', fontSize: 13,
  }
  const input: CSSProperties = {
    flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'inherit', font: 'inherit',
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); cl.submit() }
    else if (e.key === 'Escape') { e.preventDefault(); cl.close() }   // preventDefault => not forwarded to host
    else if (e.key === 'ArrowUp') { e.preventDefault(); cl.historyUp() }
    else if (e.key === 'ArrowDown') { e.preventDefault(); cl.historyDown() }
  }

  if (cl.isOpen) {
    return (
      <div style={bar}>
        <span>{cl.pendingConfirm ? `${cl.pendingConfirm.message} (y/n)` : ':'}</span>
        <input
          ref={inputRef} style={input} value={cl.value}
          onChange={(e) => cl.setValue(e.target.value)} onKeyDown={onKeyDown}
          spellCheck={false} autoComplete="off"
        />
      </div>
    )
  }
  const text = cl.busy ?? cl.feedback?.text ?? ''
  const isError = !cl.busy && cl.feedback?.type === 'error'
  return <div style={{ ...bar, color: isError ? (colors.error ?? '#e06c75') : 'inherit', whiteSpace: 'pre-wrap' }}>{text}</div>
}
