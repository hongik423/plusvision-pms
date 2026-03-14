"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { STAGE_NAMES, STAGE_DESCRIPTIONS, DOCUMENT_TYPE_LABELS, PROJECT_STATUS_LABELS } from "@/lib/constants";
import { useToastStore } from "@/store/toast-store";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { DriveStageFile } from "@/app/(protected)/projects/[id]/project-detail-client";

type StageData = {
  id: string;
  stageNumber: number;
  stageName: string;
  status: "INACTIVE" | "ACTIVE" | "COMPLETED" | "SKIPPED";
  assigneeId: string | null;
  assignee: { id: string; name: string } | null;
  startDate: string | null;
  completedDate: string | null;
  notes: string | null;
};

type StageDoc = {
  id: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  version: number;
  documentType: string;
  description: string | null;
  storageType: string;
  createdAt: string;
};

type UserOption = { id: string; name: string };

type Props = {
  projectId: string;
  stage: StageData;
  canManage: boolean;
  isAssignee: boolean;
  users: UserOption[];
  onRefresh: () => void;
  /** Drive에서 직접 조회한 파일 (부모 컴포넌트에서 전달) */
  driveFiles?: DriveStageFile[];
  /** Drive 파일 로딩 중 여부 */
  driveLoading?: boolean;
  /** 동기화 완료 시 문서 목록 재조회 트리거 */
  docsRefreshTrigger?: number;
};

const STATUS_LABEL: Record<StageData["status"], string> = {
  INACTIVE: "대기",
  ACTIVE: "진행중",
  COMPLETED: "완료",
  SKIPPED: "건너뜀",
};

function formatBytes(bytes: number) {
  if (!bytes || bytes === 0) return "—";
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("ko-KR");
}

function getFileIcon(fileName: string, mimeType: string) {
  if (mimeType.startsWith("image/")) return "🖼️";
  if (fileName.endsWith(".pdf") || mimeType === "application/pdf") return "📄";
  if (/\.(xlsx?|xls)$/i.test(fileName) || mimeType.includes("spreadsheet")) return "📊";
  if (/\.(docx?|hwp)$/i.test(fileName) || mimeType.includes("document")) return "📝";
  if (/\.(pptx?|ppt)$/i.test(fileName) || mimeType.includes("presentation")) return "📊";
  if (/\.(dwg|dxf)$/i.test(fileName)) return "📐";
  return "📎";
}

export function StagePanel({
  projectId,
  stage,
  canManage,
  isAssignee,
  users,
  onRefresh,
  driveFiles = [],
  driveLoading = false,
  docsRefreshTrigger = 0,
}: Props) {
  const toast = useToastStore();
  const [open, setOpen] = useState(
    stage.status === "COMPLETED" || stage.status === "ACTIVE",
  );
  const [assigneeId, setAssigneeId] = useState(stage.assigneeId ?? "");
  const [notes, setNotes] = useState(stage.notes ?? "");
  const [saving, setSaving] = useState(false);

  // ── DB 문서 (StageDocument) ──
  const [docs, setDocs] = useState<StageDoc[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [docsFetched, setDocsFetched] = useState(false);

  const fetchDocs = useCallback(async () => {
    if (docsFetched) return;
    setDocsLoading(true);
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/stages/${stage.stageNumber}`);
      const payload = await res.json();
      if (payload.success && payload.data?.documents) {
        setDocs(payload.data.documents);
      }
    } catch {
      // 조회 실패 시 빈 배열 유지
    } finally {
      setDocsLoading(false);
      setDocsFetched(true);
    }
  }, [projectId, stage.stageNumber, docsFetched]);

  // docsRefreshTrigger 변경 시 문서 캐시 무효화 (동기화 완료 후 재조회)
  useEffect(() => {
    if (docsRefreshTrigger > 0) {
      setDocsFetched(false);
    }
  }, [docsRefreshTrigger]);

  useEffect(() => {
    if (open && !docsFetched) {
      void fetchDocs();
    }
  }, [open, docsFetched, fetchDocs]);

  const canComplete = (canManage || isAssignee) && stage.status === "ACTIVE";
  const canAssign = canManage;

  // 전체 문서 수 (DB + Drive)
  const totalDocCount = docs.length + driveFiles.length;

  const statusBg =
    stage.status === "COMPLETED"
      ? "bg-green-500 text-white"
      : stage.status === "ACTIVE"
      ? "bg-blue-500 text-white animate-pulse"
      : "bg-gray-200 text-gray-600";

  async function handleAssign() {
    if (!assigneeId) { toast.warning("담당자를 선택해 주세요."); return; }
    setSaving(true);
    const res = await fetch(`/api/v1/projects/${projectId}/stages/${stage.stageNumber}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assigneeId }),
    });
    const payload = await res.json();
    setSaving(false);
    if (!payload.success) { toast.error(payload.error?.message ?? "담당자 지정에 실패했습니다."); return; }
    toast.success(`${stage.stageNumber}단계 담당자를 지정했습니다.`);
    onRefresh();
  }

  async function handleComplete(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch(`/api/v1/projects/${projectId}/stages/${stage.stageNumber}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: notes || undefined, status: "COMPLETED" }),
    });
    const payload = await res.json();
    setSaving(false);
    if (!payload.success) { toast.error(payload.error?.message ?? "단계 완료 처리에 실패했습니다."); return; }
    toast.success(`${stage.stageNumber}단계를 완료했습니다!`);
    setOpen(false);
    onRefresh();
  }

  async function handleHoldOrCancel(projectStatus: "HOLD" | "CANCELLED") {
    const res = await fetch(`/api/v1/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: projectStatus }),
    });
    const payload = await res.json();
    if (!payload.success) { toast.error("상태 변경에 실패했습니다."); return; }
    toast.success(`프로젝트를 ${PROJECT_STATUS_LABELS[projectStatus]}으로 변경했습니다.`);
    onRefresh();
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-white">
      {/* 단계 헤더 버튼 */}
      <button
        type="button"
        className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 ${open ? "bg-slate-50" : ""}`}
        onClick={() => setOpen((p) => !p)}
      >
        <span className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${statusBg}`}>
          {stage.status === "COMPLETED" ? "✓" : stage.stageNumber}
        </span>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">
            {stage.stageNumber}단계 — {STAGE_NAMES[stage.stageNumber]}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            담당: {stage.assignee?.name ?? "미지정"} · {STATUS_LABEL[stage.status]}
            {totalDocCount > 0 && (
              <span className="ml-1 text-blue-500">· 문서 {totalDocCount}건</span>
            )}
          </p>
        </div>
        <span className="text-slate-400 text-sm">{open ? "▲" : "▼"}</span>
      </button>

      {/* 상세 패널 */}
      {open && (
        <div className="border-t px-4 py-4 space-y-4 bg-slate-50">
          {/* 설명 */}
          <p className="text-sm text-slate-600">{STAGE_DESCRIPTIONS[stage.stageNumber]}</p>

          {/* 날짜 정보 */}
          <div className="grid grid-cols-2 gap-3 text-xs text-slate-500">
            <div>
              <span className="font-semibold">시작일</span>
              <p>{stage.startDate ? new Date(stage.startDate).toLocaleDateString("ko-KR") : "—"}</p>
            </div>
            <div>
              <span className="font-semibold">완료일</span>
              <p>{stage.completedDate ? new Date(stage.completedDate).toLocaleDateString("ko-KR") : "—"}</p>
            </div>
          </div>

          {/* 메모 */}
          {stage.notes && (
            <div className="rounded bg-white border px-3 py-2 text-sm text-slate-600">
              <span className="text-xs font-semibold text-slate-400 block mb-1">메모</span>
              {stage.notes}
            </div>
          )}

          {/* ── Google Drive 문서 (실시간 조회) ──────────────── */}
          {(driveFiles.length > 0 || driveLoading) && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-semibold text-green-700 flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
                  Google Drive 문서
                </span>
                <span className="text-[10px] text-slate-400">({driveFiles.length}건)</span>
              </div>

              {driveLoading ? (
                <div className="flex items-center gap-2 py-3 text-xs text-slate-400">
                  <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-green-500" />
                  Drive 파일 조회 중...
                </div>
              ) : (
                <ul className="space-y-1.5">
                  {driveFiles.map((file) => (
                    <li
                      key={file.id}
                      className="flex items-center gap-2.5 rounded-lg border border-green-100 bg-white px-3 py-2 hover:bg-green-50 transition-colors"
                    >
                      <span className="text-lg flex-shrink-0">
                        {getFileIcon(file.fileName, file.mimeType)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <a
                          href={file.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-semibold text-slate-700 hover:text-green-600 hover:underline truncate block"
                          title={file.relativePath ? `경로: ${file.relativePath}/${file.fileName}` : file.fileName}
                        >
                          {file.fileName}
                        </a>
                        <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-slate-400">
                          <span className="rounded bg-green-100 px-1 py-0.5 text-green-700 font-medium">
                            Drive
                          </span>
                          <span className="rounded bg-blue-100 px-1 py-0.5 text-blue-700">
                            {DOCUMENT_TYPE_LABELS[file.documentType as keyof typeof DOCUMENT_TYPE_LABELS] ?? file.documentType}
                          </span>
                          {file.relativePath && (
                            <span className="text-slate-300 truncate max-w-[120px]" title={file.relativePath}>
                              📂 {file.relativePath}
                            </span>
                          )}
                          <span>{formatBytes(file.fileSize)}</span>
                          {file.modifiedTime && (
                            <span>{formatDate(file.modifiedTime)}</span>
                          )}
                        </div>
                      </div>
                      <a
                        href={file.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-shrink-0 rounded border border-green-300 bg-green-50 px-2 py-1 text-[10px] font-medium text-green-700 hover:bg-green-100"
                      >
                        열기
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* ── DB 문서 (Supabase 동기화 완료) ──────────────── */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-full bg-blue-500" />
                  시스템 문서
                </span>
                {docs.length > 0 && <span className="text-[10px] text-slate-400">({docs.length}건)</span>}
              </div>
              {docsFetched && (
                <button
                  type="button"
                  onClick={() => { setDocsFetched(false); void fetchDocs(); }}
                  className="text-xs text-blue-500 hover:underline"
                >
                  새로고침
                </button>
              )}
            </div>

            {docsLoading ? (
              <div className="flex items-center gap-2 py-3 text-xs text-slate-400">
                <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-blue-500" />
                문서 조회 중...
              </div>
            ) : docs.length === 0 && driveFiles.length === 0 ? (
              <div className="rounded border border-dashed bg-white py-4 text-center text-xs text-slate-400">
                등록된 문서가 없습니다
              </div>
            ) : docs.length === 0 ? null : (
              <ul className="space-y-1.5">
                {docs.map((doc) => (
                  <li
                    key={doc.id}
                    className="flex items-center gap-2.5 rounded-lg border bg-white px-3 py-2 hover:bg-blue-50 transition-colors"
                  >
                    <span className="text-lg flex-shrink-0">
                      {getFileIcon(doc.fileName, doc.mimeType)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <a
                        href={doc.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-semibold text-slate-700 hover:text-blue-600 hover:underline truncate block"
                      >
                        {doc.fileName}
                      </a>
                      <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-slate-400">
                        <span className="rounded bg-blue-100 px-1 py-0.5 text-blue-700">
                          {DOCUMENT_TYPE_LABELS[doc.documentType as keyof typeof DOCUMENT_TYPE_LABELS] ?? doc.documentType}
                        </span>
                        <span className="rounded bg-indigo-100 px-1 py-0.5 text-indigo-700 font-bold">
                          v{doc.version}
                        </span>
                        {doc.storageType === "GOOGLE_DRIVE" && (
                          <span className="rounded bg-green-100 px-1 py-0.5 text-green-700">Drive</span>
                        )}
                        <span>{formatBytes(doc.fileSize)}</span>
                        <span>{new Date(doc.createdAt).toLocaleDateString("ko-KR")}</span>
                      </div>
                    </div>
                    <a
                      href={doc.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-shrink-0 rounded border px-2 py-1 text-[10px] font-medium hover:bg-slate-100"
                    >
                      열기
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* 담당자 지정 (MANAGER/ADMIN만) */}
          {canAssign && stage.status !== "COMPLETED" && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-500">담당자 지정</p>
              <div className="flex gap-2">
                <select
                  className="h-10 flex-1 rounded border px-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(e.target.value)}
                >
                  <option value="">담당자 선택</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={saving || !assigneeId}
                  onClick={() => void handleAssign()}
                  className="h-10 rounded bg-indigo-600 px-4 text-sm font-semibold text-white disabled:opacity-60"
                >
                  지정
                </button>
              </div>
            </div>
          )}

          {/* 단계 완료 처리 */}
          {canComplete && (
            <form onSubmit={handleComplete} className="space-y-2">
              <p className="text-xs font-semibold text-slate-500">단계 완료 처리</p>
              <textarea
                className="w-full rounded border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="완료 메모 (선택사항)"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
              <button
                type="submit"
                disabled={saving}
                className="h-10 rounded bg-green-600 px-4 text-sm font-semibold text-white disabled:opacity-60"
              >
                {saving ? "처리 중..." : `${stage.stageNumber}단계 완료`}
              </button>
            </form>
          )}

          {/* 4단계: 보류/취소 옵션 */}
          {stage.stageNumber === 4 && canManage && stage.status === "ACTIVE" && (
            <div className="flex gap-2 pt-1">
              <ConfirmDialog
                trigger={
                  <button type="button" className="h-9 rounded border border-amber-300 px-3 text-sm font-medium text-amber-700 hover:bg-amber-50">
                    보류
                  </button>
                }
                title="프로젝트 보류"
                description="이 프로젝트를 보류 상태로 변경합니다."
                confirmLabel="보류"
                onConfirm={() => handleHoldOrCancel("HOLD")}
              />
              <ConfirmDialog
                trigger={
                  <button type="button" className="h-9 rounded border border-red-300 px-3 text-sm font-medium text-red-700 hover:bg-red-50">
                    취소
                  </button>
                }
                title="프로젝트 취소"
                description="이 프로젝트를 취소합니다. 이 작업은 되돌릴 수 없습니다."
                confirmLabel="취소 확정"
                variant="danger"
                onConfirm={() => handleHoldOrCancel("CANCELLED")}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
