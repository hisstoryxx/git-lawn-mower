# Lawn Mower

Your Git activity, beautifully visualized as a 3D city — with a lawn mower game.

## Features

- **3D Commit City** — Each building represents a day. Taller buildings = more commits. Click any building to see all commits for that day.
- **Lawn Mower Game** — Drive a mower through your commit city. Mow the grass with explosive firework effects. Mobile touch controls supported.
- **AI Work Summary** — Powered by Claude AI. Analyzes your entire commit history and generates a comprehensive work summary.
- **Stats Dashboard** — Total commits, active projects, current/longest streak, busiest day, coding hours chart, and project breakdown.
- **GitLab & GitHub** — Supports both platforms. Just enter your personal access token.
- **Privacy First** — Your token stays in your browser's localStorage. Nothing is stored on the server.

## Tech Stack

- **Next.js 14** (App Router, TypeScript)
- **Three.js** + react-three-fiber (3D rendering)
- **Tailwind CSS** (styling)
- **Anthropic Claude API** (AI summary, server-side only)
- **Recharts** (charts)
- **Vercel** (deployment)

## Getting Started

### Prerequisites

- Node.js 20+
- Anthropic API key (for AI summary feature)

### Setup

```bash
git clone https://github.com/hisstoryxx/git-lawn-mower.git
cd git-lawn-mower
npm install
```

Create `.env.local`:

```
ANTHROPIC_API_KEY=your_anthropic_api_key
```

Run the dev server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and enter your GitLab/GitHub token to get started.

### How to Get a Token

**GitLab:** Settings > Access Tokens > Add new token > Select `read_api` scope

**GitHub:** Settings > Developer settings > Personal access tokens > Tokens (classic) > Select `repo` scope

## Deploy

Deploy to Vercel with one click:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/hisstoryxx/git-lawn-mower&env=ANTHROPIC_API_KEY&envDescription=Anthropic%20API%20key%20for%20AI%20summary%20feature)

Or via CLI:

```bash
npm i -g vercel
vercel --prod
```

Set `ANTHROPIC_API_KEY` in Vercel project settings > Environment Variables.

## License

MIT

## Author

**hisstoryxx** — [GitHub](https://github.com/hisstoryxx) | [Email](mailto:hisstoryxx@gmail.com)
