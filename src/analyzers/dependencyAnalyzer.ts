import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { findFiles } from '../utils/astParser';

export interface DependencyFinding {
  package: string;
  reason: 'unused' | 'outdated' | 'vulnerable';
  currentVersion?: string;
  latestVersion?: string;
  lastUsed?: Date;
}

export class DependencyAnalyzer {
  private repoPath: string;

  constructor(repoPath: string) {
    this.repoPath = repoPath;
  }

  async analyzeNpm(): Promise<DependencyFinding[]> {
    const findings: DependencyFinding[] = [];
    const packageJsonPath = path.join(this.repoPath, 'package.json');

    if (!fs.existsSync(packageJsonPath)) {
      return findings;
    }

    const packageJson = JSON.parse(
      fs.readFileSync(packageJsonPath, 'utf-8')
    ) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    const dependencies = {
      ...(packageJson.dependencies ?? {}),
      ...(packageJson.devDependencies ?? {}),
    };

    // Check for unused dependencies
    const usedDeps = await this.findUsedDependencies();

    for (const [dep, version] of Object.entries(dependencies)) {
      if (!usedDeps.has(dep)) {
        findings.push({
          package: dep,
          reason: 'unused',
          currentVersion: version,
        });
      }
    }

    // Check for outdated dependencies
    try {
      const outdated = execSync('npm outdated --json 2>/dev/null || true', {
        cwd: this.repoPath,
        encoding: 'utf-8',
        maxBuffer: 1024 * 1024,
      });

      if (outdated.trim()) {
        const outdatedData = JSON.parse(outdated) as Record<
          string,
          { current: string; latest: string }
        >;
        for (const [pkg, info] of Object.entries(outdatedData)) {
          findings.push({
            package: pkg,
            reason: 'outdated',
            currentVersion: info.current,
            latestVersion: info.latest,
          });
        }
      }
    } catch {
      // npm outdated returns exit code 1 when packages are outdated
    }

    return findings;
  }

  private async findUsedDependencies(): Promise<Set<string>> {
    const used = new Set<string>();
    const files = await findFiles(this.repoPath, [
      '**/*.js',
      '**/*.ts',
      '**/*.jsx',
      '**/*.tsx',
    ]);

    for (const file of files) {
      try {
        const content = fs.readFileSync(file, 'utf-8');

        const importMatches = content.matchAll(
          /import\s+.*\s+from\s+['"]([^'"]+)['"]/g
        );
        for (const match of importMatches) {
          const importPath = match[1];
          const pkg = importPath.startsWith('@')
            ? importPath.split('/').slice(0, 2).join('/')
            : importPath.split('/')[0];
          used.add(pkg);
        }

        const requireMatches = content.matchAll(/require\(\s*['"]([^'"]+)['"]\s*\)/g);
        for (const match of requireMatches) {
          const requirePath = match[1];
          const pkg = requirePath.startsWith('@')
            ? requirePath.split('/').slice(0, 2).join('/')
            : requirePath.split('/')[0];
          used.add(pkg);
        }
      } catch {
        // Skip
      }
    }

    return used;
  }
}
