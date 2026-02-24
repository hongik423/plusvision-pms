# 플러스비젼 PMS - API 설계 문서

> **버전:** 1.0 | **작성일:** 2026-02-24
> **패턴:** RESTful API (Next.js API Routes)
> **인증:** NextAuth.js JWT 토큰

---

## 1. API 규칙

### 1.1 공통 규칙
- Base URL: `/api/v1`
- 인증: `Authorization: Bearer <token>` (NextAuth session 기반)
- 응답 형식: JSON
- 페이지네이션: `?page=1&limit=20`
- 정렬: `?sort=createdAt&order=desc`

### 1.2 응답 형식
```typescript
// 성공 응답
{
  "success": true,
  "data": { ... },
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}

// 에러 응답
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "프로젝트명은 필수입니다",
    "details": [...]
  }
}
```

---

## 2. API 엔드포인트

### 2.1 인증 (Auth)
| Method | Endpoint | 설명 | 권한 |
|--------|----------|------|------|
| POST | `/api/auth/signin` | 로그인 | Public |
| POST | `/api/auth/signup` | 회원가입 | Public |
| POST | `/api/auth/signout` | 로그아웃 | All |
| GET | `/api/auth/session` | 세션 조회 | All |

### 2.2 프로젝트 (Projects)
| Method | Endpoint | 설명 | 권한 |
|--------|----------|------|------|
| GET | `/api/v1/projects` | 프로젝트 목록 | All |
| POST | `/api/v1/projects` | 프로젝트 생성 | USER+ |
| GET | `/api/v1/projects/:id` | 프로젝트 상세 | All |
| PATCH | `/api/v1/projects/:id` | 프로젝트 수정 | MANAGER+ |
| DELETE | `/api/v1/projects/:id` | 프로젝트 삭제 | ADMIN |
| POST | `/api/v1/projects/:id/copy` | 프로젝트 복사 생성 | USER+ |
| GET | `/api/v1/projects/similar` | 유사 프로젝트 검색 | All |

```typescript
// GET /api/v1/projects 쿼리 파라미터
interface ProjectListQuery {
  page?: number;
  limit?: number;
  status?: ProjectStatus;
  siteId?: string;
  processTypeId?: string;
  itemTypeId?: string;
  customerId?: string;
  assigneeId?: string;
  search?: string;        // 키워드 검색
  startDate?: string;     // 등록일 범위 시작
  endDate?: string;       // 등록일 범위 종료
  sort?: 'createdAt' | 'name' | 'dueDate' | 'status';
  order?: 'asc' | 'desc';
}

// POST /api/v1/projects 요청 Body
interface CreateProjectRequest {
  name: string;
  description?: string;
  customerId: string;
  siteId: string;
  processTypeId: string;
  itemTypeId: string;
  startDate?: string;
  dueDate?: string;
  stageAssignees?: {      // 단계별 담당자 (선택)
    stageNumber: number;
    assigneeId: string;
  }[];
  copyFromId?: string;    // 복사 원본 ID
}
```

### 2.3 프로젝트 단계 (Stages)
| Method | Endpoint | 설명 | 권한 |
|--------|----------|------|------|
| GET | `/api/v1/projects/:id/stages` | 단계 목록 | All |
| GET | `/api/v1/projects/:id/stages/:stageNumber` | 단계 상세 | All |
| PATCH | `/api/v1/projects/:id/stages/:stageNumber` | 단계 수정 | 담당자+ |
| POST | `/api/v1/projects/:id/stages/:stageNumber/complete` | 단계 완료 | 담당자+ |
| POST | `/api/v1/projects/:id/stages/:stageNumber/assign` | 담당자 지정 | MANAGER+ |

```typescript
// POST /api/v1/projects/:id/stages/:stageNumber/complete
interface CompleteStageRequest {
  notes?: string;
  // 4단계 전용
  decision?: 'PROCEED' | 'HOLD' | 'CANCEL';
  decisionReason?: string;
}
```

### 2.4 문서 (Documents)
| Method | Endpoint | 설명 | 권한 |
|--------|----------|------|------|
| GET | `/api/v1/projects/:id/documents` | 프로젝트 문서 목록 | All |
| POST | `/api/v1/projects/:id/documents` | 문서 업로드 | USER+ |
| GET | `/api/v1/documents/:docId` | 문서 상세/다운로드 | All |
| DELETE | `/api/v1/documents/:docId` | 문서 삭제 | ADMIN |

```typescript
// POST /api/v1/projects/:id/documents (multipart/form-data)
interface UploadDocumentRequest {
  file: File;
  stageNumber: number;
  documentType: DocumentType;
  description?: string;
}
```

### 2.5 견적서 (Estimates)
| Method | Endpoint | 설명 | 권한 |
|--------|----------|------|------|
| GET | `/api/v1/projects/:id/estimates` | 견적서 목록 | All |
| POST | `/api/v1/projects/:id/estimates` | 견적서 생성 | USER+ |
| GET | `/api/v1/estimates/:estId` | 견적서 상세 | All |
| PATCH | `/api/v1/estimates/:estId` | 견적서 수정 | USER+ |
| DELETE | `/api/v1/estimates/:estId` | 견적서 삭제 | ADMIN |
| GET | `/api/v1/estimates/:estId/pdf` | PDF 내보내기 | All |

```typescript
// POST /api/v1/projects/:id/estimates
interface CreateEstimateRequest {
  title: string;
  notes?: string;
  items: {
    partSpecId?: string;    // 마스터 부품 ID (없으면 자유입력)
    itemName: string;
    specification?: string;
    unit: string;
    quantity: number;
    unitPrice: number;
    remarks?: string;
  }[];
}
```

### 2.6 마스터 데이터 (Master)
| Method | Endpoint | 설명 | 권한 |
|--------|----------|------|------|
| GET | `/api/v1/master/sites` | 사업장 목록 | All |
| POST | `/api/v1/master/sites` | 사업장 추가 | ADMIN |
| PATCH | `/api/v1/master/sites/:id` | 사업장 수정 | ADMIN |
| GET | `/api/v1/master/process-types` | 공정 유형 목록 | All |
| POST | `/api/v1/master/process-types` | 공정 유형 추가 | ADMIN |
| GET | `/api/v1/master/item-types` | 품목 유형 목록 | All |
| POST | `/api/v1/master/item-types` | 품목 유형 추가 | ADMIN |
| GET | `/api/v1/master/customers` | 고객사 목록 | All |
| POST | `/api/v1/master/customers` | 고객사 추가 | ADMIN |
| GET | `/api/v1/master/part-specs` | 부품 스펙 목록 | All |
| POST | `/api/v1/master/part-specs` | 부품 스펙 추가 | ADMIN |
| PATCH | `/api/v1/master/part-specs/:id` | 부품 스펙 수정 | ADMIN |

### 2.7 사용자 (Users)
| Method | Endpoint | 설명 | 권한 |
|--------|----------|------|------|
| GET | `/api/v1/users` | 사용자 목록 | ADMIN |
| GET | `/api/v1/users/:id` | 사용자 상세 | ADMIN |
| PATCH | `/api/v1/users/:id` | 사용자 수정 | ADMIN |
| PATCH | `/api/v1/users/:id/role` | 역할 변경 | ADMIN |
| GET | `/api/v1/users/me` | 내 정보 | All |
| GET | `/api/v1/users/me/tasks` | My 할일 | All |

### 2.8 알림 (Notifications)
| Method | Endpoint | 설명 | 권한 |
|--------|----------|------|------|
| GET | `/api/v1/notifications` | 알림 목록 | All |
| PATCH | `/api/v1/notifications/:id/read` | 읽음 처리 | All |
| POST | `/api/v1/notifications/read-all` | 전체 읽음 | All |
| GET | `/api/v1/notifications/unread-count` | 안읽은 수 | All |

### 2.9 대시보드 (Dashboard)
| Method | Endpoint | 설명 | 권한 |
|--------|----------|------|------|
| GET | `/api/v1/dashboard/stats` | 통계 요약 | All |
| GET | `/api/v1/dashboard/my-tasks` | My 할일 | All |
| GET | `/api/v1/dashboard/recent-activities` | 최근 활동 | All |
| GET | `/api/v1/dashboard/stage-distribution` | 단계별 분포 | All |

### 2.10 검색 (Search)
| Method | Endpoint | 설명 | 권한 |
|--------|----------|------|------|
| GET | `/api/v1/search` | 통합 검색 | All |
| GET | `/api/v1/search/suggestions` | 자동완성 | All |

```typescript
// GET /api/v1/search
interface SearchQuery {
  q: string;              // 검색 키워드
  type?: 'project' | 'document' | 'all';
  page?: number;
  limit?: number;
}
```

### 2.11 감사 로그 (Audit Logs)
| Method | Endpoint | 설명 | 권한 |
|--------|----------|------|------|
| GET | `/api/v1/audit-logs` | 전체 로그 | ADMIN |
| GET | `/api/v1/projects/:id/audit-logs` | 프로젝트 로그 | MANAGER+ |

---

## 3. 에러 코드

| 코드 | HTTP | 설명 |
|------|------|------|
| AUTH_REQUIRED | 401 | 인증 필요 |
| FORBIDDEN | 403 | 권한 없음 |
| NOT_FOUND | 404 | 리소스 없음 |
| VALIDATION_ERROR | 400 | 입력값 오류 |
| STAGE_ORDER_ERROR | 400 | 이전 단계 미완료 |
| FILE_TOO_LARGE | 413 | 파일 크기 초과 |
| FILE_TYPE_NOT_ALLOWED | 415 | 지원하지 않는 파일 |
| DUPLICATE_ENTRY | 409 | 중복 데이터 |
| INTERNAL_ERROR | 500 | 서버 오류 |
