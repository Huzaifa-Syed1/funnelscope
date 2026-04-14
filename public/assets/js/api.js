const BASE_URL = "";

async function request(path, { method = 'GET', body, token } = {}) {
  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: body ? JSON.stringify(body) : undefined
    });

    const contentType = response.headers.get('content-type') ?? '';
    const payload = contentType.includes('application/json')
      ? await response.json()
      : null;

    if (!response.ok) {
      throw new Error(payload?.error ?? `Request failed with status ${response.status}`);
    }

    return payload;
  } catch (err) {
    console.error("API ERROR:", err);   // 👈 IMPORTANT
    throw err;
  }
}

export const api = {
  analyze(payload, token) {
    return request('/analyze', {
      method: 'POST',
      body: payload,
      token
    });
  },

  register(payload) {
    return request('/auth/register', {
      method: 'POST',
      body: payload
    });
  },

  login(payload) {
    return request('/auth/login', {
      method: 'POST',
      body: payload
    });
  },

  me(token) {
    return request('/auth/me', { token });
  },

  analyses(token, limit = 12) {
    return request(`/analysis?limit=${limit}`, { token }); // 👈 FIXED (was wrong earlier)
  }
};
