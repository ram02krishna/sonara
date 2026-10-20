/**
 * Sonara API Client - Typesafe BFF communication with auto-failover
 */

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== "undefined" ? "/api/v1" : "http://127.0.0.1:8080/api/v1");

interface FetchOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
}

export class ApiError extends Error {
  code: number;
  statusText: string;

  constructor(message: string, code: number, statusText: string) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.statusText = statusText;
  }
}

function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem("sonara_token");
  } catch {
    return null;
  }
}

export function saveStoredToken(token: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (token) {
      localStorage.setItem("sonara_token", token);
    } else {
      localStorage.removeItem("sonara_token");
    }
  } catch {
    /* ignore */
  }
}

function buildUrl(base: string, endpoint: string, params?: Record<string, string | number | boolean | undefined>): string {
  let url = endpoint.startsWith("http")
    ? endpoint
    : `${base}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;

  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    });
    const queryString = searchParams.toString();
    if (queryString) {
      url += (url.includes("?") ? "&" : "?") + queryString;
    }
  }
  return url;
}

export async function apiFetch<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const { params, headers, ...customConfig } = options;

  const defaultHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  const storedToken = getStoredToken();
  if (storedToken) {
    defaultHeaders["Authorization"] = `Bearer ${storedToken}`;
  }

  const execute = async (targetUrl: string): Promise<Response> => {
    return fetch(targetUrl, {
      ...customConfig,
      headers: {
        ...defaultHeaders,
        ...headers,
      },
      credentials: "include", // Send session cookies to backend BFF
    });
  };

  // Determine primary URL
  const primaryUrl = buildUrl(API_BASE_URL, endpoint, params);

  let response: Response;
  try {
    response = await execute(primaryUrl);
  } catch {
    // If primary failed (e.g. localhost vs 127.0.0.1 or direct vs proxy), try alternate local URL
    let altBase = "http://127.0.0.1:8080/api/v1";
    if (API_BASE_URL.includes("127.0.0.1")) {
      altBase = "http://localhost:8080/api/v1";
    }
    const altUrl = buildUrl(altBase, endpoint, params);
    try {
      response = await execute(altUrl);
    } catch {
      // Last resort: try same-origin relative /api/v1 rewrite
      const relativeUrl = buildUrl("/api/v1", endpoint, params);
      response = await execute(relativeUrl);
    }
  }

  if (response.status === 204) {
    return {} as T;
  }

  if (!response.ok) {
    let errorMessage = `API error ${response.status}: ${response.statusText}`;
    try {
      const errorJson = await response.json();
      if (errorJson && (errorJson.message || errorJson.error)) {
        errorMessage = errorJson.message || errorJson.error;
      }
    } catch {
      // Body not JSON
    }
    throw new ApiError(errorMessage, response.status, response.statusText);
  }

  if (endpoint.includes("/auth/logout")) {
    saveStoredToken(null);
  }

  const data = await response.json();
  if (data && typeof data === "object") {
    const d = data as Record<string, unknown>;
    if (typeof d.token === "string" && d.token) {
      saveStoredToken(d.token);
    } else if (typeof d.session_id === "string" && d.session_id) {
      saveStoredToken(d.session_id);
    }
  }

  return data as T;
}
