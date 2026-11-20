import { useEffect, useRef } from 'react'
import JsBarcode from 'jsbarcode'
import type { Company, Invoice, InvoiceType } from '@/types/api'
import { formatDate, formatMoney, formatNumber } from '@/lib/utils'
import './InvoicePrintDocument.css'

interface Props {
  invoice: Invoice
  company?: Company
  kind: InvoiceType
}

export function InvoicePrintDocument({ invoice, company, kind }: Props) {
  const isCustomer = kind === 'customer'
  const partner = invoice.partner
  const barcodeRef = useRef<SVGSVGElement>(null)

  const barcodeValue = invoice.number?.trim() || ''

  useEffect(() => {
    if (!barcodeRef.current || !barcodeValue) return

    JsBarcode(barcodeRef.current, barcodeValue, {
      format: 'CODE128',
      width: 1.6,
      height: 45,
      displayValue: true,
      fontSize: 12,
      fontOptions: 'bold',
      textMargin: 5,
      margin: 0,
      background: '#ffffff',
      lineColor: '#222222',
    })
  }, [barcodeValue])

  return (
    <article className="invoice-print-document">
      <header className="print-header">
        <div className="print-company">
          <img src="/images/logo-softio.png" alt="Logo Softio" className="print-logo" />

          <h2>{company?.legal_name || company?.name || 'Entreprise'}</h2>

          {company?.address && <p>{company.address}</p>}
          {company?.phone && <p>Tél. : {company.phone}</p>}
          {company?.email && <p>{company.email}</p>}
          {company?.tax_id && <p>NIF : {company.tax_id}</p>}
        </div>

        <div className="print-invoice-title">
          <h1>{isCustomer ? 'FACTURE CLIENT' : 'FACTURE FOURNISSEUR'}</h1>

          <strong>{invoice.number || 'BROUILLON'}</strong>

          <p>Date : {formatDate(invoice.invoice_date)}</p>
          <p>Échéance : {formatDate(invoice.due_date)}</p>

          {invoice.supplier_reference && <p>Référence : {invoice.supplier_reference}</p>}
        </div>
      </header>

      <section className="print-partner">
        <h3>{isCustomer ? 'FACTURÉ À' : 'FOURNISSEUR'}</h3>

        <strong>{partner?.name || 'Non renseigné'}</strong>

        {partner?.address && <p>{partner.address}</p>}
        {partner?.phone && <p>Tél. : {partner.phone}</p>}
        {partner?.email && <p>{partner.email}</p>}
        {partner?.tax_id && <p>NIF : {partner.tax_id}</p>}
      </section>

      <table className="print-lines">
        <thead>
          <tr>
            <th>Description</th>
            <th>Quantité</th>
            <th>Prix unitaire</th>
            <th>TVA</th>
            <th>Total HT</th>
          </tr>
        </thead>

        <tbody>
          {(invoice.lines ?? []).map((line) => (
            <tr key={line.id}>
              <td>{line.description}</td>

              <td className="print-number">{formatNumber(line.quantity)}</td>

              <td className="print-number">{formatMoney(line.unit_price, invoice.currency)}</td>

              <td className="print-number">{formatNumber(line.tax_rate)} %</td>

              <td className="print-number">{formatMoney(line.net_amount, invoice.currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <section className="print-bottom">
        <div className="print-notes">
          {invoice.notes && (
            <>
              <h3>Notes</h3>
              <p>{invoice.notes}</p>
            </>
          )}
        </div>

        <dl className="print-totals">
          <div>
            <dt>Total HT</dt>
            <dd>{formatMoney(invoice.subtotal, invoice.currency)}</dd>
          </div>

          <div>
            <dt>TVA</dt>
            <dd>{formatMoney(invoice.tax_total, invoice.currency)}</dd>
          </div>

          <div className="print-grand-total">
            <dt>Total TTC</dt>
            <dd>{formatMoney(invoice.total, invoice.currency)}</dd>
          </div>

          <div>
            <dt>Montant payé</dt>
            <dd>{formatMoney(invoice.amount_paid, invoice.currency)}</dd>
          </div>

          <div className="print-balance">
            <dt>Reste à payer</dt>
            <dd>{formatMoney(invoice.amount_due, invoice.currency)}</dd>
          </div>
        </dl>
      </section>

      {barcodeValue && (
        <section className="print-barcode">
          <svg ref={barcodeRef} />
          <p>Référence : {barcodeValue}</p>
        </section>
      )}

      <footer className="print-footer">
        <p>{company?.legal_name || company?.name || 'Entreprise'}</p>
        <p>Document généré par Softio</p>
      </footer>
    </article>
  )
}
