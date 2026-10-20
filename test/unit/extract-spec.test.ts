import { describe, expect, it } from 'vitest'
import { extractSpec, findNameNumber, findUnitValues } from '../../server/utils/extract-spec'

describe('findUnitValues', () => {
  it('finds kWh values in order of appearance', () => {
    expect(findUnitValues('A 7.5kWh module, total of 30 kWh', 'kWh')).toEqual([7.5, 30])
  })

  it('converts Wh to kWh and accepts a decimal comma', () => {
    expect(findUnitValues('5000Wh pack, 2,5 kWh module', 'kWh')).toEqual([5, 2.5])
  })

  it('converts kW / kWp to W and accepts Wp', () => {
    expect(findUnitValues('0.45 kWp, 450Wp, 450W', 'W')).toEqual([450, 450, 450])
  })

  it('does not read kWh as W', () => {
    expect(findUnitValues('a 10kWh battery', 'W')).toEqual([])
  })

  it('ignores other units and numbers', () => {
    const text = '5400 Pa snow load, up to 25%, 182mm wafers, 30-year warranty, 15A, 1500V, 8 AWG'
    expect(findUnitValues(text, 'W')).toEqual([])
    expect(findUnitValues(text, 'kWh')).toEqual([])
  })

  it('does not take the tail of a thousands-separated number', () => {
    expect(findUnitValues('rated 6,000 W', 'W')).not.toContain(0)
  })

  it('drops implausible values', () => {
    expect(findUnitValues('a 99999W monster', 'W')).toEqual([])
    expect(findUnitValues('0.01 kWh', 'kWh')).toEqual([])
  })
})

describe('findNameNumber', () => {
  it.each([
    ['EcoCharge HomeVault 10', 10],
    ['ZenithStorage Z-Bank 4.8', 4.8],
    ['Solarix Prime 450', 450],
    ['SafeLock Pro Pair M/F', null],
    ['QuickLink MC3 Set (10-pack)', null],
  ])('%s → %s', (name, expected) => {
    expect(findNameNumber(name)).toBe(expected)
  })
})

describe('extractSpec', () => {
  it('prefers the name number confirmed by the description', () => {
    expect(extractSpec(
      'PowerFlow Stack 7.5',
      'The PowerFlow Stack 7.5 is a 7.5kWh modular LFP battery. You can stack up to four units for a total of 30kWh.',
      'kWh',
    )).toEqual({ value: 7.5, unit: 'kWh', source: 'name+description' })
  })

  it('is not fooled by module sizes mentioned first or later', () => {
    expect(extractSpec('PowerFlow Stack 10.5', 'This 10.5kWh battery system is comprised of three 3.5kWh modules.', 'kWh'))
      .toMatchObject({ value: 10.5, source: 'name+description' })
    expect(extractSpec('AuraPower Reserve 12.5', 'A 12.5kWh (five 2.5kWh modules) stackable LFP system.', 'kWh'))
      .toMatchObject({ value: 12.5, source: 'name+description' })
  })

  it('falls back to the first value in the description', () => {
    expect(extractSpec('Mystery Box', 'Holds 5000Wh now, later 2x 10kWh', 'kWh'))
      .toEqual({ value: 5, unit: 'kWh', source: 'description' })
  })

  it('falls back to the name when the description has no unit', () => {
    expect(extractSpec('Battery 10', 'Pairs with an inverter rated 5kW, 6,000 cycles.', 'kWh'))
      .toEqual({ value: 10, unit: 'kWh', source: 'name' })
  })

  it('returns null when nothing can be extracted', () => {
    expect(extractSpec('Panel Pro', 'Certified for 5400 Pa snow loads.', 'W')).toBeNull()
    expect(extractSpec('Huge 99999', 'nothing here', 'W')).toBeNull()
  })

  it('returns null for categories without a spec unit', () => {
    expect(extractSpec('SafeLock Inline Fuse 15A', 'A 15A fuse, 1500V, 100W', null)).toBeNull()
  })
})
