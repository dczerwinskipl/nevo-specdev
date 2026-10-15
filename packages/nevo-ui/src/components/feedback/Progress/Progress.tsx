import { forwardRef, useEffect, useRef, useState, type HTMLAttributes } from 'react';
import { designLayerMetadata, useDesignMetadata } from '@nevo/figma-capture/metadata';
import { cn } from '../../../lib';
import { tv } from 'tailwind-variants/lite';

const progressVariants = tv({
  base: 'w-full overflow-hidden rounded-full',
  variants: {
    size: { default: 'h-progress-track', compact: 'h-1' },
    representation: { segmented: 'flex gap-0.5', continuous: 'bg-surface-control' },
  },
});

type ProgressAccessibilityProps =
  | {
      'aria-label': string;
      'aria-labelledby'?: never;
    }
  | {
      'aria-label'?: never;
      'aria-labelledby': string;
    };

export type ProgressProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  'aria-label' | 'aria-labelledby' | 'children'
> &
  ProgressAccessibilityProps & {
    size?: 'default' | 'compact';
  } & (
    | { variant: 'segmented'; completed: number; total: number; value?: never; max?: never }
    | { variant?: 'continuous'; value: number; max?: number; completed?: never; total?: never }
  );

export function fitsProgressSegments(width: number, total: number) {
  return total > 0 && (width - (total - 1) * 2) / total >= 4;
}

export function validProgressCounts(completed: number, total: number) {
  return (
    Number.isSafeInteger(total) &&
    total > 0 &&
    Number.isSafeInteger(completed) &&
    completed >= 0 &&
    completed <= total
  );
}

export function normalizeProgressValue(value: number, max: number) {
  const safeMax = Number.isFinite(max) && max > 0 ? max : 100;
  const safeValue = Number.isFinite(value) ? Math.min(Math.max(value, 0), safeMax) : 0;

  return {
    max: safeMax,
    value: safeValue,
    percentage: (safeValue / safeMax) * 100,
  };
}

export const Progress = forwardRef<HTMLDivElement, ProgressProps>(function Progress(input, ref) {
  const {
    className,
    variant = 'continuous',
    size = 'default',
    style,
    completed: _completed,
    total: _total,
    value: _value,
    max: _max,
    ...props
  } = input;
  const element = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);
  const counts =
    input.variant === 'segmented' ? { completed: input.completed, total: input.total } : undefined;
  const segmented = Boolean(counts);
  const valid = !counts || validProgressCounts(counts.completed, counts.total);
  const normalized =
    input.variant === 'segmented'
      ? normalizeProgressValue(input.completed, input.total)
      : normalizeProgressValue(input.value, input.max ?? 100);
  useEffect(() => {
    if (!segmented || !element.current) return;
    const node = element.current;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(entry.contentRect.width);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [segmented, valid]);
  const capture = useDesignMetadata('Progress', { size, variant });
  if (!valid) return null;
  const showSegments = counts && fitsProgressSegments(width, counts.total);

  return (
    <div
      ref={(node) => {
        element.current = node;
        if (typeof ref === 'function') return ref(node);
        if (ref) ref.current = node;
      }}
      aria-valuemax={normalized.max}
      aria-valuemin={0}
      aria-valuenow={normalized.value}
      className={progressVariants({
        size,
        representation: showSegments ? 'segmented' : 'continuous',
        className,
      })}
      role="progressbar"
      data-progress-representation={showSegments ? 'segmented' : 'continuous'}
      style={style}
      {...props}
      {...capture}
    >
      {showSegments ? (
        Array.from({ length: counts.total }, (_, index) => (
          <div
            key={index}
            aria-hidden="true"
            data-progress-segment
            data-completed={index < counts.completed ? 'true' : 'false'}
            className={cn(
              'h-full min-w-0 flex-1 rounded-[2px]',
              index < counts.completed ? 'bg-progress-fill' : 'bg-surface-control',
            )}
          />
        ))
      ) : (
        <div
          className="h-full rounded-[inherit] bg-progress-fill transition-[width] [transition-duration:var(--motion-duration-normal)] [transition-timing-function:var(--motion-ease-standard)] motion-reduce:transition-none"
          style={{ width: `${normalized.percentage}%` }}
          {...designLayerMetadata({ key: 'fill', layer: 'fill' })}
        />
      )}
    </div>
  );
});
