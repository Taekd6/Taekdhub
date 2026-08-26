import { cn } from "@/lib/cn";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "focus-ring min-h-9 w-full rounded-lg border border-hairline/[0.14] bg-transparent px-3 py-2 text-sm text-ink transition-colors placeholder:text-subtle hover:border-hairline/[0.14] max-lg:min-h-11",
        className
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "focus-ring w-full resize-y rounded-lg border border-hairline/[0.14] bg-transparent px-3 py-2 text-sm leading-6 text-ink placeholder:text-subtle",
        className
      )}
      {...props}
    />
  );
}

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "focus-ring min-h-9 w-full rounded-lg border border-hairline/[0.14] bg-transparent px-3 py-2 text-sm text-ink transition-colors max-lg:min-h-11",
        className
      )}
      {...props}
    />
  );
}
