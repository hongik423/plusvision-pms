# 플러스비젼 PMS - 데이터 마이그레이션 및 Google Drive 연동 전략

> **버전:** 1.0 | **작성일:** 2026-02-24
> **목적:** 기존 Google Drive 데이터를 PlusPMS 시스템으로 이전하고 연동하는 전략

---

## 1. 현재 Google Drive 데이터 구조 분석

### 1.1 확인된 폴더 구조

```
플러스비젼 공용 (1owI2TO...)
├── 프로젝트/
│   ├── 삼성/
│   │   ├── OBPH OGPMS         (활성 프로젝트)
│   │   ├── IMK                (활성 프로젝트)
│   │   ├── 삼성적산
│   │   ├── 삼성 담당자 연락처
│   │   ├── 삼성 공사 관련 대응자료
│   │   ├── 삼성 환경 안전 대응
│   │   ├── 홀드 프로젝트
│   │   └── old project
│   ├── 바이코/
│   ├── 디티에스/
│   ├── 테트라다인/
│   ├── 포이스/
│   ├── 벨류/
│   ├── 원익포이스/
│   ├── 거래 업체/
│   ├── 폴더 양식/
│   │   └── 공정 라인 담당자 UR 번호일자/
│   └── 사람별 프로젝트/
├── 회사 운영/
│   ├── ISO4500
│   ├── 사유서 경위서
│   ├── 위임장
│   ├── 연구전담
│   ├── 부설연구전담부서
│   └── 사용양식
├── 회사 소개서/
├── SOP/
├── 개인별/
└── 국책 자료/
```

### 1.2 현재 데이터 분류

| 분류 | Google Drive 위치 | PlusPMS 대상 여부 |
|------|-------------------|------------------|
| 프로젝트 파일 | 프로젝트/삼성/*, 바이코/* 등 | ✅ 핵심 마이그레이션 대상 |
| 고객 연락처 | 삼성 담당자 연락처 | ✅ 마스터 데이터 |
| 적산/견적 | 삼성적산 | ✅ 견적 참고 데이터 |
| 폴더 양식 | 폴더 양식/ | ✅ 템플릿 데이터 |
| 회사 운영 | 회사 운영/* | ❌ 시스템 범위 외 |
| 회사 소개서 | 회사 소개서/ | ❌ 시스템 범위 외 |
| SOP/국책 | SOP/, 국책 자료/ | ❌ 시스템 범위 외 |

---

## 2. 데이터 연동 방법론: 3단계 접근

### 방법론 선택 근거

현재 설계에서는 **"완전 이전(Full Migration)" + "참조 연동(Reference Link)"** 하이브리드 방식을 채택했습니다.

```
┌─────────────────────────────────────────────────────────────┐
│                    3단계 데이터 연동 전략                     │
│                                                             │
│  [1단계] 구조화 데이터 추출    Google Drive → 정규화         │
│          (마스터 데이터)        Excel/Sheets → DB 테이블     │
│                                                             │
│  [2단계] 파일 마이그레이션     Google Drive → Supabase       │
│          (문서/사진/도면)       Storage (프로젝트별 버킷)    │
│                                                             │
│  [3단계] 참조 링크 연동        기존 Drive 파일 →             │
│          (이전 불가 파일)       PlusPMS에서 링크로 참조      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. 1단계: 구조화 데이터 추출 (마스터 데이터)

### 3.1 대상 데이터

| 원본 | 추출 대상 | PlusPMS 테이블 |
|------|-----------|---------------|
| 폴더명 (삼성, 바이코...) | 고객사 목록 | `customers` |
| 프로젝트 폴더명 | 프로젝트 기본 정보 | `projects` |
| 삼성 담당자 연락처 | 고객 담당자 | `customers.contact` |
| 삼성적산 내 파일 | 단가/부품 데이터 | `part_specs` |
| 공정 라인 담당자 UR | 사업장/공정 코드 | `sites`, `process_types` |
| 사람별 프로젝트 | 사용자-프로젝트 매핑 | `project_members` |

### 3.2 추출 방법

```typescript
// Google Drive API를 사용한 마이그레이션 스크립트
// scripts/migrate-from-gdrive.ts

import { google } from 'googleapis';
import { PrismaClient } from '@prisma/client';

const drive = google.drive({ version: 'v3', auth: /* OAuth2 */ });
const prisma = new PrismaClient();

// 1. 프로젝트 폴더를 순회하며 프로젝트 생성
async function migrateProjects() {
  const projectFolders = await drive.files.list({
    q: "'프로젝트폴더ID' in parents and mimeType='application/vnd.google-apps.folder'",
  });

  for (const folder of projectFolders.data.files) {
    // 고객사별 폴더 → 하위 프로젝트 폴더 → DB 등록
    await prisma.project.create({
      data: {
        name: folder.name,
        projectNumber: generateProjectNumber(),
        // ... 분류 정보는 수동 매핑 필요
      }
    });
  }
}
```

### 3.3 수동 정비 필요 항목
- 프로젝트별 사업장/공정/품목 분류 → 최초 1회 수동 매핑 필요
- 비표준화된 폴더명 → 정규화 (예: "OBPH OGPMS" → 공식 프로젝트명)
- 부품 데이터 → Excel에서 추출 후 `part_specs` 테이블로 적재

---

## 4. 2단계: 파일 마이그레이션 (문서/사진/도면)

### 4.1 방식: Google Drive → Supabase Storage

```
Google Drive                          Supabase Storage
프로젝트/삼성/OBPH OGPMS/            projects/{projectId}/
├── 견적서.xlsx          →            ├── stage-6/견적서.xlsx
├── 제안서.pdf           →            ├── stage-6/제안서.pdf
├── 현장사진1.jpg        →            ├── stage-3/현장사진1.jpg
├── 제작매뉴얼.docx      →            ├── stage-7/제작매뉴얼.docx
└── 설치매뉴얼.pdf       →            └── stage-8/설치매뉴얼.pdf
```

### 4.2 마이그레이션 스크립트 흐름

```
[1] Google Drive API로 파일 목록 조회
    ↓
[2] 파일명/확장자로 문서 유형 자동 분류
    (견적서 → stage-6, 매뉴얼 → stage-7/8 등)
    ↓
[3] 파일 다운로드 → Supabase Storage 업로드
    ↓
[4] stage_documents 테이블에 메타데이터 등록
    (fileName, fileUrl, fileSize, documentType)
    ↓
[5] 원본 Google Drive 파일은 삭제하지 않고 유지
    (안전을 위해 이중 보관)
```

### 4.3 파일 유형 자동 분류 규칙

```typescript
function classifyDocument(fileName: string): { stageNumber: number; documentType: string } {
  const name = fileName.toLowerCase();

  if (name.includes('견적') || name.includes('estimate')) return { stageNumber: 6, documentType: 'ESTIMATE' };
  if (name.includes('제안') || name.includes('proposal')) return { stageNumber: 6, documentType: 'PROPOSAL' };
  if (name.includes('제작') && name.includes('매뉴얼')) return { stageNumber: 7, documentType: 'MANUFACTURE_MANUAL' };
  if (name.includes('설치') && name.includes('매뉴얼')) return { stageNumber: 8, documentType: 'INSTALL_MANUAL' };
  if (name.includes('부품') || name.includes('파트')) return { stageNumber: 7, documentType: 'PARTS_LIST' };
  if (/\.(jpg|jpeg|png|gif)$/i.test(name)) return { stageNumber: 3, documentType: 'SITE_PHOTO' };
  if (/\.(dwg|dxf)$/i.test(name)) return { stageNumber: 7, documentType: 'DRAWING' };

  return { stageNumber: 10, documentType: 'OTHER' };
}
```

---

## 5. 3단계: 참조 링크 연동

### 5.1 용도
Google Drive에 남겨둘 데이터(회사 운영, SOP, 국책 자료 등)는 PlusPMS에서 **링크로 참조**합니다.

### 5.2 구현 방식

```typescript
// StageDocument 모델에 외부 링크 필드 추가
model StageDocument {
  // ... 기존 필드
  fileUrl       String       // Supabase URL 또는 Google Drive URL
  storageType   String       @default("SUPABASE")  // "SUPABASE" | "GOOGLE_DRIVE"
  externalId    String?      // Google Drive 파일 ID (연동 시)
}
```

- `storageType = "GOOGLE_DRIVE"` 인 경우 → Drive 링크로 새 탭 열기
- `storageType = "SUPABASE"` 인 경우 → 시스템 내 미리보기/다운로드

---

## 6. 시스템 구축 후 운영 시나리오

### Q: 시스템 구축 후 데이터 저장·수정·유지·조회가 가능한가?

**답변: 예, 가능합니다.** 단, 데이터 유형에 따라 방식이 다릅니다.

### 6.1 신규 데이터 (시스템 구축 후 생성)

| 기능 | 방식 | 저장 위치 |
|------|------|-----------|
| **저장** | 시스템에서 직접 입력/업로드 | DB + Supabase Storage |
| **수정** | 시스템 UI에서 편집 | DB 업데이트 (변경 이력 자동 기록) |
| **유지** | 자동 백업 (Supabase) | 클라우드 자동 백업 |
| **조회** | 검색/필터/단계별 문서 목록 | 키워드·분류·담당자별 검색 |

### 6.2 마이그레이션된 기존 데이터

| 기능 | 방식 |
|------|------|
| **저장** | 마이그레이션 스크립트로 일괄 이전 완료 |
| **수정** | 시스템에서 수정 가능 (원본 Drive 파일은 별도) |
| **유지** | Supabase에 복사된 파일로 독립 관리 |
| **조회** | 프로젝트 분류 체계로 검색 가능 |

### 6.3 Google Drive에 남아있는 데이터

| 기능 | 방식 |
|------|------|
| **저장** | Drive에 그대로 유지 |
| **수정** | Drive에서 직접 수정 (시스템 외부) |
| **유지** | Google Drive 자체 관리 |
| **조회** | PlusPMS에서 링크로 참조 가능 |

---

## 7. 마이그레이션 실행 계획

### 7.1 단계별 일정

| 순서 | 작업 | 기간 | 담당 |
|------|------|------|------|
| 1 | 마스터 데이터 정비 (사업장, 공정, 품목, 고객사) | 2일 | 대표 + 개발자 |
| 2 | 사용자 계정 생성 및 역할 배정 | 1일 | 관리자 |
| 3 | 기존 프로젝트 목록 정리 (Excel) | 3일 | 대표 + 매니저 |
| 4 | 프로젝트 데이터 일괄 등록 (스크립트) | 2일 | 개발자 |
| 5 | 핵심 프로젝트 파일 마이그레이션 | 3일 | 개발자 |
| 6 | 데이터 검증 및 보정 | 2일 | 대표 + 매니저 |
| 7 | 시스템 교육 및 안정화 | 3일 | 전체 |

### 7.2 우선순위

```
1순위: 현재 진행중인 프로젝트 (OBPH OGPMS 등)
2순위: 최근 1년 이내 완료 프로젝트 (참조용)
3순위: 과거 프로젝트 (필요 시 추후 이전)
4순위: 회사 운영 자료 (링크 참조만)
```

---

## 8. 기술적 제약 및 해결 방안

| 제약 사항 | 해결 방안 |
|-----------|-----------|
| Google Drive API 일일 요청 한도 | 배치 처리, 분할 마이그레이션 |
| HWP(한글) 파일은 미리보기 불가 | 파일 다운로드 후 로컬에서 열기 |
| CAD 파일(DWG) 미리보기 | 메타데이터만 표시, 다운로드 제공 |
| 비정형 폴더 구조 | 수동 매핑 + 자동 분류 병행 |
| 파일명 불규칙 | 파일명 규칙 자동 분류 + 수동 보정 |
| 대용량 파일 | 100MB 이상 파일은 Drive 링크 참조 |
