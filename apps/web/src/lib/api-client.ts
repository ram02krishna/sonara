// API client for /api/v1 proxy
const API_BASE = "/api/v1";

type Params = Record<string, string | number | boolean | undefined | null>;

interface FetchOptions extends RequestInit {
  params?: Params;
}

export class ApiError extends Error {
  code: number;
  statusText: string;
  errorCode?: string;

  constructor(message: string, code: number, statusText: string, errorCode?: string) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.statusText = statusText;
    this.errorCode = errorCode;
  }
}

function buildUrl(endpoint: string, params?: Params): string {
  let url = `${API_BASE}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;
  if (params) {
    const sp = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") sp.append(k, String(v));
    });
    const qs = sp.toString();
    if (qs) url += (url.includes("?") ? "&" : "?") + qs;
  }
  return url;
}

export async function apiFetch<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const { params, headers, ...rest } = options;
  let response: Response;
  try {
    response = await fetch(buildUrl(endpoint, params), {
      ...rest,
      headers: { "Content-Type": "application/json", Accept: "application/json", ...headers },
      credentials: "include",
    });
  } catch {
    throw new ApiError("Can't reach the Sonara server. Is the API running?", 0, "Network error", "network");
  }

  if (response.status === 204) return {} as T;

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    let errorCode: string | undefined;
    try {
      const body = await response.json();
      message = body?.message || body?.error || message;
      errorCode = body?.error;
    } catch {
      /* body was not JSON */
    }
    throw new ApiError(message, response.status, response.statusText, errorCode);
  }

  return (await response.json()) as T;
}

/** JSON body helper for POST/PUT. */
export const json = (body: unknown): RequestInit => ({ body: JSON.stringify(body) });
