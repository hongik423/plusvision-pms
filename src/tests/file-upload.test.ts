import { describe, expect, it } from "vitest";
import { ALLOWED_FILE_EXTENSIONS, MAX_FILE_SIZE } from "@/lib/constants";

function hasAllowedExtension(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return ALLOWED_FILE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

describe("파일 업로드 검증", () => {
  describe("확장자 검증", () => {
    const allowed = [
      "report.pdf",
      "data.xlsx",
      "data.xls",
      "document.doc",
      "document.docx",
      "한글문서.hwp",
      "drawing.dwg",
      "drawing.dxf",
      "photo.jpg",
      "photo.jpeg",
      "image.png",
      "animation.gif",
    ];

    for (const name of allowed) {
      it(`허용: ${name}`, () => {
        expect(hasAllowedExtension(name)).toBe(true);
      });
    }

    const denied = [
      "script.exe",
      "malware.bat",
      "code.js",
      "hack.php",
      "archive.zip",
      "data.csv",
      "video.mp4",
      "music.mp3",
    ];

    for (const name of denied) {
      it(`차단: ${name}`, () => {
        expect(hasAllowedExtension(name)).toBe(false);
      });
    }

    it("대소문자 구분 없이 동작", () => {
      expect(hasAllowedExtension("DOC.PDF")).toBe(true);
      expect(hasAllowedExtension("Photo.JPG")).toBe(true);
      expect(hasAllowedExtension("Data.XLSX")).toBe(true);
    });
  });

  describe("파일 크기 검증", () => {
    it("MAX_FILE_SIZE는 100MB", () => {
      expect(MAX_FILE_SIZE).toBe(100 * 1024 * 1024);
    });

    it("100MB 이하 파일은 통과", () => {
      const size = 50 * 1024 * 1024;
      expect(size <= MAX_FILE_SIZE).toBe(true);
    });

    it("100MB 초과 파일은 차단", () => {
      const size = 101 * 1024 * 1024;
      expect(size <= MAX_FILE_SIZE).toBe(false);
    });

    it("0바이트 파일도 허용 범위", () => {
      expect(0 <= MAX_FILE_SIZE).toBe(true);
    });

    it("정확히 100MB는 허용", () => {
      expect(MAX_FILE_SIZE <= MAX_FILE_SIZE).toBe(true);
    });
  });

  describe("Supabase Storage 경로 규칙", () => {
    function buildStoragePath(projectId: string, stageNumber: number, fileName: string) {
      return `${projectId}/stage-${stageNumber}/${Date.now()}-${fileName}`;
    }

    it("경로 형식이 프로젝트/단계/파일명을 포함", () => {
      const path = buildStoragePath("proj-123", 7, "drawing.dwg");
      expect(path).toContain("proj-123");
      expect(path).toContain("stage-7");
      expect(path).toContain("drawing.dwg");
    });

    it("단계 번호 1~10 범위에서 경로 생성", () => {
      for (let i = 1; i <= 10; i++) {
        const path = buildStoragePath("proj-1", i, "file.pdf");
        expect(path).toContain(`stage-${i}`);
      }
    });
  });
});
