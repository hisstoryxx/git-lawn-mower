import {
  eachDayOfInterval,
  format,
  startOfWeek,
  differenceInWeeks,
  parseISO,
} from "date-fns";
import { HeatmapDay, DashboardData } from "@/lib/types";

export interface Settings {
  gitlabToken: string;
  gitlabUrl: string;
  gitlabUsername: string;
  gitlabName: string;
  gitlabEmail: string;
  monthsBack: number;
}

interface GitLabProject {
  id: number;
  name: string;
  web_url: string;
  path_with_namespace: string;
}

interface GitLabCommit {
  id: string;
  short_id: string;
  title: string;
  message: string;
  author_name: string;
  authored_date: string;
  committed_date: string;
  web_url: string;
  project_id: number;
}

const SETTINGS_KEY = "lawn-mower-settings";
const KST_OFFSET = 9 * 60 * 60 * 1000; // UTC+9

function toKST(dateStr: string): Date {
  const utc = new Date(dateStr);
  return new Date(utc.getTime() + KST_OFFSET);
}

function toKSTDateString(dateStr: string): string {
  return format(toKST(dateStr), "yyyy-MM-dd");
}

function isMergeCommit(title: string): boolean {
  return /^Merge branch\s/.test(title) || /^Merge remote-tracking branch\s/.test(title);
}

export function loadSettings(): Settings | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(SETTINGS_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveSettings(settings: Settings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function clearSettings(): void {
  localStorage.removeItem(SETTINGS_KEY);
}

async function fetchAllPages<T>(
  gitlabUrl: string,
  token: string,
  endpoint: string,
  params: Record<string, string> = {}
): Promise<T[]> {
  const allItems: T[] = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const url = new URL(`${gitlabUrl}/api/v4${endpoint}`);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    url.searchParams.set("page", String(page));
    url.searchParams.set("per_page", String(perPage));

    const res = await fetch(url.toString(), {
      headers: { "PRIVATE-TOKEN": token },
    });

    if (!res.ok) {
      throw new Error(`GitLab API error: ${res.status} ${res.statusText}`);
    }

    const items: T[] = await res.json();
    if (items.length === 0) break;

    allItems.push(...items);

    // Use x-next-page header as primary, fallback to checking if we got a full page
    const nextPage = res.headers.get("x-next-page");
    if (nextPage && nextPage !== "") {
      page = parseInt(nextPage, 10);
    } else if (items.length === perPage) {
      // Header missing but we got a full page, try next
      page++;
    } else {
      break;
    }
  }

  return allItems;
}

export async function fetchDashboardData(
  settings: Settings,
  onProgress?: (msg: string) => void
): Promise<DashboardData> {
  const { gitlabUrl, gitlabToken, gitlabUsername } = settings;

  onProgress?.("Fetching projects...");
  const projects = await fetchAllPages<GitLabProject>(
    gitlabUrl,
    gitlabToken,
    "/projects",
    { membership: "true", simple: "true", archived: "false", order_by: "last_activity_at" }
  );
  onProgress?.(`Found ${projects.length} projects. Fetching commits...`);

  const sinceDate = new Date();
  sinceDate.setMonth(sinceDate.getMonth() - (settings.monthsBack || 12));
  const since = sinceDate.toISOString();

  // Try multiple author identifiers to catch all commits
  const authorSet = new Map<string, boolean>();
  if (settings.gitlabEmail) authorSet.set(settings.gitlabEmail, true);
  if (settings.gitlabName) authorSet.set(settings.gitlabName, true);
  if (gitlabUsername) authorSet.set(gitlabUsername, true);
  const authorQueries = Array.from(authorSet.keys());

  const allCommits: (GitLabCommit & { project_name: string })[] = [];
  const seenCommitIds = new Set<string>();
  const batchSize = 10;

  for (let i = 0; i < projects.length; i += batchSize) {
    const batch = projects.slice(i, i + batchSize);
    onProgress?.(`Scanning projects ${i + 1}-${Math.min(i + batchSize, projects.length)} of ${projects.length}...`);

    const results = await Promise.all(
      batch.map(async (project) => {
        const projectCommits: (GitLabCommit & { project_name: string })[] = [];
        for (const author of authorQueries) {
          try {
            const commits = await fetchAllPages<GitLabCommit>(
              gitlabUrl,
              gitlabToken,
              `/projects/${project.id}/repository/commits`,
              { since, author }
            );
            for (const c of commits) {
              if (!seenCommitIds.has(c.id)) {
                seenCommitIds.add(c.id);
                projectCommits.push({ ...c, project_name: project.name });
              }
            }
          } catch {
            // skip inaccessible projects
          }
        }
        return projectCommits;
      })
    );
    results.forEach((r) => allCommits.push(...r));
  }

  // Separate merge commits
  const filteredCommits = allCommits.filter((c) => !isMergeCommit(c.title));
  const mergeCommitCount = allCommits.length - filteredCommits.length;
  onProgress?.(`Processing ${filteredCommits.length} commits + ${mergeCommitCount} merges...`);

  // Aggregate by date (KST)
  const dateMap = new Map<string, { count: number; commits: { title: string; project: string; time: string }[] }>();
  for (const commit of filteredCommits) {
    const date = toKSTDateString(commit.committed_date);
    if (!dateMap.has(date)) {
      dateMap.set(date, { count: 0, commits: [] });
    }
    const entry = dateMap.get(date)!;
    entry.count++;
    entry.commits.push({
      title: commit.title,
      project: commit.project_name,
      time: commit.committed_date,
    });
  }

  // Build heatmap
  const today = new Date();
  const yearStart = new Date(today);
  yearStart.setMonth(yearStart.getMonth() - (settings.monthsBack || 12));
  const allDays = eachDayOfInterval({ start: yearStart, end: today });
  const weekStart = startOfWeek(yearStart, { weekStartsOn: 0 });

  const heatmap: HeatmapDay[] = allDays.map((day) => {
    const dateStr = format(day, "yyyy-MM-dd");
    const data = dateMap.get(dateStr);
    return {
      date: dateStr,
      count: data?.count || 0,
      commits: data?.commits || [],
      week: differenceInWeeks(day, weekStart),
      dayOfWeek: day.getDay(),
    };
  });

  // Project stats
  const projectMap = new Map<string, number>();
  for (const commit of filteredCommits) {
    projectMap.set(commit.project_name, (projectMap.get(commit.project_name) || 0) + 1);
  }
  const projectStats = Array.from(projectMap.entries())
    .map(([name, commits]) => ({ name, commits }))
    .sort((a, b) => b.commits - a.commits);

  // Hour stats (KST)
  const hours = new Array(24).fill(0);
  for (const commit of filteredCommits) {
    const hour = toKST(commit.committed_date).getUTCHours();
    hours[hour]++;
  }
  const hourStats = hours.map((count: number, hour: number) => ({ hour, count }));

  // Streak calculation (KST-based)
  const nowKST = new Date(Date.now() + KST_OFFSET);
  const todayKST = format(nowKST, "yyyy-MM-dd");
  const yesterdayKST = format(new Date(nowKST.getTime() - 86400000), "yyyy-MM-dd");

  const sortedDates = Array.from(dateMap.keys()).sort().reverse();

  // Current streak: consecutive days ending at today or yesterday
  let currentStreak = 0;
  if (sortedDates.length > 0 && (sortedDates[0] === todayKST || sortedDates[0] === yesterdayKST)) {
    currentStreak = 1;
    for (let i = 0; i < sortedDates.length - 1; i++) {
      const curr = parseISO(sortedDates[i]);
      const next = parseISO(sortedDates[i + 1]);
      const diff = Math.round((curr.getTime() - next.getTime()) / 86400000);
      if (diff === 1) {
        currentStreak++;
      } else {
        break;
      }
    }
  }

  // Longest streak ever in the period
  let longestStreak = 0;
  if (sortedDates.length > 0) {
    const asc = Array.from(dateMap.keys()).sort();
    let run = 1;
    for (let i = 1; i < asc.length; i++) {
      const prev = parseISO(asc[i - 1]);
      const curr = parseISO(asc[i]);
      const diff = Math.round((curr.getTime() - prev.getTime()) / 86400000);
      if (diff === 1) {
        run++;
      } else {
        if (run > longestStreak) longestStreak = run;
        run = 1;
      }
    }
    if (run > longestStreak) longestStreak = run;
  }

  // Busiest day
  let busiestDay = { date: "", count: 0 };
  dateMap.forEach((val, key) => {
    if (val.count > busiestDay.count) {
      busiestDay = { date: key, count: val.count };
    }
  });

  // Compress commits for AI: group by project x month, extract key messages
  const groupMap = new Map<string, { titles: string[]; count: number }>();
  for (const c of filteredCommits) {
    const month = toKSTDateString(c.committed_date).substring(0, 7); // yyyy-MM
    const key = `${c.project_name}|||${month}`;
    const entry = groupMap.get(key);
    if (entry) {
      entry.count++;
      if (entry.titles.length < 5) entry.titles.push(c.title);
    } else {
      groupMap.set(key, { titles: [c.title], count: 1 });
    }
  }

  const commitMessages: string[] = [];
  groupMap.forEach((val, key) => {
    const [project, month] = key.split("|||");
    const samples = val.titles.join("; ");
    commitMessages.push(`[${project}] ${month} (${val.count} commits): ${samples}`);
  });
  // Sort by month desc
  commitMessages.sort((a, b) => {
    const ma = a.match(/\d{4}-\d{2}/);
    const mb = b.match(/\d{4}-\d{2}/);
    return (mb?.[0] || "").localeCompare(ma?.[0] || "");
  });

  return {
    heatmap,
    projectStats,
    hourStats,
    totalCommits: filteredCommits.length,
    mergeCommits: mergeCommitCount,
    totalProjects: projectStats.length,
    currentStreak,
    longestStreak,
    busiestDay,
    commitMessages,
  };
}
