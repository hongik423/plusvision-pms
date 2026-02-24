"use client";

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

type StageRow = {
  stageNumber: number;
  stageName: string;
  count: number;
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
  }));

  return (
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
        />
        <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={48}>
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
  );
}
