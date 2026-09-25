import { NextRequest } from "next/server";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:4000";

export async function GET(
  request: NextRequest,
  context: {
    params: Promise<{
      clientId: string;
    }>;
  },
) {
  const { clientId } =
    await context.params;

  const name =
    request.nextUrl.searchParams.get(
      "name",
    );

  if (!name) {
    return Response.json(
      {
        message:
          "File name is required.",
      },
      { status: 400 },
    );
  }

  const backendUrl =
    new URL(
      `/api/download/${clientId}/annotation`,
      API_URL,
    );

  backendUrl.searchParams.set(
    "name",
    name,
  );

  const response = await fetch(
    backendUrl,
    {
      headers: {
        Cookie:
          request.headers.get("cookie") ?? "",
      },
      cache: "no-store",
    },
  );

  const contentType =
    response.headers.get(
      "content-type",
    );

  const body =
    await response.arrayBuffer();

  return new Response(body, {
    status: response.status,
    headers: {
      "Content-Type":
        contentType ??
        "application/json",
      "Cache-Control":
        "private, no-store",
    },
  });
}