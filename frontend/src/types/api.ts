/** Types partagés correspondant aux API Resources Laravel (/api/v1). Les montants sont des chaînes décimales. */

export interface PaginationMeta {
  current_page: number
  last_page: number
  per_page: number
  total: number
}

export interface Paginated<T> {
  data: T[]
  meta: PaginationMeta
}

export interface Role {
  id: number
  slug: string
  name: string
  scope: 'platform' | 'company'
  description?: string | null
  users_count?: number
  permissions?: string[]
}

export interface CompanySummary {
  id: number
  name: string
  currency: string
  locale: string
}

export interface User {
  id: number
  name: string
  email: string
  is_active: boolean
  last_login_at: string | null
  created_at?: string
  company: CompanySummary | null
  role: Pick<Role, 'id' | 'slug' | 'name' | 'scope'>
}

export interface AuthUser extends User {
  permissions: string[]
}

export interface Company {
  id: number
  name: string
  legal_name: string | null
  tax_id: string | null
  email: string | null
  phone: string | null
  address: string | null
  currency: string
  locale: string
  status: 'active' | 'suspended'
  users_count?: number
  created_at: string
}

export type AccountType = 'asset' | 'liability' | 'equity' | 'income' | 'expense'
export type AccountCategory =
  'receivable' | 'payable' | 'bank' | 'cash' | 'vat_collected' | 'vat_deductible'

export interface Account {
  id: number
  code: string
  name: string
  type: AccountType
  category: AccountCategory | null
  is_active: boolean
}

export type JournalType = 'sales' | 'purchases' | 'bank' | 'cash' | 'general'

export interface Journal {
  id: number
  code: string
  name: string
  type: JournalType
  is_active: boolean
}

export interface FiscalYear {
  id: number
  name: string
  starts_on: string
  ends_on: string
  status: 'open' | 'closed'
}

export interface Partner {
  id: number
  type: 'customer' | 'supplier'
  name: string
  email: string | null
  phone: string | null
  tax_id: string | null
  address: string | null
  is_active: boolean
}

export type EntryStatus = 'draft' | 'posted' | 'reversed'

export interface EntryLine {
  id: number
  account_id: number
  account: { id: number; code: string; name: string } | null
  label: string | null
  debit: string
  credit: string
}

export interface JournalEntry {
  id: number
  reference: string | null
  journal?: { id: number; code: string; name: string }
  entry_date: string
  description: string
  status: EntryStatus
  source_type: string | null
  source_id: number | null
  reversal_of_id: number | null
  reversed_at: string | null
  posted_at: string | null
  lines?: EntryLine[]
}

export type InvoiceType = 'customer' | 'supplier'
export type InvoiceStatus = 'draft' | 'posted' | 'paid' | 'cancelled'

export interface InvoiceLine {
  id: number
  account_id: number
  account: { id: number; code: string; name: string } | null
  description: string
  quantity: string
  unit_price: string
  tax_rate: string
  net_amount: string
  tax_amount: string
}

export interface Invoice {
  id: number
  type: InvoiceType
  number: string | null
  supplier_reference: string | null
  partner?: { id: number; name: string }
  partner_id: number
  invoice_date: string
  due_date: string
  status: InvoiceStatus
  currency: string
  subtotal: string
  tax_total: string
  total: string
  amount_paid: string
  amount_due: string
  notes: string | null
  journal_entry_id: number | null
  posted_at: string | null
  lines?: InvoiceLine[]
}

export type PaymentMethod = 'bank_transfer' | 'cash' | 'check' | 'card'

export interface Payment {
  id: number
  invoice?: { id: number; number: string | null; type: InvoiceType }
  invoice_id: number
  treasury_account?: { id: number; code: string; name: string }
  amount: string
  paid_on: string
  method: PaymentMethod
  reference: string | null
  journal_entry_id: number | null
  created_at: string
}

export interface Expense {
  id: number
  expense_date: string
  description: string
  amount: string
  status: 'draft' | 'posted'
  reference: string | null
  account_id: number
  account?: { id: number; code: string; name: string }
  paid_from_account_id: number
  paid_from_account?: { id: number; code: string; name: string }
  partner_id: number | null
  partner?: { id: number; name: string } | null
  journal_entry_id: number | null
}

export interface AuditLog {
  id: number
  action: string
  user?: { id: number; name: string } | null
  company_id: number | null
  subject_type: string | null
  subject_id: number | null
  metadata: Record<string, unknown> | null
  ip_address: string | null
  created_at: string
}

export interface PlatformSettings {
  platform_name: string
  brand_color: string
  default_locale: 'fr' | 'en'
  default_currency: string
  password_min_length: number
  features: { expenses: boolean }
}

/** Sous-ensemble public de la plateforme (écrans avant connexion). */
export interface PublicPlatform {
  platform_name: string
  brand_color?: string
  default_locale?: 'fr' | 'en'
  password_min_length?: number
  registration_enabled?: boolean
  terms_url?: string | null
}

/** Sous-ensemble public de la plateforme (écrans avant connexion). */
export interface PublicPlatform {
  platform_name: string
  brand_color?: string
  default_locale?: 'fr' | 'en'
  password_min_length?: number
  registration_enabled?: boolean
  terms_url?: string | null
}

export interface AccountingDashboard {
  treasury_total: string
  receivable_outstanding: string
  payable_outstanding: string

  revenue_this_month: string
  expenses_this_month: string
  net_result_this_month: string

  draft_entries: number
  overdue_customer_invoices: number
  overdue_supplier_invoices: number

  monthly: {
    month: string
    revenue: string
    expenses: string
  }[]

  recent_entries: {
    id: number
    reference: string | null
    journal: string | null
    entry_date: string
    description: string
    status: EntryStatus
  }[]
}

export interface AdminDashboard {
  scope: 'platform' | 'company'
  users_total: number
  users_active: number
  companies_total: number | null
  active_sessions: number
  recent_logins: { id: number; name: string; email: string; last_login_at: string }[]
  recent_activity: { id: number; action: string; user: string | null; created_at: string }[]
  logins_by_day: { date: string; count: number }[]
  alerts: { level: 'info' | 'warning'; message: string }[]
}

export interface SessionInfo {
  id: number
  device: string
  user: { id: number; name: string; email: string }
  last_used_at: string | null
  created_at: string
  expires_at: string | null
  is_current: boolean
}

export interface PermissionGroup {
  resource: string
  actions: string[]
}

export interface TrialBalanceReport {
  rows: {
    account_id: number
    code: string
    name: string
    type: AccountType
    debit: string
    credit: string
    balance_debit: string
    balance_credit: string
  }[]
  totals: { debit: string; credit: string; balanced: 'true' | 'false' }
}

export interface ReportLine {
  account_id: number
  code: string
  name: string
  amount: string
}

export interface IncomeStatementReport {
  income: ReportLine[]
  expenses: ReportLine[]
  total_income: string
  total_expenses: string
  net_result: string
}

export interface BalanceSheetReport {
  as_of: string
  assets: ReportLine[]
  liabilities: ReportLine[]
  equity: ReportLine[]
  unclosed_result: string
  total_assets: string
  total_liabilities: string
  total_equity: string
  total_liabilities_and_equity: string
  balanced: boolean
}

export interface TreasuryReport {
  accounts: { account_id: number; code: string; name: string; category: string; balance: string }[]
  total: string
}
