"use client";

import { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from "recharts";
import Link from "next/link";

type Project = { id: string; name: string };

type StageRow = {
  stageNumber: number;
  stageName: string;
  count: number;
  projects: Project[];
};

const STAGE_COLORS = [
  "#3b82f6", // 1단계
  "#6366f1", // 2단계
  "#8b5cf6", // 3단계
  "#ec4899", // 4단계
  "#f59e0b", // 5단계
  "#10b981", // 6단계
  "#14b8a6", // 7단계
  "#0ea5e9", // 8단계
  "#f97316", // 9단계
  "#84cc16", // 10단계
];

export function StageDistributionChart({ data }: { data: StageRow[] }) {
  const [selected, setSelected] = useState<StageRow | null>(null);

  if (data.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-slate-500">표시할 단계 분포 데이터가 없습니다.</p>
    );
  }

  const chartData = data.map((row) => ({
    name: `${row.stageNumber}단계`,
    label: row.stageName,
    count: row.count,
    colorIndex: row.stageNumber - 1,
    raw: row,
  }));

  return (
    <>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={chartData} margin={{ top: 16, right: 16, left: 0, bottom: 40 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 12, fill: "#64748b" }}
            angle={-35}
            textAnchor="end"
            interval={0}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 12, fill: "#64748b" }}
            width={28}
          />
          <Tooltip
            formatter={(value: number) => [`${value}건`, "프로젝트 수"]}
            labelFormatter={(label: string, payload) => {
              const item = payload?.[0]?.payload as { label?: string } | undefined;
              return item?.label ?? label;
            }}
            contentStyle={{ fontSize: 13, borderRadius: 8 }}
            cursor={{ fill: "rgba(0,0,0,0.05)" }}
          />
          <Bar
            dataKey="count"
            radius={[4, 4, 0, 0]}
            maxBarSize={48}
            style={{ cursor: "pointer" }}
            onClick={(d) => setSelected(d.raw as StageRow)}
          >
            {chartData.map((entry) => (
              <Cell
                key={`cell-${entry.name}`}
                fill={STAGE_COLORS[entry.colorIndex % STAGE_COLORS.length]}
              />
            ))}
            <LabelList dataKey="count" position="top" style={{ fontSize: 12, fill: "#334155" }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setSelected(null)}
        >
          <div
            className="w-80 rounded-xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-1 text-lg font-bold">
              {selected.stageNumber}단계 — {selected.stageName}
            </h3>
            <p className="mb-4 text-sm text-slate-500">총 {selected.count}개 프로젝트</p>
            <ul className="space-y-2">
              {selected.projects.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/projects/${p.id}`}
                    className="block rounded-lg border px-4 py-2.5 text-sm font-medium hover:bg-slate-50 transition-colors"
                    onClick={() => setSelected(null)}
                  >
                    {p.name}
                  </Link>
                </li>
              ))}
            </ul>
            <button
              className="mt-4 w-full rounded-lg bg-slate-100 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 transition-colors"
              onClick={() => setSelected(null)}
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </>
  );
}
