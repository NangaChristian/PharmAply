import { supabase } from './supabase';

/**
 * Safe API Fetch Wrapper
 * 
 * Guarantees a fresh token before making backend requests.
 * Resolves the "Refresh Token Not Found" issue caused by holding onto dead access tokens.
 */
export async function fetchApi(url: string, options: RequestInit = {}): Promise<Response> {
  // 1. Always call getSession() to guarantee token freshness.
  // This automatically triggers background refresh if the token is expired but valid.
  let data, error;
  try {
     const res = await supabase.auth.getSession();
     data = res.data;
     error = res.error;
  } catch (err: any) {
     error = err;
  }

  // 2. Abort if no session is returned (Refresh Token failure/missing)
  if (error || !data?.session) {
    console.error("Session fetch failed, redirecting to login:", error?.message);
    if (window.location.pathname !== '/' && window.location.pathname !== '/admin-login') {
       window.location.href = '/';
    }
    // Return a failed response to prevent the caller from hanging
    return new Response(JSON.stringify({ error: "Session expired" }), {
       status: 401,
       headers: { 'Content-Type': 'application/json' }
    });
  }

  // 3. Attach guaranteed fresh token
  const headers = new Headers(options.headers || {});
  headers.set('Authorization', `Bearer ${data.session.access_token}`);

  // 4. Execute safe request
  return fetch(url, {
    ...options,
    headers,
  });
}
