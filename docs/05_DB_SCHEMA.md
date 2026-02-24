# 플러스비젼 PMS - Database Schema

> **버전:** 1.0 | **작성일:** 2026-02-24
> **ORM:** Prisma | **DB:** PostgreSQL (Supabase)

---

## 1. ERD 개요

```
User ──< ProjectMember >── Project ──< ProjectStage
  │                           │              │
  │                           │         StageDocument
  │                           │
  │                       Estimate ──< EstimateItem
  │                           │              │
  │                       Manual         PartSpec (Master)
  │
  ├── Notification
  └── AuditLog

MasterCode (사업장, 공정, 품목, 고객사)
```

---

## 2. Prisma Schema

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ============================================
// 1. 사용자 및 인증
// ============================================

enum Role {
  ADMIN
  MANAGER
  USER
  VIEWER
}

model User {
  id            String    @id @default(cuid())
  email         String    @unique
  name          String
  password      String?   // 구글 로그인 시 null
  role          Role      @default(USER)
  department    String?
  phone         String?
  profileImage  String?
  isActive      Boolean   @default(true)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  // Relations
  projectMembers  ProjectMember[]
  notifications   Notification[]
  auditLogs       AuditLog[]
  createdProjects Project[]       @relation("ProjectCreator")

  @@map("users")
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String?
  access_token      String?
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
  @@map("accounts")
}

// ============================================
// 2. 프로젝트
// ============================================

enum ProjectStatus {
  PENDING    // 대기
  ACTIVE     // 진행중
  COMPLETED  // 완료
  HOLD       // 보류
  CANCELLED  // 취소
}

model Project {
  id              String        @id @default(cuid())
  projectNumber   String        @unique  // 자동 생성: PV-2026-001
  name            String
  description     String?
  status          ProjectStatus @default(PENDING)
  currentStage    Int           @default(1)  // 현재 단계 (1~10)

  // 분류 정보
  customerId      String
  siteId          String
  processTypeId   String
  itemTypeId      String

  // 채권 정보
  bondNumber      String?
  bondRegistered  Boolean       @default(false)

  // 일정
  startDate       DateTime?
  dueDate         DateTime?
  completedDate   DateTime?

  // 메타
  createdById     String
  copiedFromId    String?       // 복사 원본 프로젝트 ID
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  // Relations
  customer        Customer      @relation(fields: [customerId], references: [id])
  site            Site          @relation(fields: [siteId], references: [id])
  processType     ProcessType   @relation(fields: [processTypeId], references: [id])
  itemType        ItemType      @relation(fields: [itemTypeId], references: [id])
  createdBy       User          @relation("ProjectCreator", fields: [createdById], references: [id])
  copiedFrom      Project?      @relation("ProjectCopy", fields: [copiedFromId], references: [id])
  copies          Project[]     @relation("ProjectCopy")

  stages          ProjectStage[]
  members         ProjectMember[]
  estimates       Estimate[]
  manuals         Manual[]
  auditLogs       AuditLog[]

  @@index([status])
  @@index([customerId])
  @@index([siteId])
  @@index([processTypeId])
  @@index([itemTypeId])
  @@index([createdAt])
  @@map("projects")
}

// ============================================
// 3. 프로젝트 단계 (10단계)
// ============================================

enum StageStatus {
  INACTIVE   // 비활성
  ACTIVE     // 진행중
  COMPLETED  // 완료
  SKIPPED    // 건너뜀 (관리자만)
}

model ProjectStage {
  id            String      @id @default(cuid())
  projectId     String
  stageNumber   Int         // 1~10
  stageName     String      // 단계명
  status        StageStatus @default(INACTIVE)
  assigneeId    String?     // 담당자

  startDate     DateTime?
  completedDate DateTime?
  notes         String?

  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt

  // Relations
  project       Project     @relation(fields: [projectId], references: [id], onDelete: Cascade)
  assignee      User?       @relation(fields: [assigneeId], references: [id])
  documents     StageDocument[]

  @@unique([projectId, stageNumber])
  @@index([assigneeId])
  @@index([status])
  @@map("project_stages")
}

// 단계명 매핑 상수 (코드에서 사용)
// 1: 의뢰 접수
// 2: 담당자 지정
// 3: 고객 협의 (현장 확인)
// 4: 진행 여부 결정
// 5: 채권 등록
// 6: 견적 작성
// 7: 제작
// 8: 납품/설치
// 9: 실적 입력
// 10: 최종 문서 정리

// ============================================
// 4. 문서 관리
// ============================================

enum DocumentType {
  PROPOSAL       // 제안서
  ESTIMATE       // 견적서
  MANUFACTURE_MANUAL  // 제작 매뉴얼
  INSTALL_MANUAL      // 설치 매뉴얼
  PARTS_LIST     // 부품 리스트
  SITE_PHOTO     // 현장 사진
  DRAWING        // 도면
  MEETING_NOTE   // 회의록
  EXPORT_RECORD  // 반출 기록
  OTHER          // 기타
}

model StageDocument {
  id            String       @id @default(cuid())
  stageId       String
  documentType  DocumentType
  fileName      String
  fileUrl       String       // Supabase Storage URL
  fileSize      Int          // bytes
  mimeType      String
  version       Int          @default(1)
  description   String?
  uploadedById  String

  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt

  // Relations
  stage         ProjectStage @relation(fields: [stageId], references: [id], onDelete: Cascade)
  uploadedBy    User         @relation(fields: [uploadedById], references: [id])

  @@index([stageId])
  @@index([documentType])
  @@map("stage_documents")
}

// ============================================
// 5. 견적서
// ============================================

model Estimate {
  id            String    @id @default(cuid())
  projectId     String
  estimateNumber String   @unique  // EST-2026-001
  version       Int       @default(1)
  title         String
  totalAmount   Decimal   @default(0)
  taxAmount     Decimal   @default(0)
  grandTotal    Decimal   @default(0)
  notes         String?
  status        String    @default("DRAFT") // DRAFT, SUBMITTED, APPROVED

  createdById   String
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  // Relations
  project       Project   @relation(fields: [projectId], references: [id])
  createdBy     User      @relation(fields: [createdById], references: [id])
  items         EstimateItem[]

  @@index([projectId])
  @@map("estimates")
}

model EstimateItem {
  id            String    @id @default(cuid())
  estimateId    String
  partSpecId    String?   // 마스터 부품 참조 (null이면 자유입력)
  itemName      String
  specification String?
  unit          String    @default("EA")
  quantity      Decimal
  unitPrice     Decimal
  amount        Decimal   // quantity * unitPrice
  sortOrder     Int       @default(0)
  remarks       String?

  // Relations
  estimate      Estimate  @relation(fields: [estimateId], references: [id], onDelete: Cascade)
  partSpec      PartSpec? @relation(fields: [partSpecId], references: [id])

  @@map("estimate_items")
}

// ============================================
// 6. 매뉴얼
// ============================================

enum ManualType {
  MANUFACTURE  // 제작 매뉴얼
  INSTALL      // 설치 매뉴얼
}

model Manual {
  id          String     @id @default(cuid())
  projectId   String
  type        ManualType
  title       String
  content     String     @db.Text  // Rich text / Markdown
  version     Int        @default(1)
  createdById String
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt

  // Relations
  project     Project    @relation(fields: [projectId], references: [id])
  createdBy   User       @relation(fields: [createdById], references: [id])

  @@index([projectId])
  @@map("manuals")
}

// ============================================
// 7. 프로젝트 멤버
// ============================================

model ProjectMember {
  id          String   @id @default(cuid())
  projectId   String
  userId      String
  role        String   @default("MEMBER") // LEAD, MEMBER
  createdAt   DateTime @default(now())

  project     Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  user        User     @relation(fields: [userId], references: [id])

  @@unique([projectId, userId])
  @@map("project_members")
}

// ============================================
// 8. 마스터 데이터
// ============================================

model Customer {
  id        String    @id @default(cuid())
  name      String    @unique
  code      String    @unique
  contact   String?
  phone     String?
  isActive  Boolean   @default(true)
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt

  projects  Project[]

  @@map("customers")
}

model Site {
  id        String    @id @default(cuid())
  name      String    @unique  // 기흥, 화성, 천안, 평택
  code      String    @unique
  address   String?
  isActive  Boolean   @default(true)
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt

  projects  Project[]

  @@map("sites")
}

model ProcessType {
  id        String    @id @default(cuid())
  name      String    @unique  // CMP, CVD, IMP 등
  code      String    @unique
  isActive  Boolean   @default(true)
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt

  projects  Project[]

  @@map("process_types")
}

model ItemType {
  id        String    @id @default(cuid())
  name      String    @unique  // 케이블, 컨트롤 시스템, 도어락 등
  code      String    @unique
  isActive  Boolean   @default(true)
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt

  projects  Project[]

  @@map("item_types")
}

model PartSpec {
  id            String    @id @default(cuid())
  category      String    // 분류 (케이블, 디스플레이, 전원 등)
  name          String
  specification String    // 상세 사양
  unit          String    @default("EA")
  unitPrice     Decimal?  // 기본 단가
  manufacturer  String?   // 제조사
  isActive      Boolean   @default(true)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  estimateItems EstimateItem[]

  @@index([category])
  @@map("part_specs")
}

// ============================================
// 9. 알림
// ============================================

model Notification {
  id          String   @id @default(cuid())
  userId      String
  type        String   // STAGE_ASSIGNED, STAGE_COMPLETED, PROJECT_CREATED 등
  title       String
  message     String
  link        String?  // 클릭 시 이동할 URL
  isRead      Boolean  @default(false)
  createdAt   DateTime @default(now())

  user        User     @relation(fields: [userId], references: [id])

  @@index([userId, isRead])
  @@index([createdAt])
  @@map("notifications")
}

// ============================================
// 10. 감사 로그 (Audit Trail)
// ============================================

model AuditLog {
  id          String   @id @default(cuid())
  userId      String
  projectId   String?
  action      String   // CREATE, UPDATE, DELETE, STAGE_CHANGE, ASSIGN 등
  entityType  String   // Project, Stage, Document, Estimate 등
  entityId    String
  changes     Json?    // { field: { before: x, after: y } }
  ipAddress   String?
  createdAt   DateTime @default(now())

  user        User     @relation(fields: [userId], references: [id])
  project     Project? @relation(fields: [projectId], references: [id])

  @@index([userId])
  @@index([projectId])
  @@index([entityType, entityId])
  @@index([createdAt])
  @@map("audit_logs")
}
```

---

## 3. 초기 시드 데이터

```typescript
// prisma/seed.ts 에서 사용

const STAGE_NAMES = [
  { number: 1, name: '의뢰 접수' },
  { number: 2, name: '담당자 지정' },
  { number: 3, name: '고객 협의' },
  { number: 4, name: '진행 여부 결정' },
  { number: 5, name: '채권 등록' },
  { number: 6, name: '견적 작성' },
  { number: 7, name: '제작' },
  { number: 8, name: '납품/설치' },
  { number: 9, name: '실적 입력' },
  { number: 10, name: '최종 문서 정리' },
];

const SITES = [
  { name: '기흥', code: 'GH' },
  { name: '화성', code: 'HS' },
  { name: '천안', code: 'CA' },
  { name: '평택', code: 'PT' },
];

const PROCESS_TYPES = [
  { name: 'CMP', code: 'CMP' },
  { name: 'CVD', code: 'CVD' },
  { name: 'IMP', code: 'IMP' },
];

const ITEM_TYPES = [
  { name: '케이블', code: 'CABLE' },
  { name: '컨트롤 시스템', code: 'CTRL' },
  { name: '도어락', code: 'DOOR' },
  { name: '디스플레이', code: 'DISP' },
];

const CUSTOMERS = [
  { name: '삼성전자', code: 'SEC' },
];
```

---

## 4. 인덱스 전략

| 테이블 | 인덱스 | 용도 |
|--------|--------|------|
| projects | status, customerId, siteId, processTypeId | 필터링 검색 |
| projects | createdAt | 시간순 정렬 |
| project_stages | assigneeId, status | My 할일 조회 |
| stage_documents | stageId, documentType | 단계별 문서 조회 |
| audit_logs | entityType + entityId | 특정 엔티티 변경 이력 |
| notifications | userId + isRead | 읽지 않은 알림 조회 |
