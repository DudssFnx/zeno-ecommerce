import { QueryClient, QueryFunction } from "@tanstack/react-query";

const ACTIVE_COMPANY_KEY = "zeno_active_company_id";

function getCompanyHeaders(): Record<string, string> {
  if (typeof window !== "undefined") {
    const companyId = localStorage.getItem(ACTIVE_COMPANY_KEY);
    if (companyId) {
      return { "X-Company-Id": companyId };
    }
  }
  return {};
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const contentType = res.headers.get("content-type") || "";

    // Try to parse JSON or text without consuming the original response body
    // by using a clone. This prevents 'body stream already read' errors.
    try {
      const cloned = res.clone();
      if (contentType.includes("application/json")) {
        try {
          const json = await cloned.json();
          const msg = json?.message || json?.error || JSON.stringify(json);
          throw new Error(`${res.status}: ${msg}`);
        } catch (e) {
          // if parsing failed, fall through to text
        }
      }

      const raw = (await cloned.text()) || res.statusText;
      const stripped = raw.replace(/<[^>]*>/g, "").trim();
      const short =
        stripped.length > 300 ? stripped.slice(0, 300) + "..." : stripped;
      throw new Error(
        `${res.status}: ${res.statusText}${short ? ` - ${short}` : ""}`,
      );
    } catch (err) {
      // If clone/parsing isn't supported for some reason, fallback safely
      throw new Error(`${res.status}: ${res.statusText}`);
    }
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const headers: Record<string, string> = {
    ...getCompanyHeaders(),
    ...(data ? { "Content-Type": "application/json" } : {}),
  };

  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
      headers: getCompanyHeaders(),
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
