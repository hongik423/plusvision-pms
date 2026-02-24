export type LegacyProjectRow = {
  legacyId: string;
  name: string;
  customerCode: string;
  siteCode: string;
  processCode: string;
  itemCode: string;
  description?: string;
};

export type NormalizedProjectRow = LegacyProjectRow & {
  errors: string[];
};

export type DocumentClassification = {
  stageNumber: number;
  documentType:
    | "PROPOSAL"
    | "ESTIMATE"
    | "MANUFACTURE_MANUAL"
    | "INSTALL_MANUAL"
    | "PARTS_LIST"
    | "SITE_PHOTO"
    | "DRAWING"
    | "MEETING_NOTE"
    | "EXPORT_RECORD"
    | "OTHER";
};

export type MigrationFileMap = {
  driveFileId: string;
  fileName: string;
  stageNumber: number;
  documentType: DocumentClassification["documentType"];
};
