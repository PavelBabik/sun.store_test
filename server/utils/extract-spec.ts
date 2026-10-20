import type { SpecUnit } from '#shared/utils/categories'
import type { ProductSpec } from '#shared/types/product'

interface UnitRule {
  /** Matches a number followed by a unit; group 1 – number, group 2 – unit. */
  pattern: RegExp
  /** Converts a matched value to the base unit (kWh or W). */
  toBase: (value: number, unit: string) => number
  /** Plausible range in the base unit; anything outside is treated as noise. */
  range: [min: number, max: number]
}

// `(?<![\d.,])` – the number must not be a tail of a longer number,
// `\b` after the unit – `kW` must not match inside `kWh`, `W` inside `Wh` etc.
const RULES: Record<SpecUnit, UnitRule> = {
  kWh: {
    pattern: /(?<![\d.,])(\d+(?:[.,]\d+)?)\s*(kWh|Wh)\b/gi,
    toBase: (value, unit) => (unit.toLowerCase() === 'wh' ? value / 1000 : value),
    range: [0.1, 1000],
  },
  W: {
    pattern: /(?<![\d.,])(\d+(?:[.,]\d+)?)\s*(kWp?|Wp?)\b/gi,
    toBase: (value, unit) => (unit.toLowerCase().startsWith('k') ? value * 1000 : value),
    range: [1, 2000],
  },
}

const TRAILING_NUMBER = /(?:^|\s)(\d+(?:\.\d+)?)\s*$/

function toNumber(raw: string): number {
  return Number(raw.replace(',', '.'))
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000
}

function inRange(value: number, [min, max]: [number, number]): boolean {
  return Number.isFinite(value) && value >= min && value <= max
}

/** All values with the given unit mentioned in the text, in order of appearance. */
export function findUnitValues(text: string, unit: SpecUnit): number[] {
  const rule = RULES[unit]
  return [...text.matchAll(rule.pattern)]
    .map(([, value = '', matchedUnit = '']) => round(rule.toBase(toNumber(value), matchedUnit)))
    .filter(value => inRange(value, rule.range))
}

/** Number at the very end of the name, e.g. "HomeVault 13.5" → 13.5. */
export function findNameNumber(name: string): number | null {
  const match = TRAILING_NUMBER.exec(name)
  return match?.[1] ? toNumber(match[1]) : null
}

/**
 * Extracts capacity (kWh) or power (W) from the product name and description.
 *
 * Descriptions often mention several values ("7.5kWh … stack up to four units for a total of 30kWh",
 * "10.5kWh … three 3.5kWh modules"), so the trailing number of the name is used to pick the right one.
 * Without a confirmation the first value with a unit wins, and the name alone is the last resort.
 */
export function extractSpec(name: string, description: string, unit: SpecUnit | null): ProductSpec | null {
  if (!unit) return null

  const fromDescription = findUnitValues(description, unit)
  const fromName = findNameNumber(name)
  const nameIsPlausible = fromName !== null && inRange(fromName, RULES[unit].range)

  if (nameIsPlausible && fromDescription.includes(fromName)) {
    return { value: fromName, unit, source: 'name+description' }
  }
  const [firstFromDescription] = fromDescription
  if (firstFromDescription !== undefined) {
    return { value: firstFromDescription, unit, source: 'description' }
  }
  if (nameIsPlausible) {
    return { value: fromName, unit, source: 'name' }
  }
  return null
}
