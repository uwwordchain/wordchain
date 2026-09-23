import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // Safety net for PIN-reset emails: Supabase appends ?code=... to the redirect
  // URL. If the redirect allow-list strips the /reset-pin path, the code lands
  // on the site root (or /home) instead — forward it to the reset page.
  const { pathname, searchParams } = request.nextUrl
  if ((pathname === '/' || pathname === '/home') && searchParams.has('code')) {
    const url = request.nextUrl.clone()
    url.pathname = '/reset-pin'
    return NextResponse.redirect(url)
  }

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
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Protect admin routes
  if (request.nextUrl.pathname.startsWith('/admin')) {
    if (!user) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    // TODO: check is_admin from public.users
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    // Skip API routes (they authenticate themselves — avoids a duplicate
    // Supabase Auth round trip on every fetch), static assets, and images.
    '/((?!api/|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
