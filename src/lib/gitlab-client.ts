import {
  eachDayOfInterval,
  format,
  startOfWeek,
  differenceInWeeks,
  parseISO,
} from "date-fns";
import { HeatmapDay, DashboardData } from "@/lib/types";

export interface Settings {
  platform: "gitlab" | "github";
  token: string;
  baseUrl: string;
  username: string;
  displayName: string;
  email: string;
  monthsBack: number;
}

interface GitLabProject {
  id: number;
  name: string;
  web_url: string;
  path_with_namespace: string;
  last_activity_at: string;
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

interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  fork: boolean;
  pushed_at: string;
}

interface GitHubCommit {
  sha: string;
  commit: {
    message: string;
    author: { name: string; email: string; date: string };
  };
  author: { login: string } | null;
}

const SETTINGS_KEY = "lawn-mower-settings";

function toLocal(dateStr: string): Date {
  return new Date(dateStr);
}

function toLocalDateString(dateStr: string): string {
  return format(toLocal(dateStr), "yyyy-MM-dd");
}

function isMergeCommit(title: string): boolean {
  return /^Merge (branch|pull request|remote-tracking branch)\s/.test(title);
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
  localStorage.removeItem(CACHE_KEY);
}

const CACHE_KEY = "lawn-mower-cache";
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

export function loadCachedData(): DashboardData | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(CACHE_KEY);
  if (!raw) return null;
  try {
    const { data, timestamp, settingsHash } = JSON.parse(raw);
    const settings = loadSettings();
    const currentHash = settings ? `${settings.platform}-${settings.username}-${settings.monthsBack}` : "";
    if (settingsHash !== currentHash) return null;
    if (Date.now() - timestamp > CACHE_TTL) return null;
    return data;
  } catch {
    return null;
  }
}

export function saveCachedData(data: DashboardData): void {
  const settings = loadSettings();
  const settingsHash = settings ? `${settings.platform}-${settings.username}-${settings.monthsBack}` : "";
  localStorage.setItem(CACHE_KEY, JSON.stringify({
    data,
    timestamp: Date.now(),
    settingsHash,
  }));
}

// --- GitLab API ---

async function fetchGitLabPages<T>(
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

    const nextPage = res.headers.get("x-next-page");
    if (nextPage && nextPage !== "") {
      page = parseInt(nextPage, 10);
    } else if (items.length === perPage) {
      page++;
    } else {
      break;
    }
  }

  return allItems;
}

async function fetchGitLabData(
  settings: Settings,
  onProgress?: (msg: string) => void
): Promise<{ commits: { id: string; title: string; date: string; project: string }[]; mergeCount: number }> {
  const { baseUrl, token, username } = settings;

  onProgress?.("Fetching projects...");
  const allProjects = await fetchGitLabPages<GitLabProject>(
    baseUrl, token, "/projects",
    { membership: "true", simple: "true", archived: "false", order_by: "last_activity_at" }
  );

  // Filter: only projects active within the time range
  const sinceDate = new Date();
  sinceDate.setMonth(sinceDate.getMonth() - (settings.monthsBack || 12));
  const since = sinceDate.toISOString();
  const projects = allProjects.filter((p) => new Date(p.last_activity_at) >= sinceDate);
  onProgress?.(`Found ${projects.length} active projects (of ${allProjects.length}). Fetching commits...`);

  const authorSet = new Map<string, boolean>();
  if (settings.email) authorSet.set(settings.email, true);
  if (settings.displayName) authorSet.set(settings.displayName, true);
  if (username) authorSet.set(username, true);
  const authorQueries = Array.from(authorSet.keys());

  const allCommits: { id: string; title: string; date: string; project: string }[] = [];
  const seenIds = new Set<string>();
  const batchSize = 20;

  for (let i = 0; i < projects.length; i += batchSize) {
    const batch = projects.slice(i, i + batchSize);
    onProgress?.(`Scanning projects ${i + 1}-${Math.min(i + batchSize, projects.length)} of ${projects.length}...`);

    const results = await Promise.all(
      batch.map(async (project) => {
        const projectCommits: typeof allCommits = [];
        // Parallel author queries
        const authorResults = await Promise.all(
          authorQueries.map(async (author) => {
            try {
              return await fetchGitLabPages<GitLabCommit>(
                baseUrl, token,
                `/projects/${project.id}/repository/commits`,
                { since, author }
              );
            } catch {
              return [];
            }
          })
        );
        for (const commits of authorResults) {
          for (const c of commits) {
            if (!seenIds.has(c.id)) {
              seenIds.add(c.id);
              projectCommits.push({
                id: c.id,
                title: c.title,
                date: c.committed_date,
                project: project.name,
              });
            }
          }
        }
        return projectCommits;
      })
    );
    results.forEach((r) => allCommits.push(...r));
  }

  const filtered = allCommits.filter((c) => !isMergeCommit(c.title));
  return { commits: filtered, mergeCount: allCommits.length - filtered.length };
}

// --- GitHub API ---

async function fetchGitHubPages<T>(
  token: string,
  url: string,
  params: Record<string, string> = {}
): Promise<T[]> {
  const allItems: T[] = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const u = new URL(url);
    Object.entries(params).forEach(([k, v]) => u.searchParams.set(k, v));
    u.searchParams.set("page", String(page));
    u.searchParams.set("per_page", String(perPage));

    const res = await fetch(u.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
      },
    });

    if (!res.ok) {
      throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
    }

    const items: T[] = await res.json();
    if (items.length === 0) break;
    allItems.push(...items);
    if (items.length < perPage) break;
    page++;
  }

  return allItems;
}

async function fetchGitHubData(
  settings: Settings,
  onProgress?: (msg: string) => void
): Promise<{ commits: { id: string; title: string; date: string; project: string }[]; mergeCount: number }> {
  const { token, username } = settings;
  const apiBase = "https://api.github.com";

  onProgress?.("Fetching repositories...");
  const repos = await fetchGitHubPages<GitHubRepo>(
    token,
    `${apiBase}/user/repos`,
    { type: "all", sort: "pushed", direction: "desc" }
  );

  // Filter repos pushed within the time range
  const sinceDate = new Date();
  sinceDate.setMonth(sinceDate.getMonth() - (settings.monthsBack || 12));
  const activeRepos = repos.filter((r) => new Date(r.pushed_at) >= sinceDate);
  onProgress?.(`Found ${activeRepos.length} active repositories. Fetching commits...`);

  const allCommits: { id: string; title: string; date: string; project: string }[] = [];
  const seenIds = new Set<string>();
  const batchSize = 20;

  for (let i = 0; i < activeRepos.length; i += batchSize) {
    const batch = activeRepos.slice(i, i + batchSize);
    onProgress?.(`Scanning repos ${i + 1}-${Math.min(i + batchSize, activeRepos.length)} of ${activeRepos.length}...`);

    const results = await Promise.all(
      batch.map(async (repo) => {
        const repoCommits: typeof allCommits = [];
        try {
          const commits = await fetchGitHubPages<GitHubCommit>(
            token,
            `${apiBase}/repos/${repo.full_name}/commits`,
            { author: username, since: sinceDate.toISOString() }
          );
          for (const c of commits) {
            if (!seenIds.has(c.sha)) {
              seenIds.add(c.sha);
              const title = c.commit.message.split("\n")[0];
              repoCommits.push({
                id: c.sha,
                title,
                date: c.commit.author.date,
                project: repo.name,
              });
            }
          }
        } catch {
          // skip inaccessible repos
        }
        return repoCommits;
      })
    );
    results.forEach((r) => allCommits.push(...r));
  }

  const filtered = allCommits.filter((c) => !isMergeCommit(c.title));
  return { commits: filtered, mergeCount: allCommits.length - filtered.length };
}

// --- Shared processing ---

export async function fetchDashboardData(
  settings: Settings,
  onProgress?: (msg: string) => void
): Promise<DashboardData> {
  const { commits: filteredCommits, mergeCount } =
    settings.platform === "github"
      ? await fetchGitHubData(settings, onProgress)
      : await fetchGitLabData(settings, onProgress);

  onProgress?.(`Processing ${filteredCommits.length} commits + ${mergeCount} merges...`);

  // Aggregate by date (local timezone)
  const dateMap = new Map<string, { count: number; commits: { title: string; project: string; time: string }[] }>();
  for (const commit of filteredCommits) {
    const date = toLocalDateString(commit.date);
    if (!dateMap.has(date)) {
      dateMap.set(date, { count: 0, commits: [] });
    }
    const entry = dateMap.get(date)!;
    entry.count++;
    entry.commits.push({
      title: commit.title,
      project: commit.project,
      time: commit.date,
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
    projectMap.set(commit.project, (projectMap.get(commit.project) || 0) + 1);
  }
  const projectStats = Array.from(projectMap.entries())
    .map(([name, commits]) => ({ name, commits }))
    .sort((a, b) => b.commits - a.commits);

  // Hour stats (local timezone)
  const hours = new Array(24).fill(0);
  for (const commit of filteredCommits) {
    const hour = toLocal(commit.date).getHours();
    hours[hour]++;
  }
  const hourStats = hours.map((count: number, hour: number) => ({ hour, count }));

  // Streak calculation (local timezone)
  const now = new Date();
  const todayStr = format(now, "yyyy-MM-dd");
  const yesterdayStr = format(new Date(now.getTime() - 86400000), "yyyy-MM-dd");

  const sortedDates = Array.from(dateMap.keys()).sort().reverse();

  let currentStreak = 0;
  if (sortedDates.length > 0 && (sortedDates[0] === todayStr || sortedDates[0] === yesterdayStr)) {
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

  // Compress commits for AI
  const groupMap = new Map<string, { titles: string[]; count: number }>();
  for (const c of filteredCommits) {
    const month = toLocalDateString(c.date).substring(0, 7);
    const key = `${c.project}|||${month}`;
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
    mergeCommits: mergeCount,
    totalProjects: projectStats.length,
    currentStreak,
    longestStreak,
    busiestDay,
    commitMessages,
  };
}
