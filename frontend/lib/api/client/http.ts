import { isDemoSessionActive } from "../../demo/session.ts";

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080"
).replace(/\/+$/, "");

interface ApiErrorBody {
  code?: string;
  message?: string;
}

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

export async function apiGet<T>(path: string, signal?: AbortSignal): Promise<T> {
	return apiRequest<T>(path, { method: "GET", signal });
}

interface ApiRequestOptions {
	method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
	body?: unknown;
	signal?: AbortSignal;
}

interface CsrfResponse {
	token: string;
	headerName: string;
}

let csrfTokenPromise: Promise<CsrfResponse> | null = null;

export function resetCsrfToken() {
	csrfTokenPromise = null;
}

async function getCsrfToken(): Promise<CsrfResponse> {
	csrfTokenPromise ??= fetch(`${API_BASE_URL}/api/v1/auth/csrf`, {
		method: "GET",
		credentials: "include",
		headers: { Accept: "application/json" },
	}).then(async (response) => {
		if (!response.ok) throw new ApiError("CSRF_TOKEN_FAILED", "보안 토큰을 준비하지 못했습니다.", response.status);
		return response.json() as Promise<CsrfResponse>;
	}).catch((error) => {
		resetCsrfToken();
		throw error;
	});
	return csrfTokenPromise;
}

export async function apiRequest<T>(
	path: string,
	options: ApiRequestOptions = {},
): Promise<T> {
	if (isDemoSessionActive()) {
		throw new ApiError(
			"DEMO_API_ACCESS_BLOCKED",
			"데모 모드에서는 실제 계정 데이터에 접근하지 않습니다.",
			403,
		);
	}
	return apiRequestAttempt<T>(path, options, true);
}

async function apiRequestAttempt<T>(
	path: string,
	options: ApiRequestOptions,
	allowCsrfRetry: boolean,
): Promise<T> {
	const method = options.method ?? "GET";
	const csrf = method === "GET" ? null : await getCsrfToken();
	const response = await fetch(`${API_BASE_URL}${path}`, {
		method,
		credentials: "include",
		headers: {
			Accept: "application/json",
			...(options.body === undefined ? {} : { "Content-Type": "application/json" }),
			...(csrf ? { [csrf.headerName]: csrf.token } : {}),
		},
		body: options.body === undefined ? undefined : JSON.stringify(options.body),
		signal: options.signal,
	});

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ApiErrorBody | null;
		if (
			method !== "GET" &&
			allowCsrfRetry &&
			response.status === 403 &&
			body?.code === "ACCESS_DENIED"
		) {
			resetCsrfToken();
			return apiRequestAttempt<T>(path, options, false);
		}
    if (
      response.status === 401 &&
      typeof window !== "undefined" &&
      !path.startsWith("/api/v1/auth/")
    ) {
      const returnUrl = `${window.location.pathname}${window.location.search}`;
      window.location.replace(
        `/login?oauthError=${body?.code === "GITLAB_RECONNECT_REQUIRED" ? "reconnect_required" : "session_expired"}&returnUrl=${encodeURIComponent(returnUrl)}`,
      );
    }
    throw new ApiError(
      body?.code ?? "API_REQUEST_FAILED",
      body?.message ?? "백엔드 요청을 처리하지 못했습니다.",
      response.status,
    );
  }

	if (response.status === 204) return undefined as T;
	return response.json() as Promise<T>;
}
