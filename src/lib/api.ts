import i18n from './i18n';

/**
 * Enhanced global fetch wrapper that automatically injects the active locale
 * in the `Accept-Language` header for all requests to ensure localized backend errors,
 * push notification triggers, and transactional emails.
 */
export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const activeLang = i18n.language || (typeof window !== 'undefined' ? localStorage.getItem('appLanguage') : 'fr') || 'fr';
  
  const headers = new Headers(init?.headers || {});
  
  if (!headers.has('Accept-Language')) {
    headers.set('Accept-Language', activeLang);
  }
  
  if (!headers.has('Content-Type') && !(init?.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(input, {
    ...init,
    headers,
  });

  return response;
}

/**
 * JSON Helper with localized error handling
 */
export async function fetchJson<T = any>(url: string, options?: RequestInit): Promise<T> {
  const res = await apiFetch(url, options);
  if (!res.ok) {
    let errorMsg = `HTTP ${res.status}: ${res.statusText}`;
    try {
      const jsonErr = await res.json();
      errorMsg = jsonErr.message || jsonErr.error || errorMsg;
    } catch {
      // ignore
    }
    throw new Error(errorMsg);
  }
  return res.json();
}
