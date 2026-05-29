"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type ChartRow = {
  day: string;
  opens: number;
  unique: number;
};

export function OpenChart({ data }: { data: ChartRow[] }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ left: -24, right: 10, top: 10, bottom: 0 }}>
          <defs>
            <linearGradient id="opens" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="unique" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.28} />
              <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-slate-200 dark:text-slate-800" />
          <XAxis dataKey="day" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
          <YAxis allowDecimals={false} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
          <Tooltip
            contentStyle={{
              borderRadius: 12,
              border: "1px solid rgb(226 232 240)",
              boxShadow: "0 18px 45px rgba(15,23,42,.12)",
            }}
          />
          <Area type="monotone" dataKey="opens" stroke="#10b981" fill="url(#opens)" strokeWidth={2} />
          <Area type="monotone" dataKey="unique" stroke="#0ea5e9" fill="url(#unique)" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
