// ============================================
// PlusPMS TypeScript 타입 정의
// ============================================

// --- 프로젝트 ---

export type ProjectStatus = 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'HOLD' | 'CANCELLED';
export type StageStatus = 'INACTIVE' | 'ACTIVE' | 'COMPLETED' | 'SKIPPED';
export type Role = 'ADMIN' | 'MANAGER' | 'USER' | 'VIEWER';
export type DocumentType =
  | 'PROPOSAL' | 'ESTIMATE' | 'MANUFACTURE_MANUAL' | 'INSTALL_MANUAL'
  | 'PARTS_LIST' | 'SITE_PHOTO' | 'DRAWING' | 'MEETING_NOTE'
  | 'EXPORT_RECORD' | 'OTHER';
export type ManualType = 'MANUFACTURE' | 'INSTALL';

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  department?: string;
  phone?: string;
  profileImage?: string;
  isActive: boolean;
  createdAt: string;
}

export interface Project {
  id: string;
  projectNumber: string;
  name: string;
  description?: string;
  status: ProjectStatus;
  currentStage: number;
  customerId: string;
  siteId: string;
  processTypeId: string;
  itemTypeId: string;
  bondNumber?: string;
  bondRegistered: boolean;
  startDate?: string;
  dueDate?: string;
  completedDate?: string;
  createdById: string;
  copiedFromId?: string;
  createdAt: string;
  updatedAt: string;

  // 관계 데이터 (include 시)
  customer?: Customer;
  site?: Site;
  processType?: ProcessType;
  itemType?: ItemType;
  createdBy?: User;
  stages?: ProjectStage[];
  members?: ProjectMember[];
}

export interface ProjectStage {
  id: string;
  projectId: string;
  stageNumber: number;
  stageName: string;
  status: StageStatus;
  assigneeId?: string;
  startDate?: string;
  completedDate?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;

  // 관계
  assignee?: User;
  documents?: StageDocument[];
}

export interface StageDocument {
  id: string;
  stageId: string;
  documentType: DocumentType;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  version: number;
  description?: string;
  uploadedById: string;
  createdAt: string;

  // 관계
  uploadedBy?: User;
}

export interface Estimate {
  id: string;
  projectId: string;
  estimateNumber: string;
  version: number;
  title: string;
  totalAmount: number;
  taxAmount: number;
  grandTotal: number;
  notes?: string;
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED';
  createdById: string;
  createdAt: string;
  updatedAt: string;

  // 관계
  items?: EstimateItem[];
  createdBy?: User;
}

export interface EstimateItem {
  id: string;
  estimateId: string;
  partSpecId?: string;
  itemName: string;
  specification?: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  sortOrder: number;
  remarks?: string;

  // 관계
  partSpec?: PartSpec;
}

export interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  role: string;
  createdAt: string;
  user?: User;
}

// --- 마스터 데이터 ---

export interface Customer {
  id: string;
  name: string;
  code: string;
  contact?: string;
  phone?: string;
  isActive: boolean;
}

export interface Site {
  id: string;
  name: string;
  code: string;
  address?: string;
  isActive: boolean;
}

export interface ProcessType {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
}

export interface ItemType {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
}

export interface PartSpec {
  id: string;
  category: string;
  name: string;
  specification: string;
  unit: string;
  unitPrice?: number;
  manufacturer?: string;
  isActive: boolean;
}

// --- 알림 ---

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  link?: string;
  isRead: boolean;
  createdAt: string;
}

// --- 감사 로그 ---

export interface AuditLog {
  id: string;
  userId: string;
  projectId?: string;
  action: string;
  entityType: string;
  entityId: string;
  changes?: Record<string, { before: unknown; after: unknown }>;
  ipAddress?: string;
  createdAt: string;
  user?: User;
}

// --- API 응답 ---

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown[];
  };
  meta?: PaginationMeta;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// --- 대시보드 ---

export interface DashboardStats {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  holdProjects: number;
  myTasks: number;
}

export interface StageDistribution {
  stageNumber: number;
  stageName: string;
  count: number;
}

export interface RecentActivity {
  id: string;
  type: 'PROJECT_CREATED' | 'STAGE_COMPLETED' | 'DOCUMENT_UPLOADED' | 'ESTIMATE_CREATED';
  description: string;
  projectId: string;
  projectName: string;
  userName: string;
  createdAt: string;
}

// --- 폼 입력 ---

export interface CreateProjectInput {
  name: string;
  description?: string;
  customerId: string;
  siteId: string;
  processTypeId: string;
  itemTypeId: string;
  startDate?: string;
  dueDate?: string;
  stageAssignees?: { stageNumber: number; assigneeId: string }[];
  copyFromId?: string;
}

export interface CreateEstimateInput {
  title: string;
  notes?: string;
  items: {
    partSpecId?: string;
    itemName: string;
    specification?: string;
    unit: string;
    quantity: number;
    unitPrice: number;
    remarks?: string;
  }[];
}
