import { cn } from "@/lib/cn";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "focus-ring w-full rounded-xl border border-hairline/[0.09] bg-black/20 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600",
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
        "focus-ring w-full resize-y rounded-xl border border-hairline/[0.09] bg-black/20 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600",
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
        "focus-ring w-full rounded-xl border border-hairline/[0.09] bg-black/20 px-3.5 py-2.5 text-sm text-zinc-100",
        className
      )}
      {...props}
    />
  );
}
