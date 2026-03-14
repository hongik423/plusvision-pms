/**
 * POST /api/v1/admin/drive-rename-all
 *
 * 모든 프로젝트의 Google Drive 파일을 넘버링 규칙에 따라 일괄 변환합니다.
 * ADMIN 전용 엔드포인트입니다.
 *
 * Body:
 *   { dryRun?: boolean }   ← 기본 true (미리보기)
 *
 * Response:
 *   {
 *     dryRun: boolean,
 *     totalProjects: number,
 *     processedProjects: number,
 *     summary: { projectNumber, projectName, totalFiles, renamed, skipped, errors }[]
 *   }
 */

import { ok } from "@/lib/api-response";
import { requireApiRole } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  // ADMIN 권한 확인
  const gate = await requireApiRole("ADMIN");
  if (!gate.ok) return gate.response;

  let dryRun = true;
  try {
    const body = await request.json().catch(() => ({}));
    if (typeof body.dryRun === "boolean") dryRun = body.dryRun;
  } catch {
    // body 없으면 기본값 유지
  }

  try {
    // 모든 프로젝트 조회 (projectNumber가 있는 것만)
    const projects = await prisma.project.findMany({
      where: {
        projectNumber: { not: "" },
      },
      select: { id: true, name: true, projectNumber: true },
      orderBy: { projectNumber: "asc" },
    });

    // projectNumber가 빈 문자열 아닌 것만 필터
    const validProjects = projects.filter((p) => p.projectNumber);

    const summary: Array<{
      projectNumber: string;
      projectName: string;
      totalFiles: number;
      renamed: number;
      skipped: number;
      errors: number;
    }> = [];

    let processedProjects = 0;

    for (const project of validProjects) {
      try {
        // 개별 프로젝트 rename API 내부 호출 (서버 사이드)
        const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";
        const res = await fetch(
          `${baseUrl}/api/v1/projects/${project.id}/drive/rename`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              cookie: request.headers.get("cookie") ?? "",
            },
            body: JSON.stringify({ dryRun }),
          },
        );

        if (res.ok) {
          const payload = await res.json();
          if (payload.success && payload.data) {
            summary.push({
              projectNumber: project.projectNumber!,
              projectName: project.name,
              totalFiles: payload.data.totalFiles,
              renamed: payload.data.renamed,
              skipped: payload.data.skipped,
              errors: payload.data.errors,
            });
            processedProjects++;
          }
        } else {
          // Drive 폴더 없는 프로젝트 등 — 건너뜀
          summary.push({
            projectNumber: project.projectNumber!,
            projectName: project.name,
            totalFiles: 0,
            renamed: 0,
            skipped: 0,
            errors: 0,
          });
        }
      } catch (err) {
        console.warn(`[DriveRenameAll] 프로젝트 ${project.projectNumber} 처리 실패:`, err);
        summary.push({
          projectNumber: project.projectNumber!,
          projectName: project.name,
          totalFiles: 0,
          renamed: 0,
          skipped: 0,
          errors: 1,
        });
      }
    }

    return ok({
      dryRun,
      totalProjects: validProjects.length,
      processedProjects,
      totalRenamed: summary.reduce((s, p) => s + p.renamed, 0),
      totalSkipped: summary.reduce((s, p) => s + p.skipped, 0),
      totalErrors: summary.reduce((s, p) => s + p.errors, 0),
      summary,
    });
  } catch (error) {
    console.error("[DriveRenameAll] 오류:", error);
    const message = error instanceof Error ? error.message : "일괄 변환 실패";
    return new Response(JSON.stringify({ success: false, error: { code: "INTERNAL_ERROR", message } }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
