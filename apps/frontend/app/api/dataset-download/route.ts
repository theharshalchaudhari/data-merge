import { NextRequest } from "next/server";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:4000";

export async function GET(
  request: NextRequest,
) {
  const clientId =
    request.nextUrl.searchParams.get(
      "clientId",
    );

  const type =
    request.nextUrl.searchParams.get(
      "type",
    );

  if (!clientId) {
    return Response.json(
      {
        message:
          "Client ID is required.",
      },
      { status: 400 },
    );
  }

  if (
    type !== "images" &&
    type !== "labels" &&
    type !== "both"
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
          request.headers.get(
            "cookie",
          ) ?? "",
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