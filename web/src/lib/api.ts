import { NextResponse } from "next/server";
import { ZodError } from "zod";

// Error envelope matching docs/API.md.
export type ApiErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "BAD_REQUEST"
  | "RATE_LIMITED"
  | "CONFLICT"
  | "INTERNAL";

const STATUS: Record<ApiErrorCode, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  BAD_REQUEST: 400,
  RATE_LIMITED: 429,
  CONFLICT: 409,
  INTERNAL: 500,
};

export class ApiError extends Error {
  code: ApiErrorCode;
  constructor(code: ApiErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

export function apiError(code: ApiErrorCode, message: string) {
  return NextResponse.json(
    { error: { code, message, status: STATUS[code] } },
    { status: STATUS[code] },
  );
}

export function ok<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

// Wrap a route handler so thrown ApiError/ZodError become clean JSON responses.
export function handle(
  fn: (req: Request, ctx: any) => Promise<NextResponse>,
) {
  return async (req: Request, ctx: any): Promise<NextResponse> => {
    try {
      return await fn(req, ctx);
    } catch (err) {
      if (err instanceof ApiError) return apiError(err.code, err.message);
      if (err instanceof ZodError) {
        return apiError("BAD_REQUEST", err.issues.map((i) => i.message).join("; "));
      }
      console.error("[api] unhandled error", err);
      return apiError("INTERNAL", "Something went wrong");
    }
  };
}
