import * as path from 'path';
import { DeadCodeAnalyzer } from './analyzers/deadCodeAnalyzer';
import { DuplicateAnalyzer } from './analyzers/duplicateAnalyzer';
import { DependencyAnalyzer } from './analyzers/dependencyAnalyzer';
import { analyzeWithClaude, type AnalyzedIssue } from './integrations/anthropic';
import { GitLabService } from './integrations/gitlab';
import { HealthMetrics } from './utils/metrics';

export interface CodeHealthOptimizerOptions {
  repoPath: string;
  gitlabToken?: string;
  anthropicKey?: string;
  gitlabProjectId?: string;
}

export interface AnalysisResult {
  findings: AnalyzedIssue[];
  deadCode: unknown[];
  duplicates: unknown[];
  dependencies: unknown[];
  healthScore: number;
  totalIssues: number;
  estimatedSavings: number;
}

export class CodeHealthOptimizer {
  private opts: CodeHealthOptimizerOptions;

  constructor(opts: CodeHealthOptimizerOptions) {
    this.opts = opts;
  }

  async analyze(): Promise<AnalysisResult> {
    const repoPath = path.resolve(this.opts.repoPath);

    // Run analyzers in parallel
    const [deadCode, duplicates, dependencies] = await Promise.all([
      new DeadCodeAnalyzer(repoPath).analyze(),
      this.opts.anthropicKey
        ? new DuplicateAnalyzer(this.opts.anthropicKey, repoPath).analyze()
        : Promise.resolve([]),
      new DependencyAnalyzer(repoPath).analyzeNpm(),
    ]);

    let findings: AnalyzedIssue[] = [];

    if (this.opts.anthropicKey) {
      findings = await analyzeWithClaude(this.opts.anthropicKey, {
        deadCode,
        duplicates,
        dependencies,
      });
    } else {
      // Without Claude, convert raw findings to a basic format
      findings = [
        ...deadCode.map((d) => ({
          type: 'dead_code',
          severity: 'medium' as const,
          confidence: d.confidence * 100,
          file_path: d.filePath,
          line_start: d.lineStart,
          line_end: d.lineEnd,
          description: `Unused function: ${d.functionName}`,
          recommendation: d.reason,
        })),
        ...duplicates.map((d) => ({
          type: 'duplicate',
          severity: 'high' as const,
          confidence: d.similarity * 100,
          file_path: d.file1,
          description: `Duplicate code between ${d.file1} and ${d.file2}`,
          recommendation: d.recommendation,
        })),
        ...dependencies.map((d) => ({
          type: 'dependency',
          severity: 'low' as const,
          confidence: d.reason === 'unused' ? 90 : 70,
          description: `${d.package}: ${d.reason}`,
          recommendation: d.reason === 'unused' ? 'Remove unused dependency' : 'Update dependency',
        })),
      ] as AnalyzedIssue[];
    }

    const metrics = new HealthMetrics();
    const healthScore = metrics.calculateHealthScore(findings);
    const estimatedSavings = metrics.estimateTimeSavings(findings);

    if (
      this.opts.gitlabToken &&
      this.opts.gitlabProjectId &&
      findings.length > 0
    ) {
      const gitlab = new GitLabService(
        this.opts.gitlabToken,
        this.opts.gitlabProjectId
      );
      const issuesForGitlab = findings.map((f) => ({
        filePath: f.file_path ?? '',
        lineStart: f.line_start ?? 0,
        lineEnd: f.line_end ?? 0,
        confidence: f.confidence ?? 0,
        description: f.description,
        recommendation: f.recommendation,
        language: f.language,
        codeSnippet: f.code_snippet,
        severity: f.severity,
        type: f.type,
      }));
      await gitlab.createHealthIssues(issuesForGitlab);
    }

    return {
      findings,
      deadCode,
      duplicates,
      dependencies,
      healthScore,
      totalIssues: findings.length,
      estimatedSavings,
    };
  }
}

// CLI entry point
async function main() {
  const repoPath = process.env.REPO_PATH || process.cwd();
  const gitlabToken = process.env.GITLAB_TOKEN;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const gitlabProjectId = process.env.GITLAB_PROJECT_ID;

  const optimizer = new CodeHealthOptimizer({
    repoPath,
    gitlabToken,
    anthropicKey,
    gitlabProjectId,
  });

  const results = await optimizer.analyze();

  console.log('\n--- Code Health Analysis Results ---');
  console.log(`Health Score: ${results.healthScore}/100`);
  console.log(`Total Issues: ${results.totalIssues}`);
  console.log(`Estimated Time Savings: ${results.estimatedSavings} hours`);
  console.log('\nFindings:');
  for (const f of results.findings.slice(0, 10)) {
    console.log(`  [${f.type}] ${f.file_path ?? 'N/A'}: ${f.description}`);
  }
  if (results.findings.length > 10) {
    console.log(`  ... and ${results.findings.length - 10} more`);
  }
}

if (require.main === module) {
  main().catch(console.error);
}
