"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

interface AnimatedSectionProps extends React.ComponentProps<"div"> {
  /** Delay before animation starts in ms */
  delay?: number
  /** Duration of animation in ms */
  duration?: number
  /** Only animate once (don't re-hide when scrolled out) */
  once?: boolean
}

function AnimatedSection({
  children,
  className,
  delay = 0,
  duration = 500,
  once = true,
  ...props
}: AnimatedSectionProps) {
  const ref = React.useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = React.useState(false)

  React.useEffect(() => {
    const element = ref.current
    if (!element) return

    // SSR guard — skip observer setup on server
    if (typeof window === "undefined") return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          if (once) {
            observer.unobserve(element)
          }
        } else if (!once) {
          setIsVisible(false)
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -50px 0px" }
    )

    observer.observe(element)

    return () => {
      observer.unobserve(element)
    }
  }, [once])

  return (
    <div
      ref={ref}
      data-slot="animated-section"
      data-visible={isVisible ? "" : undefined}
      className={cn(
        "transition-all",
        isVisible
          ? "translate-y-0 opacity-100"
          : "translate-y-4 opacity-0",
        className
      )}
      style={{
        transitionDuration: `${duration}ms`,
        transitionDelay: isVisible ? `${delay}ms` : "0ms",
      }}
      {...props}
    >
      {children}
    </div>
  )
}

export { AnimatedSection }
export type { AnimatedSectionProps }
