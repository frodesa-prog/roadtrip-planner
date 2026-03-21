import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Viktig: Ikke legg logikk mellom createServerClient og getUser()
  const { data: { user } } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname
  const isLoginPage = pathname === '/login' || pathname === '/'
  const isProtected =
    pathname.startsWith('/plan') ||
    pathname.startsWith('/archive') ||
    pathname.startsWith('/summary') ||
    pathname.startsWith('/notes') ||
    pathname.startsWith('/kostnader') ||
    pathname.startsWith('/minside') ||
    pathname.startsWith('/todo') ||
    pathname.startsWith('/pakkeliste')

  if (!user && isProtected) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && isLoginPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/plan'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/plan/:path*', '/archive/:path*', '/summary/:path*', '/notes/:path*', '/kostnader/:path*', '/minside/:path*', '/todo/:path*', '/pakkeliste/:path*', '/login'],
}
