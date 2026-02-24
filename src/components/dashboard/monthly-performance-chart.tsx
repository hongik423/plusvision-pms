"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type MonthlyRow = {
  month: string;
  completedCount: number;
};

function formatMonth(yyyyMm: string) {
  const [year, month] = yyyyMm.split("-");
  return `${year?.slice(2)}년 ${Number(month)}월`;
}

export function MonthlyPerformanceChart({ data }: { data: MonthlyRow[] }) {
  if (data.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-slate-500">표시할 월별 실적이 없습니다.</p>
    );
  }

  const chartData = data.map((row) => ({
    month: formatMonth(row.month),
    완료건수: row.completedCount,
  }));

  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={chartData} margin={{ top: 16, right: 16, left: 0, bottom: 8 }}>
        <defs>
          <linearGradient id="completedGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
        <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#64748b" }} />
        <YAxis
          allowDecimals={false}
          tick={{ fontSize: 12, fill: "#64748b" }}
          width={28}
        />
        <Tooltip
          formatter={(value: number) => [`${value}건`, "완료 프로젝트"]}
          contentStyle={{ fontSize: 13, borderRadius: 8 }}
        />
        <Area
          type="monotone"
          dataKey="완료건수"
          stroke="#3b82f6"
          strokeWidth={2.5}
          fill="url(#completedGradient)"
          dot={{ fill: "#3b82f6", r: 4 }}
          activeDot={{ r: 6 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
