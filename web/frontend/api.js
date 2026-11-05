export class ApiError extends Error {
  constructor(status, body) {
    super(body?.error?.message ?? "Something went wrong");
    this.name = "ApiError";
    this.status = status;
    this.code = body?.error?.code;
    this.details = body?.error?.details ?? [];
  }
}

/** The CDN App Bridge script patches fetch to attach the session token (S4 in specs/10-spikes.md). */
async function request(path, { method = "GET", body } = {}) {
  const response = await fetch(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(response.status, data);
  return data;
}

export const api = {
  listTimers: (params) => {
    const query = new URLSearchParams(
      Object.entries(params).filter(([, value]) => value !== "" && value != null),
    );
    return request(`/api/timers?${query}`);
  },
  createTimer: (body) => request("/api/timers", { method: "POST", body }),
  updateTimer: (id, body) => request(`/api/timers/${id}`, { method: "PUT", body }),
  deleteTimer: (id) => request(`/api/timers/${id}`, { method: "DELETE" }),
  getShop: () => request("/api/shop"),
  syncHint: () => request("/api/hint/sync", { method: "POST" }),
};
