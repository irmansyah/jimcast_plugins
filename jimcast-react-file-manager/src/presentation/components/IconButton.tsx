// jimcast-react-file-manager/src/presentation/components/IconButton.tsx
//
// Tiny local replacement for the host's ui/Primitives IconButton —
// unchanged from the original inline version, just given its own file.

export function IconButton({
  onClick, title, disabled, children,
}: { onClick: () => void; title?: string; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        background: 'none', border: 'none', cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.4 : 1, fontSize: 14, padding: '2px 6px', color: 'inherit',
      }}
    >
      {children}
    </button>
  )
}
