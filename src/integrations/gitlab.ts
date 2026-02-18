import { Gitlab } from '@gitbeaker/node';

export interface FindingForIssue {
  title?: string;
  filePath: string;
  lineStart: number;
  lineEnd: number;
  confidence: number;
  description: string;
  recommendation: string;
  language?: string;
  codeSnippet?: string;
  severity?: string;
  type?: string;
}

export class GitLabService {
  private client: InstanceType<typeof Gitlab>;
  private projectId: string;

  constructor(token: string, projectId: string) {
    this.client = new Gitlab({ token });
    this.projectId = projectId;
  }

  async createHealthIssues(findings: FindingForIssue[]): Promise<void> {
    const grouped = this.groupBySeverity(findings);

    for (const [severity, issues] of Object.entries(grouped)) {
      await this.client.Issues.create(this.projectId, {
        title: `Code Health: ${severity} Priority Issues (${issues.length} found)`,
        description: this.formatIssueDescription(issues),
        labels: ['code-health', 'technical-debt', `severity::${severity}`],
      });
    }
  }

  async createDryRunMR(finding: {
    type: string;
    description: string;
    filePath: string;
    newContent: string;
    confidence: number;
    diff: string;
    impactAnalysis: string;
  }): Promise<void> {
    const branchName = `code-health/remove-${finding.type}-${Date.now()}`;

    await this.client.Branches.create(this.projectId, branchName, 'main');

    await this.client.Commits.create(this.projectId, branchName, `Remove ${finding.type}: ${finding.description}`, [
      {
        action: 'update',
        filePath: finding.filePath,
        content: finding.newContent,
      },
    ]);

    await this.client.MergeRequests.create(
      this.projectId,
      branchName,
      'main',
      `[DRY RUN] Remove ${finding.type}`,
      {
        description: `## Automated Code Health Fix

**Type:** ${finding.type}
**Confidence:** ${finding.confidence}%

### What This Removes
\`\`\`diff
${finding.diff}
\`\`\`

### Impact Analysis
${finding.impactAnalysis}

### Review Checklist
- [ ] Verify no runtime dependencies
- [ ] Check test coverage
- [ ] Confirm build passes

---
**This is a DRY RUN MR** - Review carefully before merging`,
        labels: ['code-health', 'automated', 'needs-review'],
        draft: true,
      }
    );
  }

  private formatIssueDescription(findings: FindingForIssue[]): string {
    return `
## Code Health Issues Found

This issue contains ${findings.length} code health findings that should be reviewed.

${findings
  .map(
    (f, i) => `
### ${i + 1}. ${f.title ?? 'Code Health Issue'}

**File:** \`${f.filePath}\`
**Lines:** ${f.lineStart}-${f.lineEnd}
**Confidence:** ${f.confidence}%

${f.description}

**Recommendation:**
${f.recommendation}

\`\`\`${f.language ?? 'text'}
${f.codeSnippet ?? ''}
\`\`\`

---
`
  )
  .join('\n')}

## Next Steps
1. Review each finding
2. Create MRs for confirmed issues
3. Close issue when all items are addressed
    `.trim();
  }

  private groupBySeverity(findings: FindingForIssue[]): Record<string, FindingForIssue[]> {
    return findings.reduce<Record<string, FindingForIssue[]>>((acc, finding) => {
      const severity = finding.severity ?? 'medium';
      if (!acc[severity]) acc[severity] = [];
      acc[severity].push(finding);
      return acc;
    }, {});
  }
}
