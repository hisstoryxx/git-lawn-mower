"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

const COLORS = [
  "#39d353", "#26a641", "#006d32", "#0e4429",
  "#58a6ff", "#3b82f6", "#8b5cf6", "#a855f7",
  "#f97316", "#ef4444",
];

interface ProjectChartProps {
  data: { name: string; commits: number }[];
}

export default function ProjectChart({ data }: ProjectChartProps) {
  const top10 = data.slice(0, 10);

  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5">
      <h3 className="text-lg font-semibold text-white mb-4">Projects</h3>
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={top10} layout="vertical" margin={{ left: 10, right: 20 }}>
            <XAxis type="number" stroke="#4b5563" fontSize={12} />
            <YAxis
              type="category"
              dataKey="name"
              stroke="#4b5563"
              fontSize={11}
              width={120}
              tickFormatter={(v: string) => (v.length > 18 ? v.slice(0, 18) + "..." : v)}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1f2937",
                border: "1px solid #374151",
                borderRadius: "8px",
                fontSize: "13px",
              }}
              labelStyle={{ color: "#d1d5db" }}
            />
            <Bar dataKey="commits" radius={[0, 4, 4, 0]}>
              {top10.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
