import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

export type DocumentTemplateType = "ESTIMATE" | "PROPOSAL";

export type DocumentTemplate = {
  id: string;
  type: DocumentTemplateType;
  name: string;
  titleTemplate: string;
  bodyTemplate: string;
  isActive: boolean;
  updatedAt: string;
};

const templatesFilePath = resolve(process.cwd(), "data", "document-templates.json");

function readTemplates() {
  if (!existsSync(templatesFilePath)) {
    return [] as DocumentTemplate[];
  }
  const raw = readFileSync(templatesFilePath, "utf-8");
  return JSON.parse(raw) as DocumentTemplate[];
}

function writeTemplates(rows: DocumentTemplate[]) {
  const folder = dirname(templatesFilePath);
  if (!existsSync(folder)) {
    mkdirSync(folder, { recursive: true });
  }
  writeFileSync(templatesFilePath, `${JSON.stringify(rows, null, 2)}\n`, "utf-8");
}

export function listTemplates() {
  return readTemplates().sort((a, b) => a.name.localeCompare(b.name, "ko-KR"));
}

export function getActiveTemplate(type: DocumentTemplateType) {
  return readTemplates().find((template) => template.type === type && template.isActive) ?? null;
}

export function createTemplate(input: {
  type: DocumentTemplateType;
  name: string;
  titleTemplate: string;
  bodyTemplate: string;
}) {
  const rows = readTemplates();
  const nextRow: DocumentTemplate = {
    id: `pluspms_template_${randomUUID().replace(/-/g, "")}`,
    type: input.type,
    name: input.name,
    titleTemplate: input.titleTemplate,
    bodyTemplate: input.bodyTemplate,
    isActive: rows.every((row) => row.type !== input.type),
    updatedAt: new Date().toISOString(),
  };
  rows.push(nextRow);
  writeTemplates(rows);
  return nextRow;
}

export function updateTemplate(
  templateId: string,
  input: Partial<{
    name: string;
    titleTemplate: string;
    bodyTemplate: string;
    isActive: boolean;
  }>,
) {
  const rows = readTemplates();
  const target = rows.find((row) => row.id === templateId);
  if (!target) {
    return null;
  }

  if (input.isActive === true) {
    rows.forEach((row) => {
      if (row.type === target.type) {
        row.isActive = row.id === target.id;
      }
    });
  }

  target.name = input.name ?? target.name;
  target.titleTemplate = input.titleTemplate ?? target.titleTemplate;
  target.bodyTemplate = input.bodyTemplate ?? target.bodyTemplate;
  if (input.isActive === false) {
    target.isActive = false;
  }
  target.updatedAt = new Date().toISOString();
  writeTemplates(rows);
  return target;
}

export function renderTemplate(
  source: string,
  variables: Record<string, string | number | null | undefined>,
) {
  return source.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, token: string) => {
    const value = variables[token];
    return value === undefined || value === null ? "" : String(value);
  });
}
