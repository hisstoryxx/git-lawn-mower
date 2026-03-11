"use client";

import { useState, useEffect, useCallback, Suspense, lazy } from "react";
import { DashboardData } from "@/lib/types";
import { Settings, loadSettings, clearSettings, fetchDashboardData } from "@/lib/gitlab-client";
import SetupForm from "@/components/SetupForm";
import StatsCards from "@/components/StatsCards";
import ProjectChart from "@/components/ProjectChart";
import HourChart from "@/components/HourChart";
import AISummary from "@/components/AISummary";

const CommitCity = lazy(() => import("@/components/CommitCity"));

export default function Home() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const saved = loadSettings();
    if (saved) {
      setSettings(saved);
    }
    setReady(true);
  }, []);

  const fetchData = useCallback(async (s: Settings) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchDashboardData(s, setProgress);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch data");
    } finally {
      setLoading(false);
      setProgress("");
    }
  }, []);

  useEffect(() => {
    if (settings && !data && !loading) {
      fetchData(settings);
    }
  }, [settings, data, loading, fetchData]);

  const handleSetupComplete = (s: Settings) => {
    setSettings(s);
    setData(null);
  };

  const handleReset = () => {
    clearSettings();
    setSettings(null);
    setData(null);
  };

  if (!ready) return null;

  if (!settings) {
    return <SetupForm onComplete={handleSetupComplete} />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-10 w-10 border-[3px] border-green-400 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-400">{progress || "Loading commits from GitLab..."}</p>
          <p className="text-gray-600 text-sm mt-2">This may take a moment for the first load</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
        <div className="bg-red-900/20 border border-red-800 rounded-xl p-8 max-w-md text-center">
          <h2 className="text-red-400 text-xl font-bold mb-2">Error</h2>
          <p className="text-gray-400 mb-4">{error}</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => fetchData(settings)}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg transition-colors"
            >
              Retry
            </button>
            <button
              onClick={handleReset}
              className="px-4 py-2 bg-red-800 hover:bg-red-700 text-white text-sm rounded-lg transition-colors"
            >
              Reset Settings
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="min-h-screen bg-[#0d1117] text-white">
      <header className="border-b border-gray-800 px-6 py-5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">
              {settings.displayName && (
                <span className="text-white">{settings.displayName}&apos;s </span>
              )}
              <span className="text-green-400">Lawn</span>{" "}
              <span className="text-gray-300">Mower</span>
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              {settings.platform === "github" ? "GitHub" : "GitLab"} activity, beautifully visualized
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right text-sm text-gray-500">
              <div>{data.totalCommits} commits analyzed</div>
              <div>Past {settings.monthsBack} months</div>
            </div>
            <button
              onClick={handleReset}
              className="p-2 text-gray-500 hover:text-gray-300 transition-colors"
              title="Settings"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        <StatsCards
          totalCommits={data.totalCommits}
          mergeCommits={data.mergeCommits}
          totalProjects={data.totalProjects}
          currentStreak={data.currentStreak}
          longestStreak={data.longestStreak}
          busiestDay={data.busiestDay}
        />

        <section>
          <h2 className="text-xl font-semibold text-white mb-4">Commit City</h2>
          <p className="text-gray-500 text-sm mb-3">
            Each building represents a day. Height = number of commits.
          </p>
          <Suspense
            fallback={
              <div className="h-[500px] bg-gray-900/50 border border-gray-800 rounded-xl flex items-center justify-center">
                <div className="text-gray-500">Loading 3D scene...</div>
              </div>
            }
          >
            <CommitCity heatmap={data.heatmap} />
          </Suspense>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <ProjectChart data={data.projectStats} />
          <HourChart data={data.hourStats} />
        </div>

        <AISummary
          commitMessages={data.commitMessages}
          totalCommits={data.totalCommits}
          mergeCommits={data.mergeCommits}
          totalProjects={data.totalProjects}
          monthsBack={settings.monthsBack}
        />
      </main>

      <footer className="border-t border-gray-800 px-6 py-6 mt-12">
        <div className="max-w-7xl mx-auto text-center text-gray-600 text-sm">
          Lawn Mower - GitLab Activity Visualizer
        </div>
      </footer>
    </div>
  );
}
