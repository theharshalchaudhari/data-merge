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

  const scope =
    request.nextUrl.searchParams.get(
      "scope",
    );

  const filePath =
    request.nextUrl.searchParams.get(
      "path",
    );

  const download =
    request.nextUrl.searchParams.get(
      "download",
    );

  if (!clientId) {
    return Response.json(
      {
        message:
          "Client ID is required.",
      },
      {
        status: 400,
      },
    );
  }

  if (
    scope !== "metadata" &&
    scope !== "raw"
  ) {
    return Response.json(
      {
        message:
          "Invalid file scope.",
      },
      {
        status: 400,
      },
    );
  }

  if (!filePath) {
    return Response.json(
      {
        message:
          "File path is required.",
      },
      {
        status: 400,
      },
    );
  }

  const backendUrl = new URL(
    `/api/download/${clientId}/file`,
    API_URL,
  );

  backendUrl.searchParams.set(
    "scope",
    scope,
  );

  backendUrl.searchParams.set(
    "path",
    filePath,
  );

  if (download === "1") {
    backendUrl.searchParams.set(
      "download",
      "1",
    );
  }

  const cookie =
    request.headers.get("cookie");

  const response = await fetch(
    backendUrl.toString(),
    {
      method: "GET",
      headers: cookie
        ? {
            Cookie: cookie,
          }
        : undefined,
      cache: "no-store",
    },
  );

  const headers =
    new Headers();

  const contentType =
    response.headers.get(
      "content-type",
    );

  const contentLength =
    response.headers.get(
      "content-length",
    );

  const contentDisposition =
    response.headers.get(
      "content-disposition",
    );

  const cacheControl =
    response.headers.get(
      "cache-control",
    );

  if (contentType) {
    headers.set(
      "Content-Type",
      contentType,
    );
  }

  if (contentLength) {
    headers.set(
      "Content-Length",
      contentLength,
    );
  }

  if (contentDisposition) {
    headers.set(
      "Content-Disposition",
      contentDisposition,
    );
  }

  if (cacheControl) {
    headers.set(
      "Cache-Control",
      cacheControl,
    );
  }

  return new Response(
    response.body,
    {
      status: response.status,
      headers,
    },
  );
}