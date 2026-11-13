import { ean13Modules } from "@urbanmag/core/barcode";
import s from "./product-barcode.module.css";

export function ProductBarcode({ value, label }: { value?: string; label: string }) {
  const modules = value ? ean13Modules(value) : undefined;
  if (!modules || !value) return null;
  return (
    <svg className={s.barcode} viewBox="0 0 113 60" width="226" height="120" role="img" aria-label={`${label}: ${value}`}>
      {Array.from(modules, (bit, index) => bit === "1" ? <rect key={index} x={index + 11} y="2" width="1" height={index < 3 || (index >= 45 && index < 50) || index >= 92 ? 46 : 42} /> : null)}
      <text x="56.5" y="57" textAnchor="middle" fontSize="8">{value}</text>
    </svg>
  );
}
