# 플러스비젼 PMS - 프로젝트 폴더 구조

> **프레임워크:** Next.js 14 (App Router) + TypeScript
> **작성일:** 2026-02-24

---

## 프로젝트 루트 구조

```
plusvision-pms/
│
├── .cursorrules                    # Cursor AI 개발 규칙
├── .env.local                      # 환경 변수 (로컬)
├── .env.example                    # 환경 변수 템플릿
├── .gitignore
├── next.config.ts
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── postcss.config.js
├── components.json                 # shadcn/ui 설정
│
├── docs/                           # 설계 문서
│   ├── 01_PRD.md
│   ├── 02_IA.md
│   ├── 03_USECASE.md
│   ├── 04_DESIGN_GUIDE.md
│   ├── 05_DB_SCHEMA.md
│   ├── 06_API_DESIGN.md
│   └── 07_PROJECT_STRUCTURE.md
│
├── prisma/
│   ├── schema.prisma               # DB 스키마
│   ├── seed.ts                     # 초기 데이터
│   └── migrations/                 # 마이그레이션 파일
│
├── public/
│   ├── logo.svg                    # 플러스비젼 로고
│   ├── favicon.ico
│   └── images/
│
├── src/
│   ├── app/                        # Next.js App Router
│   │   ├── layout.tsx              # 루트 레이아웃
│   │   ├── page.tsx                # 홈 (→ 대시보드 리다이렉트)
│   │   ├── globals.css             # 전역 스타일
│   │   │
│   │   ├── (auth)/                 # 인증 그룹 (레이아웃 없음)
│   │   │   ├── login/
│   │   │   │   └── page.tsx
│   │   │   ├── register/
│   │   │   │   └── page.tsx
│   │   │   └── layout.tsx          # 인증 전용 레이아웃
│   │   │
│   │   ├── (main)/                 # 메인 그룹 (사이드바+헤더)
│   │   │   ├── layout.tsx          # 메인 레이아웃
│   │   │   │
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx        # 대시보드
│   │   │   │
│   │   │   ├── projects/
│   │   │   │   ├── page.tsx        # 프로젝트 목록
│   │   │   │   ├── new/
│   │   │   │   │   └── page.tsx    # 프로젝트 생성
│   │   │   │   └── [id]/
│   │   │   │       ├── page.tsx    # 프로젝트 상세 (개요+단계)
│   │   │   │       ├── documents/
│   │   │   │       │   └── page.tsx # 문서 관리
│   │   │   │       ├── estimate/
│   │   │   │       │   └── page.tsx # 견적서
│   │   │   │       ├── manuals/
│   │   │   │       │   └── page.tsx # 매뉴얼
│   │   │   │       └── history/
│   │   │   │           └── page.tsx # 변경 이력
│   │   │   │
│   │   │   ├── search/
│   │   │   │   └── page.tsx        # 통합 검색
│   │   │   │
│   │   │   ├── notifications/
│   │   │   │   └── page.tsx        # 알림 목록
│   │   │   │
│   │   │   ├── admin/
│   │   │   │   ├── master/
│   │   │   │   │   └── page.tsx    # 마스터 코드 관리
│   │   │   │   ├── users/
│   │   │   │   │   └── page.tsx    # 사용자 관리
│   │   │   │   ├── templates/
│   │   │   │   │   └── page.tsx    # 템플릿 관리
│   │   │   │   └── logs/
│   │   │   │       └── page.tsx    # 감사 로그
│   │   │   │
│   │   │   └── settings/
│   │   │       └── page.tsx        # 설정
│   │   │
│   │   └── api/
│   │       ├── auth/
│   │       │   └── [...nextauth]/
│   │       │       └── route.ts    # NextAuth 핸들러
│   │       │
│   │       └── v1/
│   │           ├── projects/
│   │           │   ├── route.ts           # GET(목록), POST(생성)
│   │           │   ├── similar/
│   │           │   │   └── route.ts       # GET(유사 검색)
│   │           │   └── [id]/
│   │           │       ├── route.ts       # GET, PATCH, DELETE
│   │           │       ├── copy/
│   │           │       │   └── route.ts   # POST(복사)
│   │           │       ├── stages/
│   │           │       │   ├── route.ts
│   │           │       │   └── [stageNumber]/
│   │           │       │       ├── route.ts
│   │           │       │       ├── complete/
│   │           │       │       │   └── route.ts
│   │           │       │       └── assign/
│   │           │       │           └── route.ts
│   │           │       ├── documents/
│   │           │       │   └── route.ts
│   │           │       ├── estimates/
│   │           │       │   └── route.ts
│   │           │       └── audit-logs/
│   │           │           └── route.ts
│   │           │
│   │           ├── documents/
│   │           │   └── [docId]/
│   │           │       └── route.ts
│   │           │
│   │           ├── estimates/
│   │           │   └── [estId]/
│   │           │       ├── route.ts
│   │           │       └── pdf/
│   │           │           └── route.ts
│   │           │
│   │           ├── master/
│   │           │   ├── sites/
│   │           │   │   └── route.ts
│   │           │   ├── process-types/
│   │           │   │   └── route.ts
│   │           │   ├── item-types/
│   │           │   │   └── route.ts
│   │           │   ├── customers/
│   │           │   │   └── route.ts
│   │           │   └── part-specs/
│   │           │       ├── route.ts
│   │           │       └── [id]/
│   │           │           └── route.ts
│   │           │
│   │           ├── users/
│   │           │   ├── route.ts
│   │           │   ├── me/
│   │           │   │   ├── route.ts
│   │           │   │   └── tasks/
│   │           │   │       └── route.ts
│   │           │   └── [id]/
│   │           │       ├── route.ts
│   │           │       └── role/
│   │           │           └── route.ts
│   │           │
│   │           ├── notifications/
│   │           │   ├── route.ts
│   │           │   ├── read-all/
│   │           │   │   └── route.ts
│   │           │   ├── unread-count/
│   │           │   │   └── route.ts
│   │           │   └── [id]/
│   │           │       └── read/
│   │           │           └── route.ts
│   │           │
│   │           ├── dashboard/
│   │           │   ├── stats/
│   │           │   │   └── route.ts
│   │           │   ├── my-tasks/
│   │           │   │   └── route.ts
│   │           │   ├── recent-activities/
│   │           │   │   └── route.ts
│   │           │   └── stage-distribution/
│   │           │       └── route.ts
│   │           │
│   │           ├── search/
│   │           │   ├── route.ts
│   │           │   └── suggestions/
│   │           │       └── route.ts
│   │           │
│   │           └── audit-logs/
│   │               └── route.ts
│   │
│   ├── components/                 # 재사용 컴포넌트
│   │   ├── ui/                     # shadcn/ui 기본 컴포넌트
│   │   │   ├── button.tsx
│   │   │   ├── input.tsx
│   │   │   ├── select.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── table.tsx
│   │   │   ├── card.tsx
│   │   │   ├── badge.tsx
│   │   │   ├── toast.tsx
│   │   │   ├── dropdown-menu.tsx
│   │   │   ├── tabs.tsx
│   │   │   ├── form.tsx
│   │   │   ├── label.tsx
│   │   │   ├── textarea.tsx
│   │   │   ├── avatar.tsx
│   │   │   ├── separator.tsx
│   │   │   ├── skeleton.tsx
│   │   │   ├── progress.tsx
│   │   │   └── tooltip.tsx
│   │   │
│   │   ├── layout/                 # 레이아웃 컴포넌트
│   │   │   ├── header.tsx          # GNB 헤더
│   │   │   ├── sidebar.tsx         # 좌측 사이드바
│   │   │   ├── main-nav.tsx        # 메인 네비게이션
│   │   │   ├── user-menu.tsx       # 유저 드롭다운
│   │   │   └── mobile-nav.tsx      # 모바일 네비게이션
│   │   │
│   │   ├── project/                # 프로젝트 관련
│   │   │   ├── project-card.tsx    # 프로젝트 카드
│   │   │   ├── project-table.tsx   # 프로젝트 테이블
│   │   │   ├── project-form.tsx    # 프로젝트 생성/수정 폼
│   │   │   ├── project-filter.tsx  # 필터 패널
│   │   │   ├── stage-stepper.tsx   # 10단계 스텝퍼 (핵심 UI)
│   │   │   ├── stage-detail.tsx    # 단계 상세 패널
│   │   │   ├── stage-actions.tsx   # 단계별 액션 버튼
│   │   │   ├── similar-projects.tsx # 유사 프로젝트 추천
│   │   │   └── status-badge.tsx    # 상태 배지
│   │   │
│   │   ├── document/               # 문서 관련
│   │   │   ├── document-list.tsx   # 문서 목록
│   │   │   ├── document-upload.tsx # 파일 업로드
│   │   │   ├── document-preview.tsx # 파일 미리보기
│   │   │   └── document-type-badge.tsx
│   │   │
│   │   ├── estimate/               # 견적서 관련
│   │   │   ├── estimate-form.tsx   # 견적서 작성 폼
│   │   │   ├── estimate-item-row.tsx # 견적 항목 행
│   │   │   ├── part-selector.tsx   # 부품 선택 (마스터 연동)
│   │   │   └── estimate-pdf.tsx    # PDF 미리보기
│   │   │
│   │   ├── dashboard/              # 대시보드 관련
│   │   │   ├── stats-card.tsx      # 통계 카드
│   │   │   ├── my-tasks.tsx        # My 할일
│   │   │   ├── recent-activity.tsx # 최근 활동
│   │   │   ├── stage-chart.tsx     # 단계별 분포 차트
│   │   │   └── monthly-summary.tsx # 월별 실적
│   │   │
│   │   ├── admin/                  # 관리 관련
│   │   │   ├── master-table.tsx    # 마스터 데이터 테이블
│   │   │   ├── master-form.tsx     # 마스터 데이터 폼
│   │   │   ├── user-table.tsx      # 사용자 테이블
│   │   │   └── audit-log-table.tsx # 감사 로그 테이블
│   │   │
│   │   ├── notification/           # 알림 관련
│   │   │   ├── notification-bell.tsx
│   │   │   ├── notification-list.tsx
│   │   │   └── notification-item.tsx
│   │   │
│   │   └── common/                 # 공통
│   │       ├── search-bar.tsx      # 검색바
│   │       ├── pagination.tsx      # 페이지네이션
│   │       ├── empty-state.tsx     # 빈 상태 표시
│   │       ├── loading-spinner.tsx # 로딩
│   │       ├── confirm-dialog.tsx  # 확인 다이얼로그
│   │       └── date-range-picker.tsx
│   │
│   ├── lib/                        # 유틸리티 및 설정
│   │   ├── prisma.ts               # Prisma 클라이언트 싱글톤
│   │   ├── auth.ts                 # NextAuth 설정
│   │   ├── supabase.ts             # Supabase 클라이언트
│   │   ├── utils.ts                # 공통 유틸
│   │   ├── constants.ts            # 상수 정의
│   │   ├── validations.ts          # Zod 스키마 (입력 검증)
│   │   └── api-helpers.ts          # API 응답 헬퍼
│   │
│   ├── hooks/                      # 커스텀 훅
│   │   ├── use-projects.ts         # 프로젝트 CRUD 훅
│   │   ├── use-stages.ts           # 단계 관리 훅
│   │   ├── use-documents.ts        # 문서 관리 훅
│   │   ├── use-estimates.ts        # 견적서 훅
│   │   ├── use-master.ts           # 마스터 데이터 훅
│   │   ├── use-notifications.ts    # 알림 훅
│   │   ├── use-search.ts           # 검색 훅
│   │   └── use-auth.ts             # 인증 훅
│   │
│   ├── store/                      # 상태 관리 (Zustand)
│   │   ├── project-store.ts
│   │   ├── filter-store.ts
│   │   └── notification-store.ts
│   │
│   ├── types/                      # TypeScript 타입 정의
│   │   ├── project.ts
│   │   ├── stage.ts
│   │   ├── document.ts
│   │   ├── estimate.ts
│   │   ├── user.ts
│   │   ├── master.ts
│   │   ├── notification.ts
│   │   └── api.ts
│   │
│   └── services/                   # API 호출 서비스
│       ├── project-service.ts
│       ├── stage-service.ts
│       ├── document-service.ts
│       ├── estimate-service.ts
│       ├── master-service.ts
│       ├── user-service.ts
│       ├── notification-service.ts
│       ├── search-service.ts
│       └── dashboard-service.ts
│
└── tests/                          # 테스트
    ├── unit/
    └── e2e/
```
