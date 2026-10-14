import { cn } from "#lib/utils"

function Progress({
  value,
  className,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  ...props
}: React.ComponentProps<"div"> & { value: number }) {
  // #403: Math.max(0, NaN) is NaN, so a caller computing a percentage with a zero total
  // produced aria-valuenow="NaN" and a NaN% width. Guard non-finite values.
  const clamped = Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0
  return (
    <div
      data-slot="progress"
      role="progressbar"
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped)}
      className={cn(
        "h-2 w-full overflow-hidden rounded-full bg-muted",
        className
      )}
      {...props}
    >
      <div
        className="h-full bg-primary transition-all duration-200"
        style={{ width: `${clamped}%` }}
      />
    </div>
  )
}

export { Progress }
