import { useRef, useState, type DragEvent } from 'react'

type Props = {
  onFile: (file: File) => void
  busy?: boolean
}

export default function CsvDropzone({ onFile, busy }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const take = (file?: File | null) => {
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.csv')) {
      alert('Please drop a .csv file')
      return
    }
    onFile(file)
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    take(e.dataTransfer.files?.[0])
  }

  return (
    <div
      className={`dropzone ${dragging ? 'dragging' : ''} ${busy ? 'busy' : ''}`}
      onClick={() => !busy && inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        hidden
        onChange={(e) => take(e.target.files?.[0])}
      />
      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 800,
          fontSize: '1.4rem',
          marginBottom: '0.5rem',
        }}
      >
        {busy ? 'SCANNING ROSTER…' : 'DROP CUSTOMER CSV'}
      </div>
      <p className="muted" style={{ margin: 0 }}>
        {busy
          ? 'Running churn model + business insights'
          : 'or click to browse — Telco-style columns required'}
      </p>
    </div>
  )
}
