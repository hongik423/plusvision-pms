"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LabelList,
} from "recharts";

type WorkloadRow = {
  assigneeId: string;
  assigneeName: string;
  taskCount: number;
};

export function AssigneeWorkloadChart({ data }: { data: WorkloadRow[] }) {
  if (data.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-slate-500">진행중 업무가 없습니다.</p>
    );
  }

  // 최대 8명까지 표시
  const chartData = data.slice(0, 8).map((row) => ({
    name: row.assigneeName,
    업무수: row.taskCount,
  }));

  return (
    <ResponsiveContainer width="100%" height={Math.max(160, chartData.length * 48)}>
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ top: 8, right: 48, left: 8, bottom: 8 }}
      >
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12, fill: "#64748b" }} />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fontSize: 13, fill: "#334155" }}
          width={72}
        />
        <Tooltip
          formatter={(value: number) => [`${value}건`, "담당 업무"]}
          contentStyle={{ fontSize: 13, borderRadius: 8 }}
        />
        <Bar dataKey="업무수" fill="#6366f1" radius={[0, 4, 4, 0]} maxBarSize={32}>
          <LabelList
            dataKey="업무수"
            position="right"
            style={{ fontSize: 12, fill: "#334155" }}
            formatter={(v: number) => `${v}건`}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
