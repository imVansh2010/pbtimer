import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/cn";

type Variant = "primary" | "default" | "ghost" | "danger" | "outline";
type Size = "sm" | "md" | "lg" | "icon" | "icon-sm" | "icon-xs";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  children?: ReactNode;
}

const base =
  "relative inline-flex shrink-0 items-center justify-center gap-2 rounded-xl font-medium select-none " +
  "cursor-pointer transition-[background-color,color,box-shadow,transform,opacity] duration-150 ease-out " +
  "active:translate-y-px active:scale-[0.99] disabled:pointer-events-none disabled:opacity-40 " +
  "disabled:shadow-none";

const variants: Record<Variant, string> = {
  primary: "tactile bg-accent text-ink-950 hover:bg-accent-strong active:bg-accent",
  default:
    "tactile border border-accent-line/70 bg-accent-soft text-chalk hover:border-accent-line hover:bg-accent-line/45",
  outline:
    "border border-white/[0.09] bg-transparent text-chalk-dim hover:border-white/[0.14] hover:bg-white/[0.04] hover:text-chalk",
  ghost: "text-muted hover:bg-white/[0.05] hover:text-chalk",
  danger: "tactile border border-bad/25 bg-bad/10 text-bad hover:border-bad/40 hover:bg-bad/15",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-2.5 text-[12px] pointer-coarse:h-10",
  md: "h-9 px-3.5 text-[13px] pointer-coarse:h-11",
  lg: "h-11 px-5 text-sm",
  icon: "size-9 rounded-xl pointer-coarse:size-11",
  "icon-sm": "size-8 rounded-lg pointer-coarse:size-11",
  "icon-xs": "size-7 rounded-md pointer-coarse:size-10",
};

export function Button({
  variant = "default",
  size = "md",
  className,
  type = "button",
  children,
  ...rest
}: ButtonProps) {
  return (
    <button type={type} className={cn(base, variants[variant], sizes[size], className)} {...rest}>
      {children}
    </button>
  );
}

export function IconButton({
  label,
  variant = "ghost",
  size = "icon",
  className,
  children,
  ...rest
}: Omit<ButtonProps, "children" | "aria-label"> & {
  label: string;
  children: ReactNode;
}) {
  return (
    <Button
      aria-label={label}
      title={label}
      variant={variant}
      size={size}
      className={className}
      {...rest}
    >
      {children}
    </Button>
  );
}
