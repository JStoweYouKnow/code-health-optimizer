import { describe, it, expect } from 'vitest';
import path from 'path';
import { CodeHealthOptimizer } from '../src';
import { DeadCodeAnalyzer } from '../src/analyzers/deadCodeAnalyzer';
import { DependencyAnalyzer } from '../src/analyzers/dependencyAnalyzer';

const FIXTURE_PATH = path.join(__dirname, 'fixtures', 'sample-repo');

describe('Code Health Optimizer', () => {
  it('should detect dead code in sample repo', async () => {
    const analyzer = new DeadCodeAnalyzer(FIXTURE_PATH);
    const findings = await analyzer.analyze();

    expect(findings.length).toBeGreaterThan(0);
    const names = findings.map((f) => f.functionName);
    expect(names).toContain('deadHelper');
    expect(names).toContain('orphanUtil');
    expect(names).not.toContain('usedHelper');
    expect(names).not.toContain('main');
  });

  it('should run full analysis without API keys', async () => {
    const optimizer = new CodeHealthOptimizer({
      repoPath: FIXTURE_PATH,
    });

    const results = await optimizer.analyze();

    expect(results.findings.length).toBeGreaterThan(0);
    expect(results.healthScore).toBeLessThanOrEqual(100);
    expect(results.healthScore).toBeGreaterThanOrEqual(0);
    expect(results.deadCode.length).toBeGreaterThan(0);
  });

  it('should not flag exported functions as dead', async () => {
    const analyzer = new DeadCodeAnalyzer(FIXTURE_PATH);
    const findings = await analyzer.analyze();

    const exported = findings.filter(
      (f) => f.functionName === 'main' || f.functionName === 'usedHelper'
    );
    expect(exported.length).toBe(0);
  });

  it('should detect unused dependencies', async () => {
    const analyzer = new DependencyAnalyzer(FIXTURE_PATH);
    const findings = await analyzer.analyzeNpm();

    const unused = findings.filter((f) => f.reason === 'unused');
    expect(unused.length).toBeGreaterThan(0);
    expect(unused.some((f) => f.package === 'unused-package')).toBe(true);
  });
});
