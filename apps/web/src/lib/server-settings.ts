import { cache } from "react";
import { getSettings } from "@urbanmag/core";

// Deduplicate layout/page reads within one render, never across visitors.
export const shopSettings = cache(getSettings);
