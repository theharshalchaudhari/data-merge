import { NextRequest } from "next/server";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:4000";

export async function GET(
  request: NextRequest,
  context: {
    params: Promise<{
      clientId: string;
      type: string;
    }>;
  },
) {
  const { clientId, type } =
    await context.params;

  if (
    !["images", "labels", "both"].includes(
      type,
    )
  ) {
    return Response.json(
      {
        message:
          "Invalid download type.",
      },
      { status: 400 },
    );
  }

  const response = await fetch(
    `${API_URL}/api/download/${clientId}/${type}`,
    {
      headers: {
        Cookie:
          request.headers.get("cookie") ?? "",
      },
      cache: "no-store",
    },
  );

  const headers = new Headers();

  for (const name of [
    "content-type",
    "content-length",
    "content-disposition",
    "cache-control",
  ]) {
    const value =
      response.headers.get(name);

    if (value) {
      headers.set(name, value);
    }
  }

  return new Response(
    response.body,
    {
      status: response.status,
      headers,
    },
  );
}