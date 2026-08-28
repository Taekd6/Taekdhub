import { cn } from "@/lib/cn";

export function Card({
  className,
  children,
  hover = false,
  ...props
}: React.HTMLAttributes<HTMLElement> & { hover?: boolean }) {
  return (
    <article className={cn("surface", hover && "surface-hover", className)} {...props}>
      {children}
    </article>
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex items-start justify-between gap-4", className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn("font-semibold tracking-tight", className)} {...props} />;
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("", className)} {...props} />;
}
