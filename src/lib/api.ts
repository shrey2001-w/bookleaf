import { NextRequest, NextResponse } from "next/server";
import { ZodError, ZodSchema } from "zod";
import { Types } from "mongoose";
import { connectDb } from "./db";

/** Typed error that maps 1:1 onto an HTTP response. */
export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) {
    super(message);
  }
}
export const unauthorized = (m = "Authentication required") => new ApiError(401, "unauthorized", m);
export const forbidden = (m = "You do not have access to this resource") => new ApiError(403, "forbidden", m);
export const notFound = (m = "Resource not found") => new ApiError(404, "not_found", m);
export const badRequest = (m: string, details?: unknown) => new ApiError(400, "bad_request", m, details);

type Ctx = { params: Record<string, string> };
type Handler = (req: NextRequest, ctx: Ctx) => Promise<Response>;

/** Wraps a route handler: connects to Mongo and converts every thrown error into a structured JSON response. */
export function route(handler: Handler) {
  return async (req: NextRequest, ctx: Ctx) => {
    try {
      await connectDb();
      return await handler(req, ctx);
    } catch (e) {
      return errorResponse(e);
    }
  };
}

export function errorResponse(e: unknown) {
  if (e instanceof ApiError) {
    return NextResponse.json({ error: { code: e.code, message: e.message, details: e.details } }, { status: e.status });
  }
  if (e instanceof ZodError) {
    const details = e.issues.map((i) => ({ field: i.path.join("."), message: i.message }));
    return NextResponse.json(
      { error: { code: "validation_error", message: details[0]?.message ?? "Request validation failed", details } },
      { status: 422 }
    );
  }
  console.error("[api] unhandled error:", e);
  const isDb = e instanceof Error && /Mongo|ECONNREFUSED|buffering timed out/i.test(e.message + e.name);
  return NextResponse.json(
    {
      error: {
        code: isDb ? "database_unavailable" : "internal_error",
        message: isDb ? "Database is unavailable, please retry shortly" : "Something went wrong on our side",
      },
    },
    { status: isDb ? 503 : 500 }
  );
}

export async function parseBody<T>(req: NextRequest, schema: ZodSchema<T>): Promise<T> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw badRequest("Request body must be valid JSON");
  }
  return schema.parse(body);
}

export function parseQuery<T>(req: NextRequest, schema: ZodSchema<T>): T {
  return schema.parse(Object.fromEntries(req.nextUrl.searchParams));
}

export function objectId(id: string, label = "id"): Types.ObjectId {
  if (!Types.ObjectId.isValid(id)) throw badRequest(`Invalid ${label}`);
  return new Types.ObjectId(id);
}

export const json = <T,>(data: T, status = 200) => NextResponse.json(data, { status });
