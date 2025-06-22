import { createClient } from '@/lib/supabase/server'
import { type EmailOtpType } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = searchParams.get('next') ?? '/'

  if (token_hash && type) {
    const supabase = await createClient()

    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    })
    if (!error) {
      // Just redirect, no cookie needed
      return NextResponse.redirect(new URL(next, request.url))
    } else {
      // redirect the user to an error page with some instructions
      const errorUrl = new URL(`/auth/error`, request.url)
      errorUrl.searchParams.set('error', error.message)
      return NextResponse.redirect(errorUrl)
    }
  }

  // redirect the user to an error page with some instructions
  const errorUrl = new URL(`/auth/error`, request.url)
  errorUrl.searchParams.set('error', 'No token hash or type')
  return NextResponse.redirect(errorUrl)
}
