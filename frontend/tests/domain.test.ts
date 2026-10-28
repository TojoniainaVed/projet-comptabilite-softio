import { describe, expect, it } from 'vitest'
import { computeEntryTotals } from '@/features/entries/balance'
import { computeInvoiceTotals } from '@/features/invoices/totals'
import { formatDate, fromCents, toCents } from '@/lib/utils'
import { moneyString, normalizeMoney, positiveMoney } from '@/lib/validation'

describe("totaux d'écriture", () => {
  it('reconnaît une écriture équilibrée', () => {
    const totals = computeEntryTotals([
      { debit: '1200.50', credit: '' },
      { debit: '', credit: '1000.50' },
      { debit: '', credit: '200' },
    ])
    expect(totals).toMatchObject({
      debit: '1200.50',
      credit: '1200.50',
      difference: '0.00',
      balanced: true,
    })
  })

  it("n'accumule pas d'erreur flottante (0,1 + 0,2 = 0,3)", () => {
    const totals = computeEntryTotals([
      { debit: '0.10', credit: '' },
      { debit: '0.20', credit: '' },
      { debit: '', credit: '0.30' },
    ])
    expect(totals.balanced).toBe(true)
  })

  it("signale l'écart d'une écriture déséquilibrée", () => {
    const totals = computeEntryTotals([
      { debit: '100', credit: '' },
      { debit: '', credit: '90' },
    ])
    expect(totals.balanced).toBe(false)
    expect(totals.difference).toBe('10.00')
  })

  it('refuse une écriture vide ou à zéro', () => {
    expect(
      computeEntryTotals([
        { debit: '', credit: '' },
        { debit: '0', credit: '0' },
      ]).balanced,
    ).toBe(false)
    expect(computeEntryTotals([]).hasAmounts).toBe(false)
  })

  it('accepte la virgule décimale', () => {
    expect(
      computeEntryTotals([
        { debit: '10,25', credit: '' },
        { debit: '', credit: '10,25' },
      ]).balanced,
    ).toBe(true)
  })
})

describe('totaux de facture', () => {
  it('calcule HT, TVA et TTC ligne par ligne', () => {
    const totals = computeInvoiceTotals([
      { quantity: '2', unit_price: '100.00', tax_rate: '20' },
      { quantity: '1', unit_price: '50.00', tax_rate: '0' },
    ])
    expect(totals).toMatchObject({ subtotal: '250.00', tax: '40.00', total: '290.00' })
    expect(totals.lines[0]).toEqual({ net: '200.00', tax: '40.00' })
  })

  it('arrondit la TVA au centime par ligne, comme le backend', () => {
    const totals = computeInvoiceTotals([{ quantity: '1', unit_price: '10.05', tax_rate: '20' }])
    expect(totals.tax).toBe('2.01')
    expect(totals.total).toBe('12.06')
  })

  it('gère les quantités décimales et les saisies incomplètes', () => {
    expect(
      computeInvoiceTotals([{ quantity: '1.5', unit_price: '10', tax_rate: '0' }]).subtotal,
    ).toBe('15.00')
    expect(computeInvoiceTotals([{ quantity: '', unit_price: 'abc', tax_rate: '' }]).total).toBe(
      '0.00',
    )
  })
})

describe('utilitaires', () => {
  it('convertit les montants en centimes sans dérive', () => {
    expect(toCents('19.99')).toBe(1999)
    expect(toCents('1,5')).toBe(150)
    expect(fromCents(1999)).toBe('19.99')
  })

  it('valide les saisies monétaires', () => {
    expect(moneyString().safeParse('12.34').success).toBe(true)
    expect(moneyString().safeParse('12,3').success).toBe(true)
    expect(moneyString().safeParse('12.345').success).toBe(false)
    expect(moneyString().safeParse('-5').success).toBe(false)
    expect(moneyString().safeParse('abc').success).toBe(false)
    expect(positiveMoney().safeParse('0').success).toBe(false)
    expect(normalizeMoney(' 12,50 ')).toBe('12.50')
  })

  it('formate les dates sans décalage de fuseau', () => {
    expect(formatDate('2026-03-05')).toBe('05/03/2026')
    expect(formatDate(null)).toBe('—')
  })
})
