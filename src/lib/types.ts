export interface HeatmapDay {
  date: string;
  count: number;
  commits: { title: string; project: string; time: string }[];
  week: number;
  dayOfWeek: number;
}

export interface DashboardData {
  heatmap: HeatmapDay[];
  projectStats: { name: string; commits: number }[];
  hourStats: { hour: number; count: number }[];
  totalCommits: number;
  mergeCommits: number;
  totalProjects: number;
  currentStreak: number;
  longestStreak: number;
  busiestDay: { date: string; count: number };
  commitMessages: string[];
}
