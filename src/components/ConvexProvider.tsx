"use client";

import { ConvexProvider as Provider, ConvexReactClient } from "convex/react";
import { SettingsProvider } from "@/lib/useSettings";
import { ReactNode } from "react";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export function ConvexProvider({ children }: { children: ReactNode }) {
  return (
    <SettingsProvider>
      <Provider client={convex}>{children}</Provider>
    </SettingsProvider>
  );
}
