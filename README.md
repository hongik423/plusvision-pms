# PlusPMS — 플러스비젼 프로젝트 관리 시스템

반도체 공정 설비 제작·수리·설치 프로젝트를 **10단계 표준 프로세스**로 관리하는 웹 기반 시스템

---

## 핵심 기능

1. **프로젝트 10단계 관리** — 의뢰 접수부터 최종 문서 정리까지
2. **문서 중앙 관리** — 단계별 문서 등록·조회·아카이브
3. **견적서 자동화** — 마스터 부품 데이터 기반 견적서 생성
4. **유사 프로젝트 참조** — 검색·복사로 반복 작업 제거
5. **역할 기반 권한** — ADMIN / MANAGER / USER / VIEWER

## 기술 스택

| 구분 | 기술 |
|------|------|
| Frontend | Next.js 14 (App Router) + TypeScript |
| UI | Tailwind CSS + shadcn/ui |
| Backend | Next.js API Routes + Prisma ORM |
| Database | PostgreSQL (Supabase) |
| Auth | NextAuth.js |
| Storage | Supabase Storage |
| Deploy | Vercel |

## 시작하기

```bash
# 1. 의존성 설치
npm install

# 2. 환경 변수 설정
cp .env.example .env.local
# .env.local 파일을 열어 실제 값 입력

# 3. DB 마이그레이션
npx prisma migrate dev --name init

# 4. 시드 데이터 생성
npm run db:seed

# 5. 개발 서버 시작
npm run dev
```

## 프로젝트 구조

```
docs/           → 설계 문서 (PRD, IA, Use Case, Design Guide 등)
prisma/         → DB 스키마 및 시드 데이터
src/app/        → Next.js 페이지 및 API Routes
src/components/ → UI 컴포넌트
src/lib/        → 유틸리티, 상수, 설정
src/hooks/      → 커스텀 React 훅
src/types/      → TypeScript 타입 정의
src/services/   → API 호출 서비스
```

## 설계 문서

| 문서 | 설명 |
|------|------|
| [01_PRD.md](docs/01_PRD.md) | 제품 요구사항 정의서 |
| [02_IA.md](docs/02_IA.md) | 정보 구조도 |
| [03_USECASE.md](docs/03_USECASE.md) | 유즈케이스 |
| [04_DESIGN_GUIDE.md](docs/04_DESIGN_GUIDE.md) | 디자인 가이드 |
| [05_DB_SCHEMA.md](docs/05_DB_SCHEMA.md) | DB 스키마 |
| [06_API_DESIGN.md](docs/06_API_DESIGN.md) | API 설계 |
| [07_PROJECT_STRUCTURE.md](docs/07_PROJECT_STRUCTURE.md) | 폴더 구조 |

## Cursor에서 개발하기

1. 이 폴더를 Cursor에서 열기
2. `.cursorrules` 파일이 자동으로 적용됨
3. `docs/` 폴더의 설계 문서를 참조하며 개발
4. 개발 순서: Phase 1 → Phase 2 → Phase 3 → Phase 4 (PRD 5장 참고)

---

플러스비젼 © 2026
