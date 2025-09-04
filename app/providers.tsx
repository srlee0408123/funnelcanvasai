"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider, Toaster } from "@/components/Ui/notifications";
import { ThemeProvider } from "next-themes";
import { queryClient } from "@/lib/queryClient";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} forcedTheme="light">
        <TooltipProvider>
          {children}
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}