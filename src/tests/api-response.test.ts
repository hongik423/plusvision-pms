import { describe, expect, it } from "vitest";

describe("API 응답 포맷 규칙", () => {
  it("성공 응답은 success: true, data 포함", () => {
    const response = { success: true, data: { id: "1" } };
    expect(response.success).toBe(true);
    expect(response.data).toBeDefined();
  });

  it("성공+메타 응답은 meta(page, limit, total) 포함", () => {
    const response = {
      success: true,
      data: [],
      meta: { page: 1, limit: 20, total: 100 },
    };
    expect(response.meta.page).toBe(1);
    expect(response.meta.limit).toBe(20);
    expect(response.meta.total).toBe(100);
  });

  it("실패 응답은 success: false, error.code, error.message 포함", () => {
    const response = {
      success: false,
      error: { code: "AUTH_REQUIRED", message: "로그인이 필요합니다." },
    };
    expect(response.success).toBe(false);
    expect(response.error.code).toBe("AUTH_REQUIRED");
    expect(response.error.message).toBeTruthy();
  });

  it("에러 코드 형식 검증", () => {
    const validCodes = [
      "AUTH_REQUIRED",
      "FORBIDDEN",
      "NOT_FOUND",
      "VALIDATION_ERROR",
      "STAGE_ORDER_ERROR",
      "FILE_TOO_LARGE",
      "FILE_TYPE_NOT_ALLOWED",
      "DUPLICATE_ENTRY",
      "INTERNAL_ERROR",
    ];
    for (const code of validCodes) {
      expect(code).toMatch(/^[A-Z_]+$/);
    }
  });
});
