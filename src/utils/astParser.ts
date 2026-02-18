import * as ts from 'typescript';
import * as path from 'path';
import { glob } from 'glob';

/**
 * Find TypeScript/JavaScript files matching patterns in a directory.
 * Excludes node_modules, dist, build, and common build artifacts.
 */
export async function findFiles(
  repoPath: string,
  patterns: string[] = ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx']
): Promise<string[]> {
  const ignore = [
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
    '**/.next/**',
    '**/coverage/**',
    '**/*.d.ts',
  ];

  const allFiles: string[] = [];
  for (const pattern of patterns) {
    const files = await glob(pattern, {
      cwd: repoPath,
      absolute: true,
      ignore,
      nodir: true,
    });
    allFiles.push(...files);
  }

  return [...new Set(allFiles)];
}

export function getFilePath(absolutePath: string, repoPath: string): string {
  return path.relative(repoPath, absolutePath);
}
