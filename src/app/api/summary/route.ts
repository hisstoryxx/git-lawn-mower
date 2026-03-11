import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export async function POST(request: NextRequest) {
  try {
    const { commitMessages, totalCommits, mergeCommits, totalProjects, monthsBack } = await request.json();

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Anthropic API key is not configured on the server" },
        { status: 500 }
      );
    }

    if (!commitMessages || commitMessages.length === 0) {
      return NextResponse.json({ summary: "No commits to summarize." });
    }

    const client = new Anthropic({ apiKey });

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content: `You are analyzing a developer's GitLab commit history.

Stats: ${totalCommits} commits + ${mergeCommits} merges across ${totalProjects} projects over the past ${monthsBack} months.

The data below is grouped by [Project] Month (commit count): up to 5 sample commit titles per group.

Based on this, write a comprehensive work summary in English:

1. **Overall** - a brief paragraph about the developer's overall work and contribution level
2. **Project breakdown** - for each major project, what was done (features, fixes, refactoring)
3. **Timeline** - how work evolved over time, any notable busy periods
4. **Highlights** - standout achievements or interesting patterns

Be specific - reference actual project names and commit details. Keep it engaging and positive.
Format with markdown headings (##) and bullet points.

Data:

${commitMessages.join("\n")}`,
        },
      ],
    });

    const summary =
      message.content[0].type === "text"
        ? message.content[0].text
        : "Summary generation failed.";

    return NextResponse.json({ summary });
  } catch (error) {
    console.error("Failed to generate summary:", error);
    return NextResponse.json(
      { error: "Failed to generate summary" },
      { status: 500 }
    );
  }
}
