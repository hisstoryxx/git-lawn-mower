"use client";

interface StatsCardsProps {
  totalCommits: number;
  mergeCommits: number;
  totalProjects: number;
  currentStreak: number;
  longestStreak: number;
  busiestDay: { date: string; count: number };
}

export default function StatsCards({
  totalCommits,
  mergeCommits,
  totalProjects,
  currentStreak,
  longestStreak,
  busiestDay,
}: StatsCardsProps) {
  const stats = [
    {
      label: "Commits",
      value: totalCommits.toLocaleString(),
      sub: mergeCommits > 0 ? `+ ${mergeCommits} merges` : undefined,
      color: "text-green-400",
      bg: "from-green-500/10 to-transparent",
    },
    {
      label: "Projects",
      value: totalProjects.toString(),
      color: "text-blue-400",
      bg: "from-blue-500/10 to-transparent",
    },
    {
      label: "Streak",
      value: currentStreak > 0 ? `${currentStreak} days` : "-",
      sub: `Best: ${longestStreak} days`,
      color: "text-orange-400",
      bg: "from-orange-500/10 to-transparent",
    },
    {
      label: "Busiest Day",
      value: busiestDay.date || "-",
      sub: busiestDay.count > 0 ? `${busiestDay.count} commits` : undefined,
      color: "text-purple-400",
      bg: "from-purple-500/10 to-transparent",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className={`bg-gradient-to-br ${stat.bg} border border-gray-800 rounded-xl p-5`}
        >
          <div className="text-gray-400 text-sm">{stat.label}</div>
          <div className={`text-2xl font-bold mt-1 ${stat.color}`}>{stat.value}</div>
          {stat.sub && <div className="text-gray-500 text-xs mt-1">{stat.sub}</div>}
        </div>
      ))}
    </div>
  );
}
