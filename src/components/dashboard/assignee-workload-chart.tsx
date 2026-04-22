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
  Cell,
} from "recharts";

const COLORS = [
  "#6366f1", "#3b82f6", "#10b981", "#f59e0b",
  "#ec4899", "#8b5cf6", "#0ea5e9", "#f97316",
];

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
    <ResponsiveContainer width="100%" height={320}>
      <BarChart
        data={chartData}
        layout="horizontal"
        margin={{ top: 16, right: 24, left: 16, bottom: 32 }}
      >
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
        <XAxis
          type="category"
          dataKey="name"
          tick={{ fontSize: 12, fill: "#64748b" }}
          interval={0}
          angle={-20}
          textAnchor="end"
          height={60}
        />
        <YAxis
          type="number"
          allowDecimals={false}
          tick={{ fontSize: 12, fill: "#64748b" }}
          width={40}
        />
        <Tooltip
          formatter={(value: number) => [`${value}건`, "담당 업무"]}
          contentStyle={{ fontSize: 13, borderRadius: 8 }}
        />
        <Bar dataKey="업무수" radius={[4, 4, 0, 0]} maxBarSize={48}>
          {chartData.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
          <LabelList
            dataKey="업무수"
            position="top"
            style={{ fontSize: 12, fill: "#334155" }}
            formatter={(v: number) => `${v}건`}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
