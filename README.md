# Code Health Optimizer

An AI-powered code health analyzer that finds dead code, duplicate logic, and unused dependencies. Built for GitLab Duo Agent Platform with Claude (Anthropic) for semantic analysis.

> **Note:** The original GitLab Duo template (`gitlab-org/duo-workflow-examples/code-health-optimizer`) does not exist. This project implements the full blueprint from scratch.

## Features

- **Dead Code Detection** – AST-based analysis to find unreferenced functions
- **Duplicate Code Analysis** – Claude-powered semantic similarity for finding redundant logic
- **Dependency Analysis** – Unused and outdated npm dependencies
- **GitLab Integration** – Create issues and dry-run MRs
- **Health Metrics** – Score and estimated time savings

## Requirements

- Node.js 18+
- Optional: `ANTHROPIC_API_KEY` for duplicate analysis and semantic review
- Optional: `GITLAB_TOKEN` + `GITLAB_PROJECT_ID` for issue creation

## Setup

```bash
cd code-health-optimizer
npm install
```

## Usage

### Analyze current directory

```bash
npm run analyze
```

### Analyze a specific repo

```bash
REPO_PATH=/path/to/your/repo npm run analyze
```

### With API keys (full features)

```bash
ANTHROPIC_API_KEY=sk-ant-xxx \
GITLAB_TOKEN=glpat-xxx \
GITLAB_PROJECT_ID=12345 \
REPO_PATH=/path/to/repo \
npm run analyze
```

### Programmatic usage

```typescript
import { CodeHealthOptimizer } from './src';

const optimizer = new CodeHealthOptimizer({
  repoPath: './my-project',
  anthropicKey: process.env.ANTHROPIC_API_KEY,
  gitlabToken: process.env.GITLAB_TOKEN,
  gitlabProjectId: process.env.GITLAB_PROJECT_ID,
});

const results = await optimizer.analyze();
console.log(`Health Score: ${results.healthScore}/100`);
console.log(`Issues: ${results.totalIssues}`);
```

## Project Structure

```
code-health-optimizer/
├── .gitlab/agents/code-optimizer/
│   ├── config.yaml          # Agent configuration
│   └── workflows/
│       ├── analyze.yaml     # Main analysis workflow
│       └── report.yaml      # Issue creation workflow
├── src/
│   ├── analyzers/
│   │   ├── deadCodeAnalyzer.ts
│   │   ├── duplicateAnalyzer.ts
│   │   └── dependencyAnalyzer.ts
│   ├── integrations/
│   │   ├── anthropic.ts
│   │   └── gitlab.ts
│   ├── utils/
│   │   ├── astParser.ts
│   │   └── metrics.ts
│   └── index.ts
├── test/
│   ├── fixtures/sample-repo/
│   └── integration.test.ts
└── package.json
```

## GitLab Duo Agent Integration

The `.gitlab/agents/` directory contains configuration for GitLab Duo Agent Platform. When the platform is available:

- **Schedule trigger**: Weekly scan (Sundays 2 AM)
- **Label trigger**: Add `code-health-scan` to run analysis
- **Merge trigger**: Incremental analysis on merge to main

## Testing

```bash
npm test
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `REPO_PATH` | No | Path to analyze (default: current directory) |
| `ANTHROPIC_API_KEY` | For duplicates | Claude API key for semantic analysis |
| `GITLAB_TOKEN` | For GitLab | Personal or project access token |
| `GITLAB_PROJECT_ID` | For GitLab | GitLab project ID (numeric) |

## License

MIT
