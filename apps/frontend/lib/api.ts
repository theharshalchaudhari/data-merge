const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:4000";

export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const isFormData =
    options.body instanceof FormData;

  const response = await fetch(
    `${API_URL}${path}`,
    {
      ...options,
      credentials: "include",

      headers: {
        ...(isFormData
          ? {}
          : {
              "Content-Type": "application/json",
            }),
        ...(options.headers ?? {}),
      },

      cache: "no-store",
    },
  );

  const contentType =
    response.headers.get("content-type");

  const body = contentType?.includes(
    "application/json",
  )
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message =
      typeof body === "object" &&
      body !== null &&
      "message" in body
        ? String(body.message)
        : typeof body === "string" &&
            body.trim()
          ? body
          : "Request failed.";

    throw new Error(message);
  }

  return body as T;
}

export { API_URL };