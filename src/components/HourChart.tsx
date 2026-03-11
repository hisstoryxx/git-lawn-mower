"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface HourChartProps {
  data: { hour: number; count: number }[];
}

export default function HourChart({ data }: HourChartProps) {
  const formatted = data.map((d) => ({
    ...d,
    label: `${d.hour.toString().padStart(2, "0")}:00`,
  }));

  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5">
      <h3 className="text-lg font-semibold text-white mb-4">Coding Hours</h3>
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={formatted}>
            <defs>
              <linearGradient id="hourGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#39d353" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#39d353" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="label"
              stroke="#4b5563"
              fontSize={11}
              interval={2}
            />
            <YAxis stroke="#4b5563" fontSize={12} />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1f2937",
                border: "1px solid #374151",
                borderRadius: "8px",
                fontSize: "13px",
              }}
              labelStyle={{ color: "#d1d5db" }}
            />
            <Area
              type="monotone"
              dataKey="count"
              stroke="#39d353"
              fill="url(#hourGradient)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
