import { NextResponse } from "next/server";

type ApiError = {
  code: string;
  message: string;
  details?: unknown;
};

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ success: true, data }, init);
}

export function okWithMeta<T>(
  data: T,
  meta: { page: number; limit: number; total: number },
  init?: ResponseInit,
) {
  return NextResponse.json({ success: true, data, meta }, init);
}

export function fail(error: ApiError, status = 400) {
  return NextResponse.json({ success: false, error }, { status });
}
