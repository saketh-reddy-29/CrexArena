/**
 * Safe Mathematical and Statistical Helpers to prevent NaN, Infinite, Negative, or Out-of-Bounds values.
 */

export function safeNumber(value: any, fallback: number = 0): number {
  if (value === null || value === undefined) return fallback;
  const num = Number(value);
  if (isNaN(num) || !isFinite(num)) return fallback;
  return num;
}

export function safeProbability(value: any, min: number = 0, max: number = 1): number {
  const num = safeNumber(value, min);
  return Math.min(max, Math.max(min, num));
}

export function safeRating(value: any, min: number = 50, max: number = 99.9): number {
  const num = safeNumber(value, min);
  const clamped = Math.min(max, Math.max(min, num));
  return Math.round(clamped * 10) / 10;
}

export function safeForm(value: any, min: number = 0, max: number = 100): number {
  const num = safeNumber(value, 75);
  const clamped = Math.min(max, Math.max(min, num));
  return Math.round(clamped * 10) / 10;
}

export function safePositiveInt(value: any, fallback: number = 0): number {
  const num = Math.floor(safeNumber(value, fallback));
  return Math.max(0, num);
}

export function safePositiveFloat(value: any, fallback: number = 0): number {
  const num = safeNumber(value, fallback);
  return Math.max(0, num);
}
