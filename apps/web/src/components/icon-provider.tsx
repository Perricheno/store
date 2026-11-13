"use client";

import { IconContext } from "@phosphor-icons/react";
import type { ReactNode } from "react";

const defaults = { weight: "bold" as const };

export function IconProvider({ children }: { children: ReactNode }) {
  return (
    <IconContext.Provider value={defaults}>{children}</IconContext.Provider>
  );
}
