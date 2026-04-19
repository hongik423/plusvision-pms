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
  dueDate: string | null;
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
  /** 해당 단계 매핑된 문서 저장 (Drive → 시스템) */
  onSyncStage?: (stageNumber: number) => Promise<void>;
  /** 매핑된 문서 저장 진행 중 (버튼 비활성화) */
  syncing?: boolean;
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

function renderStageTrafficLight(stage: StageData) {
  if (!stage.startDate || !stage.dueDate) return null;
  if (stage.status === "COMPLETED" || stage.status === "SKIPPED") return null;

  const due = new Date(stage.dueDate);
  due.setHours(0, 0, 0, 0);

  let isRed = false;
  let isYellow = false;
  let isGreen = false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  isGreen = diff >= 3;
  isYellow = diff >= 0 && diff <= 2;
  isRed = diff < 0;

  return (
    <span className="flex items-center gap-2.5 px-3.5 py-2 rounded-2xl border-2 border-gray-700 bg-gray-900 text-white shadow-sm">
      <span className={`inline-block h-6 w-6 rounded-full ${isRed ? "bg-red-500 shadow-[0_0_10px_4px_rgba(239,68,68,0.8)]" : "bg-gray-700"}`} />
      <span className={`inline-block h-6 w-6 rounded-full ${isYellow ? "bg-yellow-400 shadow-[0_0_10px_4px_rgba(250,204,21,0.8)]" : "bg-gray-700"}`} />
      <span className={`inline-block h-6 w-6 rounded-full ${isGreen ? "bg-green-500 shadow-[0_0_10px_4px_rgba(34,197,94,0.8)]" : "bg-gray-700"}`} />
    </span>
  );
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
  onSyncStage,
  syncing = false,
}: Props) {
  const toast = useToastStore();
  const [open, setOpen] = useState(
    stage.status === "COMPLETED" || stage.status === "ACTIVE",
  );
  const [assigneeId, setAssigneeId] = useState(stage.assigneeId ?? "");
  const [notes, setNotes] = useState(stage.notes ?? "");
  const [saving, setSaving] = useState(false);

  // ── 파일 업로드 ──
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadDocType, setUploadDocType] = useState("");
  const [uploading, setUploading] = useState(false);
  const [startDateInput, setStartDateInput] = useState(
    stage.startDate ? new Date(stage.startDate).toISOString().split("T")[0] : ""
  );
  const [dueDateInput, setDueDateInput] = useState(
    stage.dueDate ? new Date(stage.dueDate).toISOString().split("T")[0] : ""
  );
  const [dateSaving, setDateSaving] = useState(false);

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
  const missingRequiredFields = [
    !stage.startDate && "시작일",
    !stage.dueDate && "완료 예정일",
    !stage.assigneeId && "담당자",
  ].filter(Boolean) as string[];
  const canCompleteButton = canComplete && missingRequiredFields.length === 0;

  // ── 동기화된 Drive 파일은 "시스템 문서"에 이미 있으므로 Drive 섹션에서 제외 ──
  // DB 문서 중 storageType=GOOGLE_DRIVE인 파일명 Set
  const syncedFileNames = new Set(
    docs
      .filter((d) => d.storageType === "GOOGLE_DRIVE")
      .map((d) => d.fileName),
  );
  // Drive 파일 중 아직 DB에 없는 것만 (미동기화)
  const unsyncedDriveFiles = driveFiles.filter(
    (f) => !syncedFileNames.has(f.fileName),
  );
  // DB 문서 중 Drive에서 가져온 것 (storageType=GOOGLE_DRIVE)
  const syncedDriveDocs = docs.filter((d) => d.storageType === "GOOGLE_DRIVE");
  // DB 문서 중 직접 업로드한 것
  const uploadedDocs = docs.filter((d) => d.storageType !== "GOOGLE_DRIVE");

  // 전체 문서 수 (DB + 미동기화 Drive)
  const totalDocCount = docs.length + unsyncedDriveFiles.length;

  const statusBg =
    stage.status === "COMPLETED"
      ? "bg-green-500 text-white"
      : stage.status === "ACTIVE"
      ? "bg-blue-500 text-white animate-pulse"
      : "bg-gray-200 text-gray-600";

  async function handleUpload() {
    if (!uploadFile) { toast.warning("파일을 선택해 주세요."); return; }
    setUploading(true);
    const form = new FormData();
    form.append("file", uploadFile);
    form.append("stageNumber", String(stage.stageNumber));
    form.append("documentType", uploadDocType);
    const res = await fetch(`/api/v1/projects/${projectId}/documents`, {
      method: "POST",
      body: form,
    });
    const payload = await res.json();
    setUploading(false);
    if (!payload.success) { toast.error(payload.error?.message ?? "업로드에 실패했습니다."); return; }
    toast.success("파일이 등록되었습니다.");
    setUploadFile(null);
    setDocsFetched(false);
    void fetchDocs();
  }

  async function handleSaveDates() {
    setDateSaving(true);
    const res = await fetch(`/api/v1/projects/${projectId}/stages/${stage.stageNumber}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startDate: startDateInput || null,
        dueDate: dueDateInput || null,
      }),
    });
    const payload = await res.json();
    setDateSaving(false);
    if (!payload.success) { toast.error("날짜 저장에 실패했습니다."); return; }
    toast.success("날짜를 저장했습니다.");
    onRefresh();
  }

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
          <p className="font-semibold text-sm truncate leading-tight">
            {stage.stageNumber}단계 — {STAGE_NAMES[stage.stageNumber]}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            담당: {stage.assignee?.name ?? "미지정"} · {STATUS_LABEL[stage.status]}
            {totalDocCount > 0 && (
              <span className="ml-1 text-blue-500">· 문서 {totalDocCount}건</span>
            )}
          </p>
        </div>
        <div className="flex-shrink-0">
          {renderStageTrafficLight(stage)}
        </div>
        <span className="text-slate-400 text-sm">{open ? "▲" : "▼"}</span>
      </button>

      {/* 상세 패널 */}
      {open && (
        <div className="border-t px-4 py-4 space-y-4 bg-slate-50">
          {/* 설명 */}
          <p className="text-sm text-slate-600">{STAGE_DESCRIPTIONS[stage.stageNumber]}</p>

          {/* 날짜 정보 */}
          {stage.status !== "COMPLETED" && stage.status !== "SKIPPED" && (canManage || isAssignee) ? (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs">
                  <span className="font-semibold text-slate-500 block mb-1">시작일</span>
                  <input
                    type="date"
                    value={startDateInput}
                    onChange={(e) => setStartDateInput(e.target.value)}
                    className="h-9 w-full rounded border px-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </label>
                <label className="text-xs">
                  <span className="font-semibold text-slate-500 block mb-1">완료 예정일</span>
                  <input
                    type="date"
                    value={dueDateInput}
                    min={startDateInput || undefined}
                    onChange={(e) => setDueDateInput(e.target.value)}
                    className="h-9 w-full rounded border px-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </label>
              </div>
              <button
                type="button"
                onClick={() => void handleSaveDates()}
                disabled={dateSaving}
                className="rounded bg-slate-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60 hover:bg-slate-800"
              >
                {dateSaving ? "저장 중..." : "날짜 저장"}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3 text-xs text-slate-500">
                <div>
                  <span className="font-semibold">시작일</span>
                  <p>{stage.startDate ? new Date(stage.startDate).toLocaleDateString("ko-KR") : "—"}</p>
                </div>
                <div>
                  <span className="font-semibold">완료 예정일</span>
                  <p>{stage.dueDate ? new Date(stage.dueDate).toLocaleDateString("ko-KR") : "—"}</p>
                </div>
                <div>
                  <span className="font-semibold">완료일</span>
                  <p>
                    {stage.completedDate ? new Date(stage.completedDate).toLocaleDateString("ko-KR") : "—"}
                    {stage.completedDate && stage.dueDate && (() => {
                      const diff = Math.round(
                        (new Date(stage.completedDate).getTime() - new Date(stage.dueDate).getTime())
                        / (1000 * 60 * 60 * 24)
                      );
                      const diffLabel = diff === 0 ? null : diff > 0 ? `+${diff}일` : `${diff}일`;
                      return diffLabel ? (
                        <span className={`ml-1.5 text-[10px] font-semibold ${diff >= 5 ? "text-red-500" : diff > 0 ? "text-yellow-600" : "text-blue-500"}`}>
                          ({diffLabel})
                        </span>
                      ) : null;
                    })()}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 메모 */}
          {stage.notes && (
            <div className="rounded bg-white border px-3 py-2 text-sm text-slate-600">
              <span className="text-xs font-semibold text-slate-400 block mb-1">메모</span>
              {stage.notes}
            </div>
          )}

          {/* ── Google Drive 문서 (미동기화 파일만 표시) ──────────────── */}
          {(unsyncedDriveFiles.length > 0 || (driveLoading && driveFiles.length > 0)) && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-semibold text-amber-700 flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-full bg-amber-400" />
                  Drive 미동기화 파일
                </span>
                {!driveLoading && (
                  <span className="text-[10px] text-slate-400">({unsyncedDriveFiles.length}건 — 시스템 저장 후 영구 보관)</span>
                )}
              </div>

              {driveLoading ? (
                <div className="flex items-center gap-2 py-3 text-xs text-slate-400">
                  <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-green-500" />
                  Drive 파일 조회 중...
                </div>
              ) : (
                <ul className="space-y-1.5">
                  {unsyncedDriveFiles.map((file) => (
                    <li
                      key={file.id}
                      className="flex items-center gap-2.5 rounded-lg border border-amber-100 bg-amber-50/50 px-3 py-2 hover:bg-amber-50 transition-colors"
                    >
                      <span className="text-lg flex-shrink-0">
                        {getFileIcon(file.fileName, file.mimeType)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <a
                          href={file.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-semibold text-slate-700 hover:text-amber-700 hover:underline truncate block"
                          title={file.relativePath ? `경로: ${file.relativePath}/${file.fileName}` : file.fileName}
                        >
                          {file.fileName}
                        </a>
                        <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-slate-400">
                          <span className="rounded bg-amber-100 px-1 py-0.5 text-amber-700 font-medium">
                            미동기화
                          </span>
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
                          {file.modifiedTime && <span>{formatDate(file.modifiedTime)}</span>}
                        </div>
                      </div>
                      <a
                        href={file.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-shrink-0 rounded border border-amber-300 bg-amber-50 px-2 py-1 text-[10px] font-medium text-amber-700 hover:bg-amber-100"
                      >
                        열기
                      </a>
                    </li>
                  ))}
                </ul>
              )}
              {canManage && unsyncedDriveFiles.length > 0 && onSyncStage && (
                <button
                  type="button"
                  onClick={() => void onSyncStage(stage.stageNumber)}
                  disabled={syncing}
                  className="mt-2 w-full rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                >
                  {syncing ? "저장 중..." : `${stage.stageNumber}단계 매핑된 문서 저장`}
                </button>
              )}
            </div>
          )}

          {/* ── 시스템 문서 (직접 업로드 + Drive 동기화 완료) ──────────────── */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-full bg-blue-500" />
                  시스템 문서
                </span>
                {docs.length > 0 && (
                  <span className="text-[10px] text-slate-400">
                    ({docs.length}건
                    {syncedDriveDocs.length > 0 && ` — Drive 동기화 ${syncedDriveDocs.length}건 포함`})
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => { setDocsFetched(false); void fetchDocs(); }}
                disabled={docsLoading}
                className="text-xs text-blue-500 hover:underline disabled:opacity-50"
              >
                {docsLoading ? "새로고침 중..." : "새로고침"}
              </button>
            </div>

            {docsLoading ? (
              <div className="flex items-center gap-2 py-3 text-xs text-slate-400">
                <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-blue-500" />
                문서 조회 중...
              </div>
            ) : docs.length === 0 && unsyncedDriveFiles.length === 0 ? (
              <div className="rounded border border-dashed bg-white py-4 text-center text-xs text-slate-400">
                등록된 문서가 없습니다
              </div>
            ) : docs.length === 0 ? null : (
              <ul className="space-y-1.5">
                {/* 직접 업로드 파일 먼저 표시 */}
                {uploadedDocs.map((doc) => (
                  <li
                    key={doc.id}
                    className="flex items-center gap-2.5 rounded-lg border bg-white px-3 py-2 hover:bg-blue-50 transition-colors"
                  >
                    <span className="text-lg flex-shrink-0">{getFileIcon(doc.fileName, doc.mimeType)}</span>
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
                        <span className="rounded bg-indigo-100 px-1 py-0.5 text-indigo-700 font-bold">v{doc.version}</span>
                        <span>{formatBytes(doc.fileSize)}</span>
                        <span>{new Date(doc.createdAt).toLocaleDateString("ko-KR")}</span>
                      </div>
                    </div>
                    <a href={doc.fileUrl} target="_blank" rel="noreferrer"
                      className="flex-shrink-0 rounded border px-2 py-1 text-[10px] font-medium hover:bg-slate-100">
                      열기
                    </a>
                  </li>
                ))}
                {/* Drive 동기화 완료 파일 */}
                {syncedDriveDocs.map((doc) => (
                  <li
                    key={doc.id}
                    className="flex items-center gap-2.5 rounded-lg border border-green-100 bg-white px-3 py-2 hover:bg-green-50 transition-colors"
                  >
                    <span className="text-lg flex-shrink-0">{getFileIcon(doc.fileName, doc.mimeType)}</span>
                    <div className="flex-1 min-w-0">
                      <a
                        href={doc.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-semibold text-slate-700 hover:text-green-700 hover:underline truncate block"
                      >
                        {doc.fileName}
                      </a>
                      <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-slate-400">
                        <span className="rounded bg-green-100 px-1 py-0.5 text-green-700 font-semibold">Drive ✓</span>
                        <span className="rounded bg-blue-100 px-1 py-0.5 text-blue-700">
                          {DOCUMENT_TYPE_LABELS[doc.documentType as keyof typeof DOCUMENT_TYPE_LABELS] ?? doc.documentType}
                        </span>
                        <span className="rounded bg-indigo-100 px-1 py-0.5 text-indigo-700 font-bold">v{doc.version}</span>
                        <span>{formatBytes(doc.fileSize)}</span>
                        <span>{new Date(doc.createdAt).toLocaleDateString("ko-KR")}</span>
                      </div>
                    </div>
                    <a href={doc.fileUrl} target="_blank" rel="noreferrer"
                      className="flex-shrink-0 rounded border border-green-300 bg-green-50 px-2 py-1 text-[10px] font-medium text-green-700 hover:bg-green-100">
                      열기
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* 파일 업로드 */}
          {(canManage || isAssignee) && stage.status !== "COMPLETED" && stage.status !== "SKIPPED" && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-500">파일 등록</p>
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <select
                    className="h-9 rounded border px-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={uploadDocType}
                    onChange={(e) => setUploadDocType(e.target.value)}
                  >
                      <option value="">종류 선택</option>
                    {Object.entries(DOCUMENT_TYPE_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                  <label className="flex-1 flex items-center gap-2 h-9 rounded border px-3 text-xs text-slate-500 cursor-pointer hover:bg-slate-50">
                    <span>{uploadFile ? uploadFile.name : "파일 선택..."}</span>
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf,.xlsx,.xls,.doc,.docx,.hwp,.dwg,.dxf,.jpg,.jpeg,.png,.gif"
                      onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                    />
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => void handleUpload()}
                  disabled={uploading || !uploadFile || !uploadDocType}
                  className="h-9 rounded bg-blue-600 px-4 text-xs font-semibold text-white disabled:opacity-60 hover:bg-blue-700"
                >
                  {uploading ? "업로드 중..." : "등록"}
                </button>
              </div>
            </div>
          )}

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
              {missingRequiredFields.length > 0 && (
                <p className="text-xs text-rose-600">
                  완료 전에 다음 항목을 모두 채워야 합니다: {missingRequiredFields.join(", ")}.
                </p>
              )}
              <button
                type="submit"
                disabled={saving || !canCompleteButton}
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
