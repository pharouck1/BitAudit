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
