export interface Finding {
  type: string;
  severity?: string;
  confidence?: number;
  lineStart?: number;
  lineEnd?: number;
}

export class HealthMetrics {
  calculateHealthScore(findings: Finding[]): number {
    const weights: Record<string, number> = {
      dead_code: 0.3,
      duplicate: 0.4,
      duplicates: 0.4,
      dependency: 0.2,
      dependencies: 0.2,
      complexity: 0.1,
    };

    const byType = findings.reduce<Record<string, Finding[]>>((acc, f) => {
      const type = (f.type ?? 'unknown').toLowerCase().replace(/\s+/g, '_');
      if (!acc[type]) acc[type] = [];
      acc[type].push(f);
      return acc;
    }, {});

    let weightedScore = 0;
    let totalWeight = 0;

    for (const [key, weight] of Object.entries(weights)) {
      const items = byType[key] ?? [];
      const score = this.scoreByType(key, items);
      weightedScore += score * weight;
      totalWeight += weight;
    }

    return Math.round(Math.min(100, Math.max(0, weightedScore / Math.max(totalWeight, 0.1))));
  }

  estimateTimeSavings(findings: Finding[]): number {
    const savings: Record<string, number> = {
      dead_code: 0.5,
      duplicate: 2,
      duplicates: 2,
      dependency: 0.25,
      dependencies: 0.25,
    };

    return findings.reduce((total, finding) => {
      const type = (finding.type ?? '').toLowerCase().replace(/\s+/g, '_');
      return total + (savings[type] ?? 0);
    }, 0);
  }

  private scoreByType(type: string, findings: Finding[]): number {
    switch (type) {
      case 'dead_code':
        return this.scoreDeadCode(findings);
      case 'duplicate':
      case 'duplicates':
        return this.scoreDuplicates(findings);
      case 'dependency':
      case 'dependencies':
        return this.scoreDependencies(findings);
      case 'complexity':
        return 100;
      default:
        return 100;
    }
  }

  private scoreDeadCode(findings: Finding[]): number {
    const linesOfDeadCode = findings.reduce(
      (sum, f) => sum + (Math.max(0, (f.lineEnd ?? 0) - (f.lineStart ?? 0)) || 1),
      0
    );
    const penalty = Math.min(linesOfDeadCode / 100, 50);
    return Math.max(100 - penalty, 0);
  }

  private scoreDuplicates(findings: Finding[]): number {
    const penalty = Math.min(findings.length * 5, 60);
    return Math.max(100 - penalty, 0);
  }

  private scoreDependencies(findings: Finding[]): number {
    const penalty = Math.min(findings.length * 3, 40);
    return Math.max(100 - penalty, 0);
  }
}
