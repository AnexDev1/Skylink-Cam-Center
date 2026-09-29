import { cn } from "cn"

export function Wordmark({ className }: { className?: string }) {
  return (
    <div className={cn("leading-none", className)}>
      <p className="text-[1.05rem] font-bold tracking-tight text-sl-text">
        sky link
      </p>
      <p className="mt-1 text-[0.62rem] font-semibold tracking-[0.2em] text-sl-text-muted uppercase">
        Technologies
      </p>
    </div>
  )
}
