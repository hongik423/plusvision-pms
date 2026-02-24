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
