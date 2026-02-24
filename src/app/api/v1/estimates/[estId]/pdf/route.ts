import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { readFileSync } from "fs";
import { join } from "path";
import { fail } from "@/lib/api-response";
import { requireApiRole } from "@/lib/api-auth";
import { getEstimateById } from "@/services/estimate-service";
import { getActiveTemplate, renderTemplate } from "@/services/template-service";

export async function GET(_request: Request, { params }: { params: { estId: string } }) {
  const gate = await requireApiRole("VIEWER");
  if (!gate.ok) {
    return gate.response;
  }
  const estimate = await getEstimateById(params.estId);
  if (!estimate) {
    return fail({ code: "NOT_FOUND", message: "견적서를 찾을 수 없습니다." }, 404);
  }

  const template = getActiveTemplate("ESTIMATE");
  const variables = {
    projectName: estimate.project.name,
    customerName: "",
    siteName: "",
    processTypeName: "",
    itemTypeName: "",
  };

  const title = template ? renderTemplate(template.titleTemplate, variables) : estimate.title;
  const bodyText = template ? renderTemplate(template.bodyTemplate, variables) : estimate.notes ?? "";
  const itemsText = estimate.items
    .map(
      (item, index) =>
        `${index + 1}. ${item.itemName} / ${item.specification ?? "-"} / 수량 ${item.quantity.toString()} / 단가 ${item.unitPrice.toLocaleString()}원 / 금액 ${item.amount.toLocaleString()}원`,
    )
    .join("\n");

  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);

  const fontPath = join(process.cwd(), "public", "fonts", "NotoSansKR-Regular.ttf");
  const fontBytes = readFileSync(fontPath);
  const font = await pdf.embedFont(fontBytes);

  const page = pdf.addPage([595, 842]);

  const fmt = (n: { toString: () => string }) => Number(n.toString()).toLocaleString("ko-KR");

  let y = 800;
  page.drawText("PlusPMS 견적서", { x: 48, y, size: 20, font, color: rgb(0.07, 0.32, 0.63) });
  y -= 6;
  page.drawLine({ start: { x: 48, y }, end: { x: 547, y }, thickness: 1.5, color: rgb(0.07, 0.32, 0.63) });
  y -= 22;
  page.drawText(`견적번호: ${estimate.estimateNumber}`, { x: 48, y, size: 11, font });
  y -= 18;
  page.drawText(`제  목: ${title}`, { x: 48, y, size: 11, font });
  y -= 28;
  page.drawLine({ start: { x: 48, y }, end: { x: 547, y }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) });
  y -= 18;
  page.drawText(`공급가액: ${fmt(estimate.totalAmount)} 원`, { x: 48, y, size: 12, font });
  y -= 17;
  page.drawText(`부  가  세 (10%): ${fmt(estimate.taxAmount)} 원`, { x: 48, y, size: 12, font });
  y -= 17;
  page.drawText(`합  계 금  액: ${fmt(estimate.grandTotal)} 원`, { x: 48, y, size: 14, font, color: rgb(0.07, 0.32, 0.63) });
  y -= 28;
  page.drawLine({ start: { x: 48, y }, end: { x: 547, y }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) });
  y -= 18;
  page.drawText("■ 비고", { x: 48, y, size: 12, font, color: rgb(0.2, 0.2, 0.2) });
  y -= 16;
  drawMultiLine(page, bodyText || "-", 48, y, font, 10);
  y -= Math.max(16, (bodyText.split("\n").length + 1) * 13);
  page.drawText("■ 견적 항목", { x: 48, y, size: 12, font, color: rgb(0.2, 0.2, 0.2) });
  y -= 16;
  drawMultiLine(page, itemsText || "-", 48, y, font, 10);

  const bytes = await pdf.save();
  const pdfBody = Buffer.from(bytes);

  return new Response(pdfBody, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${estimate.estimateNumber}.pdf"`,
    },
  });
}

function drawMultiLine(
  page: import("pdf-lib").PDFPage,
  text: string,
  x: number,
  yStart: number,
  font: import("pdf-lib").PDFFont,
  size: number,
) {
  const lines = text.split("\n");
  let y = yStart;
  for (const line of lines) {
    if (y < 60) break;
    page.drawText(line.slice(0, 80), { x, y, size, font });
    y -= size + 4;
  }
}
