let memoryToken: string | null = null;

export function setAuthToken(token: string | null) {
  memoryToken = token;
  if (typeof window !== 'undefined') {
    if (token) {
      window.sessionStorage.setItem('bv_session_token', token);
    } else {
      window.sessionStorage.removeItem('bv_session_token');
    }
  }
}

export function getAuthToken(): string | null {
  if (memoryToken) return memoryToken;
  if (typeof window !== 'undefined') {
    const stored = window.sessionStorage.getItem('bv_session_token');
    if (stored) {
      memoryToken = stored;
      return stored;
    }
  }
  return null;
}

export async function apiRequest<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAuthToken();
  const headers = new Headers(options.headers || {});
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(path, {
    ...options,
    headers,
  });

  const rawText = await res.text();
  let data: any = {};
  if (rawText) {
    try {
      data = JSON.parse(rawText);
    } catch {
      if (!res.ok) {
        throw new Error(`Request failed (${res.status})`);
      }
      throw new Error('Server returned an unexpected non-JSON response.');
    }
  }
  if (!res.ok) {
    throw new Error(data?.error || `Request failed (${res.status})`);
  }
  return data as T;
}

export async function downloadSourceProjectZip(): Promise<void> {
  const token = getAuthToken();
  const headers = new Headers();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch('/api/export/source-zip', {
    method: 'GET',
    headers,
  });

  if (!res.ok) {
    let errMsg = `Failed to download ZIP (${res.status})`;
    try {
      const data = await res.json();
      if (data?.error) errMsg = data.error;
    } catch {
      // Ignore parse error
    }
    throw new Error(errMsg);
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'buildvision-ai-project.zip';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
