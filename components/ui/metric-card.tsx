"use client";

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { Card } from "@/components/ui/card";

export function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  className,
  delay = 0,
}: {
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: "easeOut" }}
      whileHover={{ y: -3 }}
    >
      <Card hover className={cn("p-5", className)}>
        <div className="flex items-start justify-between">
          <p className="text-sm text-zinc-400">{label}</p>
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-accent/10">
            <Icon size={16} className="text-accent-text" />
          </div>
        </div>
        <p className="mt-6 text-2xl font-semibold tracking-tight">{value}</p>
        <p className="mt-1 text-xs text-zinc-500">{detail}</p>
      </Card>
    </motion.div>
  );
}
