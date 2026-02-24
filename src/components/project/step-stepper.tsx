import { STAGE_NAMES } from "@/lib/constants";
import type { StageStatus } from "@/types";

interface StageView {
  stageNumber: number;
  status: StageStatus;
  assigneeName?: string | null;
}

export function StepStepper({ stages }: { stages: StageView[] }) {
  return (
    <ol className="grid gap-3 md:grid-cols-5 lg:grid-cols-10">
      {stages.map((stage) => {
        const statusColor =
          stage.status === "COMPLETED"
            ? "bg-green-500 text-white"
            : stage.status === "ACTIVE"
              ? "bg-blue-500 text-white"
              : "bg-gray-200 text-gray-700";

        return (
          <li key={stage.stageNumber} className="rounded-lg border bg-white p-3">
            <div className={`mb-2 inline-flex rounded px-2 py-1 text-xs font-semibold ${statusColor}`}>
              {stage.stageNumber}단계
            </div>
            <p className="text-sm font-semibold">{STAGE_NAMES[stage.stageNumber]}</p>
            <p className="mt-1 text-xs text-slate-500">
              담당: {stage.assigneeName ?? "미지정"}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
