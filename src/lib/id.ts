import { randomUUID } from "crypto";

export function generatePlusPmsId(entity: string) {
  const normalizedEntity = entity.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_");
  const uid = randomUUID().replace(/-/g, "");
  return `plusPMS_${normalizedEntity}_${uid}`;
}
