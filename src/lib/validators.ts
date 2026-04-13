import { z } from "zod";

export const createProjectSchema = z.object({
  name: z.string().min(1, "프로젝트명은 필수입니다."),
  description: z.string().optional(),
  customerId: z.string().min(1),
  siteId: z.string().min(1),
  processTypeId: z.string().min(1),
  itemTypeId: z.string().min(1),
  startDate: z.string().optional(),
  dueDate: z.string().optional(),
  copyFromId: z.string().optional(),
});

export const assignStageSchema = z.object({
  assigneeId: z.string().min(1, "담당자를 선택해 주세요."),
});

export const updateStageDatesSchema = z.object({
  startDate: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
});

export const completeStageSchema = z.object({
  notes: z.string().optional(),
  status: z.enum(["COMPLETED", "SKIPPED"]).default("COMPLETED"),
});

export const createEstimateSchema = z.object({
  title: z.string().min(1),
  notes: z.string().optional(),
  items: z
    .array(
      z.object({
        partSpecId: z.string().optional(),
        itemName: z.string().min(1),
        specification: z.string().optional(),
        unit: z.string().min(1),
        quantity: z.number().positive(),
        unitPrice: z.number().nonnegative(),
        remarks: z.string().optional(),
      }),
    )
    .min(1),
});

// ── [N01] 프로젝트 업데이트 스키마: 허용 필드 명시적 제한 ──
export const updateProjectSchema = z.object({
  name: z.string().min(1, "프로젝트명은 필수입니다.").optional(),
  description: z.string().optional(),
  dueDate: z.string().refine(
    (v) => !v || !isNaN(new Date(v).getTime()),
    { message: "유효하지 않은 날짜 형식입니다." }
  ).optional(),
  completedDate: z.string().refine(
    (v) => !v || !isNaN(new Date(v).getTime()),
    { message: "유효하지 않은 날짜 형식입니다." }
  ).optional(),
  status: z.enum(["PENDING", "ACTIVE", "COMPLETED", "HOLD", "CANCELLED"]).optional(),
}).strict(); // strict: 정의되지 않은 필드 전달 시 에러

// ── [N02] 견적서 업데이트 스키마: 허용 필드 명시적 제한 ──
export const updateEstimateSchema = z.object({
  title: z.string().min(1).optional(),
  notes: z.string().optional(),
  status: z.enum(["DRAFT", "SUBMITTED", "APPROVED"]).optional(),
}).strict();

// ── [N09] DocumentType 검증 스키마 ──
export const documentTypeSchema = z.enum([
  "PROPOSAL", "ESTIMATE", "MANUFACTURE_MANUAL", "INSTALL_MANUAL",
  "PARTS_LIST", "SITE_PHOTO", "DRAWING", "MEETING_NOTE",
  "EXPORT_RECORD", "OTHER",
]);

// ── [N07] stageNumber 검증 헬퍼 ──
export function parseStageNumber(raw: string): { ok: true; value: number } | { ok: false; message: string } {
  const num = Number(raw);
  if (!Number.isInteger(num) || num < 1 || num > 10) {
    return { ok: false, message: "유효하지 않은 단계 번호입니다. (1~10 정수)" };
  }
  return { ok: true, value: num };
}

// ── Drive 폴더 연결 스키마 ──
export const linkDriveFolderSchema = z.object({
  driveFolderId: z.string().min(1, "Drive 폴더 ID가 필요합니다."),
  folderName:    z.string().optional(),
  stageNumber:   z.number().int().min(1).max(10).optional(),
  recursive:     z.boolean().optional().default(false),
});

// ── Drive 동기화 요청 스키마 ──
export const driveSyncSchema = z.object({
  linkId:      z.string().optional(),
  recursive:   z.boolean().optional().default(false),
  forceResync: z.boolean().optional().default(false),
});

export const createManualSchema = z.object({
  type: z.enum(["MANUFACTURE", "INSTALL"]),
  title: z.string().min(1, "제목은 필수입니다."),
  content: z.string().min(1, "내용은 필수입니다."),
});

export const updateManualSchema = z.object({
  title: z.string().min(1).optional(),
  content: z.string().min(1).optional(),
});

export const signupSchema = z.object({
  email: z.string().email("유효한 이메일을 입력해 주세요."),
  name: z.string().min(1, "이름은 필수입니다."),
  password: z.string().min(8, "비밀번호는 8자 이상이어야 합니다."),
  department: z.string().optional(),
  phone: z.string().optional(),
});

export const passwordResetRequestSchema = z.object({
  email: z.string().email("유효한 이메일을 입력해 주세요."),
});

export const templateTypeSchema = z.enum(["ESTIMATE", "PROPOSAL"]);

export const createTemplateSchema = z.object({
  type: templateTypeSchema,
  name: z.string().min(1, "템플릿 이름은 필수입니다."),
  titleTemplate: z.string().min(1, "제목 템플릿은 필수입니다."),
  bodyTemplate: z.string().min(1, "본문 템플릿은 필수입니다."),
});

export const updateTemplateSchema = z.object({
  name: z.string().min(1).optional(),
  titleTemplate: z.string().min(1).optional(),
  bodyTemplate: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
});
