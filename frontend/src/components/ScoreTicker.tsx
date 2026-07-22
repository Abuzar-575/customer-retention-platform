import { useEffect, useRef, useState } from 'react'

type Props = {
  value: number
  decimals?: number
  prefix?: string
  suffix?: string
}

export default function ScoreTicker({ value, decimals = 0, prefix = '', suffix = '' }: Props) {
  const [shown, setShown] = useState(0)
  const shownRef = useRef(0)

  useEffect(() => {
    const start = performance.now()
    const from = shownRef.current
    const duration = 600
    let frame = 0

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - (1 - t) ** 3
      const next = from + (value - from) * eased
      shownRef.current = next
      setShown(next)
      if (t < 1) frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value])

  return (
    <>
      {prefix}
      {shown.toFixed(decimals)}
      {suffix}
    </>
  )
}
