import { useRef } from 'react'

export function useSwipeToDismiss(onDismiss: () => void, threshold = 80) {
  const startY = useRef<number | null>(null)
  const currentY = useRef<number | null>(null)
  const sheetRef = useRef<HTMLDivElement>(null)

  const onTouchStart = (e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY
  }

  const onTouchMove = (e: React.TouchEvent) => {
    if (startY.current === null) return
    currentY.current = e.touches[0].clientY
    const delta = currentY.current - startY.current
    if (delta > 0 && sheetRef.current) {
      sheetRef.current.style.transform = `translateY(${delta}px)`
      sheetRef.current.style.transition = 'none'
    }
  }

  const onTouchEnd = () => {
    if (startY.current === null || currentY.current === null) return
    const delta = currentY.current - startY.current
    if (sheetRef.current) {
      sheetRef.current.style.transition = 'transform 0.3s ease'
      if (delta > threshold) {
        sheetRef.current.style.transform = `translateY(100%)`
        setTimeout(onDismiss, 300)
      } else {
        sheetRef.current.style.transform = 'translateY(0)'
      }
    }
    startY.current = null
    currentY.current = null
  }

  return { sheetRef, onTouchStart, onTouchMove, onTouchEnd }
}
