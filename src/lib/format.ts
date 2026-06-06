export function fmtAED(n: number | string | undefined): string {
  const v = typeof n === "string" ? Number(n) : (n || 0);
  return `AED ${(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function fmtDate(iso?: string): string {
  if (!iso) return "-";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  } catch { return iso; }
}

export function quarterOf(iso: string): string {
  const d = new Date(iso);
  const q = Math.floor(d.getMonth() / 3) + 1;
  return `Q${q} ${d.getFullYear()}`;
}

export function yearOf(iso: string): string {
  return String(new Date(iso).getFullYear());
}

export function capitalize(name?: string | null): string {
  if (!name) return "there";
  const cleaned = String(name).trim();
  if (!cleaned) return "there";
  // Handle dotted/dashed/underscored prefixes like "shaya.k", "john_doe", "ali-hassan"
  return cleaned
    .split(/[\s._-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}