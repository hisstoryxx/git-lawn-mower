"use client";

import { useState } from "react";
import { Settings, loadSettings, saveSettings } from "@/lib/gitlab-client";

interface SetupFormProps {
  onComplete: (settings: Settings) => void;
}

const PERIOD_OPTIONS = [
  { label: "6 months", value: 6 },
  { label: "1 year", value: 12 },
  { label: "1.5 years", value: 18 },
  { label: "2 years", value: 24 },
];

export default function SetupForm({ onComplete }: SetupFormProps) {
  const existing = loadSettings();
  const [gitlabUrl, setGitlabUrl] = useState(existing?.gitlabUrl || "https://gitlab.com");
  const [gitlabToken, setGitlabToken] = useState(existing?.gitlabToken || "");
  const [gitlabUsername, setGitlabUsername] = useState(existing?.gitlabUsername || "");
  const [monthsBack, setMonthsBack] = useState(existing?.monthsBack || 12);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTesting(true);
    setError(null);

    try {
      const res = await fetch(`${gitlabUrl}/api/v4/user`, {
        headers: { "PRIVATE-TOKEN": gitlabToken },
      });
      if (!res.ok) {
        throw new Error(`GitLab connection failed (${res.status}). Check your token and URL.`);
      }

      const user = await res.json();
      const settings: Settings = {
        gitlabUrl: gitlabUrl.replace(/\/+$/, ""),
        gitlabToken,
        gitlabUsername: gitlabUsername || user.username,
        gitlabName: user.name || "",
        gitlabEmail: user.email || user.public_email || "",
        monthsBack,
      };

      saveSettings(settings);
      onComplete(settings);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0d1117] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold">
            <span className="text-green-400">Lawn</span>{" "}
            <span className="text-gray-300">Mower</span>
          </h1>
          <p className="text-gray-500 mt-2">GitLab Activity Visualizer</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 space-y-5">
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">GitLab URL</label>
            <input
              type="url"
              value={gitlabUrl}
              onChange={(e) => setGitlabUrl(e.target.value)}
              placeholder="https://gitlab.com"
              required
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-green-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1.5">
              Personal Access Token
              <span className="text-gray-600 ml-1">(read_api scope)</span>
            </label>
            <input
              type="password"
              value={gitlabToken}
              onChange={(e) => setGitlabToken(e.target.value)}
              placeholder="glpat-xxxxxxxxxxxxxxxxxxxx"
              required
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-green-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1.5">
              GitLab Username
              <span className="text-gray-600 ml-1">(auto-detected if empty)</span>
            </label>
            <input
              type="text"
              value={gitlabUsername}
              onChange={(e) => setGitlabUsername(e.target.value)}
              placeholder="your_username"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-green-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Period</label>
            <div className="grid grid-cols-4 gap-2">
              {PERIOD_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setMonthsBack(opt.value)}
                  className={`py-2 rounded-lg text-sm font-medium transition-colors ${
                    monthsBack === opt.value
                      ? "bg-green-600 text-white"
                      : "bg-gray-800 text-gray-400 border border-gray-700 hover:border-gray-600"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="bg-red-900/30 border border-red-800 rounded-lg p-3 text-red-400 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={testing || !gitlabToken}
            className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:text-gray-500 text-white font-medium py-2.5 rounded-lg transition-colors"
          >
            {testing ? "Connecting..." : "Start"}
          </button>

          <p className="text-gray-600 text-xs text-center">
            Your GitLab token is stored only in your browser&apos;s localStorage.
            <br />Nothing is sent to our server.
          </p>
        </form>
      </div>
    </div>
  );
}
