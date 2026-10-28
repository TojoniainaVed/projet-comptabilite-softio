import { api } from '@/lib/api-client'

export interface RegisterInput {
  company_name: string
  name: string
  email: string
  password: string
  password_confirmation: string
  accept_terms: boolean
}

export interface RegisterResult {
  message: string
  verification_required: boolean
}

export const authApi = {
  register: (input: RegisterInput) => api.post<RegisterResult>('/auth/register', input),
  resendVerification: (email: string) =>
    api.post<{ message: string }>('/auth/email/resend', { email }),
  forgotPassword: (email: string) =>
    api.post<{ message: string }>('/auth/password/forgot', { email }),
  resetPassword: (input: {
    token: string
    email: string
    password: string
    password_confirmation: string
  }) => api.post<{ message: string }>('/auth/password/reset', input),
}
