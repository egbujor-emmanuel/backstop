import { formatUnits, parseUnits } from "viem";
import { TEAM_WALLETS } from "../config";

export function musd(value: bigint | undefined, digits = 2): string {
  if (value === undefined) return "…";
  const n = Number(formatUnits(value, 18));
  return n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function compact(value: bigint | undefined): string {
  if (value === undefined) return "…";
  const n = Number(formatUnits(value, 18));
  return n.toLocaleString("en-US", { notation: "compact", maximumFractionDigits: 1 });
}

export function usd(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function short(addr: string | undefined): string {
  if (!addr) return "…";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function teamLabel(addr: string | undefined): string | undefined {
  return addr ? TEAM_WALLETS[addr.toLowerCase()] : undefined;
}

export function bps(value: bigint | number | undefined): string {
  if (value === undefined) return "…";
  return `${(Number(value) / 100).toFixed(2)}%`;
}

export function dateTime(seconds: bigint | number | undefined): string {
  if (seconds === undefined) return "…";
  return new Date(Number(seconds) * 1000).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  });
}

export function duration(seconds: number): string {
  if (seconds <= 0) return "now";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

/** Human-readable message from a wallet or contract error. */
export function errorMessage(error: unknown): string {
  if (!error) return "";
  const e = error as { shortMessage?: string; message?: string; cause?: { data?: { errorName?: string } } };
  const name = e.cause?.data?.errorName;
  if (name) return `Reverted: ${name}`;
  return e.shortMessage ?? e.message ?? "Unexpected error";
}

/** Keeps digits and at most one decimal point, with at most 18 decimals. */
export function sanitizeAmount(raw: string): string {
  const cleaned = raw.replace(/[^0-9.]/g, "");
  const [whole, ...rest] = cleaned.split(".");
  if (rest.length === 0) return whole;
  return `${whole}.${rest.join("").slice(0, 18)}`;
}

/** MUSD amount in wei, or 0n if the input is empty or not a number. */
export function parseAmount(value: string): bigint {
  if (!/^\d*\.?\d*$/.test(value) || value === "" || value === ".") return 0n;
  try {
    return parseUnits(value, 18);
  } catch {
    return 0n;
  }
}
