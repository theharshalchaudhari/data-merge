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

  const scope =
    request.nextUrl.searchParams.get(
      "scope",
    );

  const filePath =
    request.nextUrl.searchParams.get(
      "path",
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
    scope !== "metadata" &&
    scope !== "raw"
  ) {
    return Response.json(
      {
        message:
          "Invalid file scope.",
      },
      { status: 400 },
    );
  }

  if (!filePath) {
    return Response.json(
      {
        message:
          "File path is required.",
      },
      { status: 400 },
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

  backendUrl.searchParams.set(
    "download",
    "1",
  );

  const response = await fetch(
    backendUrl.toString(),
    {
      method: "GET",
      headers: {
        Cookie:
          request.headers.get(
            "cookie",
          ) ?? "",
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const contentType =
      response.headers.get(
        "content-type",
      );

    if (
      contentType?.includes(
        "application/json",
      )
    ) {
      const body =
        await response
          .json()
          .catch(() => ({
            message:
              "File download failed.",
          }));

      return Response.json(
        body,
        {
          status:
            response.status,
        },
      );
    }

    return Response.json(
      {
        message:
          "File download failed.",
      },
      {
        status:
          response.status,
      },
    );
  }

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

  headers.set(
    "Cache-Control",
    "private, no-store",
  );

  return new Response(
    response.body,
    {
      status: 200,
      headers,
    },
  );
}