"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { DOCUMENT_TYPE_LABELS, STAGE_NAMES } from "@/lib/constants";

type DocumentRow = {
  id: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  documentType: keyof typeof DOCUMENT_TYPE_LABELS;
  description: string | null;
  createdAt: string;
  stage: {
    stageNumber: number;
    stageName: string;
  };
};

const DOCUMENT_TYPES = Object.keys(DOCUMENT_TYPE_LABELS) as Array<keyof typeof DOCUMENT_TYPE_LABELS>;
const ACCEPTED_EXTENSIONS = ".pdf,.xlsx,.xls,.doc,.docx,.hwp,.dwg,.dxf,.jpg,.jpeg,.png,.gif";
const MAX_FILE_MB = 100;

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)}MB`;
}

function isImage(mimeType: string) {
  return mimeType.startsWith("image/");
}

export default function ProjectDocumentsPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [rows, setRows] = useState<DocumentRow[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [form, setForm] = useState({
    stageNumber: "1",
    documentType: "OTHER" as keyof typeof DOCUMENT_TYPE_LABELS,
    description: "",
  });
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const fetchDocuments = useCallback(async () => {
    setListLoading(true);
    const response = await fetch(`/api/v1/projects/${projectId}/documents`);
    const payload = await response.json();
    setRows(payload.data ?? []);
    setListLoading(false);
  }, [projectId]);

  useEffect(() => {
    void fetchDocuments();
  }, [fetchDocuments]);

  // 미리보기 URL 관리
  useEffect(() => {
    if (!pendingFile) {
      setPreviewUrl(null);
      return;
    }
    if (isImage(pendingFile.type)) {
      const url = URL.createObjectURL(pendingFile);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    setPreviewUrl(null);
  }, [pendingFile]);

  function selectFile(file: File) {
    setUploadError(null);
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      setUploadError(`파일 크기는 최대 ${MAX_FILE_MB}MB까지 업로드할 수 있습니다.`);
      return;
    }
    setPendingFile(file);
  }

  function onFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) selectFile(file);
    e.target.value = "";
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(true);
  }

  function onDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) selectFile(file);
  }

  async function onUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!pendingFile) {
      setUploadError("업로드할 파일을 선택해 주세요.");
      return;
    }
    setUploadError(null);

    const formData = new FormData();
    formData.append("file", pendingFile);
    formData.append("stageNumber", form.stageNumber);
    formData.append("documentType", form.documentType);
    formData.append("description", form.description);

    // XMLHttpRequest를 사용해 업로드 진행률 추적
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) {
          setUploadProgress(Math.round((event.loaded / event.total) * 100));
        }
      });
      xhr.addEventListener("load", async () => {
        setUploadProgress(null);
        try {
          const result = JSON.parse(xhr.responseText) as { success: boolean; error?: { message?: string } };
          if (!result.success) {
            setUploadError(result.error?.message ?? "문서 업로드에 실패했습니다.");
            reject(new Error(result.error?.message));
            return;
          }
          setPendingFile(null);
          setPreviewUrl(null);
          setForm((prev) => ({ ...prev, description: "" }));
          await fetchDocuments();
          resolve();
        } catch {
          setUploadError("응답 처리 중 오류가 발생했습니다.");
          reject(new Error("parse error"));
        }
      });
      xhr.addEventListener("error", () => {
        setUploadProgress(null);
        setUploadError("네트워크 오류가 발생했습니다.");
        reject(new Error("network error"));
      });
      xhr.open("POST", `/api/v1/projects/${projectId}/documents`);
      xhr.send(formData);
    }).catch(() => {/* 오류는 uploadError state로 처리 */});
  }

  return (
    <section className="space-y-6">
      <h1 className="text-3xl font-bold">문서 관리</h1>

      {/* 업로드 폼 */}
      <form onSubmit={onUpload} className="rounded-xl border bg-white p-5 space-y-4">
        <h2 className="text-xl font-semibold">문서 업로드</h2>

        <div className="grid gap-3 md:grid-cols-3">
          <label className="text-sm">
            <span className="mb-1 block font-semibold">단계</span>
            <select
              className="h-11 w-full rounded border px-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.stageNumber}
              onChange={(e) => setForm((p) => ({ ...p, stageNumber: e.target.value }))}
            >
              {Object.entries(STAGE_NAMES).map(([num, name]) => (
                <option key={num} value={num}>{num}단계 - {name}</option>
              ))}
            </select>
          </label>

          <label className="text-sm">
            <span className="mb-1 block font-semibold">문서 유형</span>
            <select
              className="h-11 w-full rounded border px-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.documentType}
              onChange={(e) =>
                setForm((p) => ({ ...p, documentType: e.target.value as keyof typeof DOCUMENT_TYPE_LABELS }))
              }
            >
              {DOCUMENT_TYPES.map((type) => (
                <option key={type} value={type}>{DOCUMENT_TYPE_LABELS[type]}</option>
              ))}
            </select>
          </label>

          <label className="text-sm">
            <span className="mb-1 block font-semibold">설명 (선택)</span>
            <input
              className="h-11 w-full rounded border px-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              placeholder="문서 설명"
            />
          </label>
        </div>

        {/* 드래그&드롭 영역 */}
        <div
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`relative flex min-h-[140px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed transition-colors ${
            dragOver
              ? "border-blue-500 bg-blue-50"
              : pendingFile
              ? "border-green-400 bg-green-50"
              : "border-slate-300 hover:border-blue-400 hover:bg-slate-50"
          }`}
        >
          {pendingFile ? (
            <div className="flex items-center gap-4 px-4 py-3 w-full">
              {previewUrl ? (
                // 이미지 썸네일 미리보기
                <img
                  src={previewUrl}
                  alt="미리보기"
                  className="h-20 w-20 rounded object-cover border"
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded border bg-white text-3xl">
                  {pendingFile.name.endsWith(".pdf") ? "📄"
                    : pendingFile.name.match(/\.(xlsx?|xls)$/i) ? "📊"
                    : pendingFile.name.match(/\.(docx?|hwp)$/i) ? "📝"
                    : pendingFile.name.match(/\.(dwg|dxf)$/i) ? "📐"
                    : "📎"}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="truncate font-semibold text-sm">{pendingFile.name}</p>
                <p className="text-xs text-slate-500 mt-1">{formatBytes(pendingFile.size)}</p>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setPendingFile(null); }}
                  className="mt-2 text-xs text-red-500 hover:underline"
                >
                  파일 제거
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="text-4xl mb-2">☁️</div>
              <p className="text-sm font-semibold text-slate-600">
                파일을 드래그하거나 클릭하여 선택
              </p>
              <p className="mt-1 text-xs text-slate-400">
                PDF, Excel, Word, HWP, CAD, 이미지 · 최대 {MAX_FILE_MB}MB
              </p>
            </>
          )}
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept={ACCEPTED_EXTENSIONS}
            onChange={onFileInputChange}
          />
        </div>

        {/* 업로드 진행 바 */}
        {uploadProgress !== null ? (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-slate-500">
              <span>업로드 중...</span>
              <span>{uploadProgress}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-blue-500 transition-all duration-200"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        ) : null}

        {/* 오류 메시지 */}
        {uploadError ? (
          <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{uploadError}</p>
        ) : null}

        <button
          type="submit"
          disabled={!pendingFile || uploadProgress !== null}
          className="h-11 rounded bg-blue-600 px-6 font-semibold text-white disabled:opacity-60"
        >
          {uploadProgress !== null ? `업로드 중... (${uploadProgress}%)` : "문서 업로드"}
        </button>
      </form>

      {/* 문서 목록 */}
      <div className="rounded-xl border bg-white p-5">
        <h2 className="mb-4 text-xl font-semibold">문서 목록</h2>
        {listLoading ? (
          <div className="flex items-center gap-2 py-8 text-sm text-slate-400">
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-blue-500" />
            목록을 불러오는 중입니다...
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-dashed py-12 text-center">
            <p className="text-4xl mb-3">📂</p>
            <p className="font-semibold text-slate-600">등록된 문서가 없습니다</p>
            <p className="mt-1 text-sm text-slate-400">위에서 파일을 업로드해 주세요.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {rows.map((row) => (
              <li key={row.id} className="flex items-center gap-4 rounded-lg border px-4 py-3 hover:bg-slate-50 transition-colors">
                {/* 이미지는 썸네일, 그 외는 아이콘 */}
                {isImage(row.mimeType) ? (
                  <img
                    src={row.fileUrl}
                    alt={row.fileName}
                    className="h-12 w-12 rounded object-cover border flex-shrink-0"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded border bg-slate-50 text-2xl">
                    {row.fileName.endsWith(".pdf") ? "📄"
                      : row.fileName.match(/\.(xlsx?|xls)$/i) ? "📊"
                      : row.fileName.match(/\.(docx?|hwp)$/i) ? "📝"
                      : row.fileName.match(/\.(dwg|dxf)$/i) ? "📐"
                      : "📎"}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <a
                    href={row.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="truncate font-semibold text-sm hover:text-blue-600 hover:underline"
                  >
                    {row.fileName}
                  </a>
                  {row.description ? (
                    <p className="text-xs text-slate-500 mt-0.5">{row.description}</p>
                  ) : null}
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                    <span className="rounded bg-slate-100 px-1.5 py-0.5">{row.stage.stageNumber}단계</span>
                    <span className="rounded bg-blue-100 px-1.5 py-0.5 text-blue-700">{DOCUMENT_TYPE_LABELS[row.documentType]}</span>
                    <span>{formatBytes(row.fileSize)}</span>
                    <span>{new Date(row.createdAt).toLocaleDateString("ko-KR")}</span>
                  </div>
                </div>
                <a
                  href={row.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-shrink-0 rounded border px-3 py-1.5 text-xs font-medium hover:bg-slate-100 transition-colors"
                >
                  다운로드
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
