"use client";

import { useState } from "react";

interface AISummaryProps {
  commitMessages: string[];
  totalCommits: number;
  mergeCommits: number;
  totalProjects: number;
  monthsBack: number;
}

export default function AISummary({
  commitMessages,
  totalCommits,
  mergeCommits,
  totalProjects,
  monthsBack,
}: AISummaryProps) {
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateSummary = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          commitMessages,
          totalCommits,
          mergeCommits,
          totalProjects,
          monthsBack,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to generate summary");
      }
      const data = await res.json();
      setSummary(data.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate summary.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">AI Work Summary</h3>
        {!summary && (
          <button
            onClick={generateSummary}
            disabled={loading || commitMessages.length === 0}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm rounded-lg transition-colors"
          >
            {loading ? "Analyzing..." : "Generate Summary"}
          </button>
        )}
      </div>

      {loading && (
        <div className="flex items-center gap-3 text-gray-400">
          <div className="animate-spin h-5 w-5 border-2 border-purple-400 border-t-transparent rounded-full" />
          <span>Analyzing {totalCommits} commits across {totalProjects} projects...</span>
        </div>
      )}

      {error && <div className="text-red-400 text-sm">{error}</div>}

      {summary && (
        <div
          className="prose prose-invert prose-sm max-w-none
            prose-headings:text-green-400 prose-headings:font-semibold
            prose-li:text-gray-300 prose-p:text-gray-300
            prose-strong:text-white prose-a:text-blue-400"
          dangerouslySetInnerHTML={{ __html: markdownToHtml(summary) }}
        />
      )}

      {!summary && !loading && !error && (
        <p className="text-gray-500 text-sm">
          Summarize all {totalCommits} commits across {totalProjects} projects with AI.
        </p>
      )}
    </div>
  );
}

function sanitize(html: string): string {
  return html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/on\w+="[^"]*"/gi, "");
}

function markdownToHtml(md: string): string {
  const html = md
    .replace(/^### (.*$)/gm, '<h3 class="text-base mt-4 mb-2">$1</h3>')
    .replace(/^## (.*$)/gm, '<h2 class="text-lg mt-5 mb-2">$1</h2>')
    .replace(/^# (.*$)/gm, '<h1 class="text-xl mt-6 mb-3">$1</h1>')
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/^\- (.*$)/gm, '<li class="ml-4">$1</li>')
    .replace(/(<li[\s\S]*<\/li>)/, '<ul class="list-disc">$1</ul>')
    .replace(/\n\n/g, "<br/>");
  return sanitize(html);
}
