const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.PROD ? 'https://bitaudit.onrender.com' : '')
).trim().replace(/\/+$/, '');

export function buildApiUrl(path) {
  if (!path.startsWith('/')) {
    throw new Error(`API path must start with "/": ${path}`);
  }

  return API_BASE_URL ? `${API_BASE_URL}${path}` : path;
}

export async function parseApiResponse(response) {
  const contentType = response.headers.get('content-type') || '';
  const rawText = await response.text();
  const text = rawText.trim();

  if (!text) {
    return {};
  }

  if (contentType.includes('application/json')) {
    try {
      return JSON.parse(text);
    } catch {
      throw new Error('The server returned invalid JSON.');
    }
  }

  if (text.startsWith('<')) {
    throw new Error('The request was routed to a web page instead of the API.');
  }

  return { message: text };
}
