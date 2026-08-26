import { cn } from "@/lib/cn";

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
  className,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-end", className)}>
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-1.5">{eyebrow}</p>}
        <h1 className="t-display">{title}</h1>
        <p className="t-meta mt-1.5 max-w-prose">{description}</p>
      </div>
      {action}
    </div>
  );
}
