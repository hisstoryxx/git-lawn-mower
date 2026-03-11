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

function TokenGuide({ platform }: { platform: "gitlab" | "github" }) {
  const [open, setOpen] = useState(false);

  if (platform === "github") {
    return (
      <div className="mt-2">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="text-xs text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`transition-transform ${open ? "rotate-90" : ""}`}
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
          How to get a GitHub Personal Access Token
        </button>
        {open && (
          <div className="mt-2 bg-gray-800/50 border border-gray-700 rounded-lg p-3 text-xs text-gray-400 space-y-2">
            <ol className="list-decimal list-inside space-y-1.5">
              <li>
                Go to{" "}
                <span className="text-blue-400">
                  GitHub.com &rarr; Settings &rarr; Developer settings &rarr; Personal access tokens &rarr; Tokens (classic)
                </span>
              </li>
              <li>
                Click <span className="text-white font-medium">Generate new token (classic)</span>
              </li>
              <li>Give it a name (e.g. &quot;Lawn Mower&quot;)</li>
              <li>
                Select scopes: <span className="text-green-400 font-mono">repo</span> (for private repos) or just{" "}
                <span className="text-green-400 font-mono">public_repo</span> (for public only)
              </li>
              <li>
                Click <span className="text-white font-medium">Generate token</span> and copy it
              </li>
            </ol>
            <p className="text-gray-500 pt-1 border-t border-gray-700">
              Token format: <span className="font-mono text-gray-400">ghp_xxxxxxxxxxxxxxxxxxxx</span>
            </p>
            <p className="text-gray-500">
              Direct link:{" "}
              <span className="text-blue-400">github.com/settings/tokens/new</span>
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="text-xs text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`transition-transform ${open ? "rotate-90" : ""}`}
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
        How to get a GitLab Personal Access Token
      </button>
      {open && (
        <div className="mt-2 bg-gray-800/50 border border-gray-700 rounded-lg p-3 text-xs text-gray-400 space-y-2">
          <ol className="list-decimal list-inside space-y-1.5">
            <li>
              Go to{" "}
              <span className="text-blue-400">
                GitLab &rarr; User Settings &rarr; Access Tokens
              </span>
            </li>
            <li>
              Click <span className="text-white font-medium">Add new token</span>
            </li>
            <li>Give it a name (e.g. &quot;Lawn Mower&quot;) and set an expiry date</li>
            <li>
              Select scope: <span className="text-green-400 font-mono">read_api</span>
            </li>
            <li>
              Click <span className="text-white font-medium">Create personal access token</span> and copy it
            </li>
          </ol>
          <p className="text-gray-500 pt-1 border-t border-gray-700">
            Token format: <span className="font-mono text-gray-400">glpat-xxxxxxxxxxxxxxxxxxxx</span>
          </p>
          <p className="text-gray-500">
            Direct link:{" "}
            <span className="text-blue-400">gitlab.com/-/user_settings/personal_access_tokens</span>
          </p>
          <p className="text-gray-500">
            Self-hosted: <span className="text-gray-400">your-gitlab.com/-/user_settings/personal_access_tokens</span>
          </p>
        </div>
      )}
    </div>
  );
}

export default function SetupForm({ onComplete }: SetupFormProps) {
  const existing = loadSettings();
  const [platform, setPlatform] = useState<"gitlab" | "github">(existing?.platform || "gitlab");
  const [gitlabUrl, setGitlabUrl] = useState(existing?.baseUrl || "https://gitlab.com");
  const [token, setToken] = useState(existing?.token || "");
  const [username, setUsername] = useState(existing?.username || "");
  const [monthsBack, setMonthsBack] = useState(existing?.monthsBack || 12);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTesting(true);
    setError(null);

    try {
      let detectedUsername = username;
      let displayName = "";
      let email = "";

      if (platform === "gitlab") {
        const res = await fetch(`${gitlabUrl}/api/v4/user`, {
          headers: { "PRIVATE-TOKEN": token },
        });
        if (!res.ok) {
          throw new Error(`GitLab connection failed (${res.status}). Check your token and URL.`);
        }
        const user = await res.json();
        detectedUsername = username || user.username;
        displayName = user.name || "";
        email = user.email || user.public_email || "";
      } else {
        const res = await fetch("https://api.github.com/user", {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github+json",
          },
        });
        if (!res.ok) {
          throw new Error(`GitHub connection failed (${res.status}). Check your token.`);
        }
        const user = await res.json();
        detectedUsername = username || user.login;
        displayName = user.name || user.login || "";
        email = user.email || "";
      }

      const settings: Settings = {
        platform,
        baseUrl: platform === "gitlab" ? gitlabUrl.replace(/\/+$/, "") : "https://api.github.com",
        token,
        username: detectedUsername,
        displayName,
        email,
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
          <p className="text-gray-500 mt-2">Git Activity Visualizer</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 space-y-5">
          {/* Platform selector */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Platform</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => { setPlatform("gitlab"); setError(null); }}
                className={`py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                  platform === "gitlab"
                    ? "bg-orange-600 text-white"
                    : "bg-gray-800 text-gray-400 border border-gray-700 hover:border-gray-600"
                }`}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22.65 14.39L12 22.13 1.35 14.39a.84.84 0 0 1-.3-.94l1.22-3.78 2.44-7.51A.42.42 0 0 1 4.82 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.49h8.1l2.44-7.51A.42.42 0 0 1 18.6 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.51L23 13.45a.84.84 0 0 1-.35.94z"/>
                </svg>
                GitLab
              </button>
              <button
                type="button"
                onClick={() => { setPlatform("github"); setError(null); }}
                className={`py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                  platform === "github"
                    ? "bg-gray-600 text-white"
                    : "bg-gray-800 text-gray-400 border border-gray-700 hover:border-gray-600"
                }`}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
                </svg>
                GitHub
              </button>
            </div>
          </div>

          {/* GitLab URL - only for GitLab */}
          {platform === "gitlab" && (
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
              <p className="text-gray-600 text-xs mt-1">Self-hosted GitLab? Enter your server URL</p>
            </div>
          )}

          {/* Token */}
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">
              Personal Access Token
              <span className="text-gray-600 ml-1">
                ({platform === "gitlab" ? "read_api scope" : "repo scope"})
              </span>
            </label>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder={platform === "gitlab" ? "glpat-xxxxxxxxxxxxxxxxxxxx" : "ghp_xxxxxxxxxxxxxxxxxxxx"}
              required
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-green-500 transition-colors"
            />
            <TokenGuide platform={platform} />
          </div>

          {/* Username */}
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">
              {platform === "gitlab" ? "GitLab" : "GitHub"} Username
              <span className="text-gray-600 ml-1">(auto-detected if empty)</span>
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="your_username"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-green-500 transition-colors"
            />
          </div>

          {/* Period */}
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
            disabled={testing || !token}
            className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:text-gray-500 text-white font-medium py-2.5 rounded-lg transition-colors"
          >
            {testing ? "Connecting..." : "Start"}
          </button>

          <p className="text-gray-600 text-xs text-center">
            Your token is stored only in your browser&apos;s localStorage.
            <br />Nothing is sent to our server.
          </p>
        </form>

        <div className="mt-6 text-center text-gray-600 text-xs">
          Made by{" "}
          <a
            href="https://github.com/hisstoryxx"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-500 hover:text-gray-300 transition-colors"
          >
            hisstoryxx
          </a>
        </div>
      </div>
    </div>
  );
}
