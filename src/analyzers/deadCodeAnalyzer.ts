import * as ts from 'typescript';
import * as path from 'path';
import { findFiles } from '../utils/astParser';

export interface DeadCodeFinding {
  filePath: string;
  functionName: string;
  lineStart: number;
  lineEnd: number;
  confidence: number;
  reason: string;
}

export class DeadCodeAnalyzer {
  private program!: ts.Program;
  private checker!: ts.TypeChecker;
  private callGraph: Map<string, Set<string>> = new Map();
  private repoPath: string;

  constructor(repoPath: string) {
    this.repoPath = repoPath;
  }

  async analyze(): Promise<DeadCodeFinding[]> {
    const filePatterns = ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'];
    const files = await findFiles(this.repoPath, filePatterns);

    if (files.length === 0) {
      return [];
    }

    this.program = ts.createProgram(files, {
      target: ts.ScriptTarget.Latest,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      allowJs: true,
      noEmit: true,
      skipLibCheck: true,
    });
    this.checker = this.program.getTypeChecker();

    const findings: DeadCodeFinding[] = [];

    // Step 1: Build call graph
    this.buildCallGraph();

    // Step 2: Find unreferenced functions
    for (const sourceFile of this.program.getSourceFiles()) {
      if (sourceFile.isDeclarationFile) continue;

      const visit = (node: ts.Node) => {
        if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) {
          const symbol = node.name
            ? this.checker.getSymbolAtLocation(node.name)
            : undefined;
          if (!symbol) return;

          const fullName = this.getFullSymbolName(symbol);
          const references = this.callGraph.get(fullName);

          // Check if function is never called
          if (!references || references.size === 0) {
            const isExported = this.isExported(node);
            const isTestFile =
              sourceFile.fileName.includes('.test.') ||
              sourceFile.fileName.includes('.spec.');
            const hasDecorators =
              'decorators' in node &&
              Array.isArray((node as { decorators?: unknown[] }).decorators) &&
              (node as { decorators: unknown[] }).decorators.length > 0;

            if (!isExported && !isTestFile && !hasDecorators) {
              const relPath = path.relative(this.repoPath, sourceFile.fileName);
              findings.push({
                filePath: relPath,
                functionName: node.name?.getText() || 'anonymous',
                lineStart:
                  sourceFile.getLineAndCharacterOfPosition(node.getStart()).line +
                  1,
                lineEnd:
                  sourceFile.getLineAndCharacterOfPosition(node.getEnd()).line +
                  1,
                confidence: 0.9,
                reason:
                  'Function has no internal references and is not exported',
              });
            }
          }
        }
        ts.forEachChild(node, visit);
      };

      visit(sourceFile);
    }

    return findings;
  }

  private buildCallGraph(): void {
    for (const sourceFile of this.program.getSourceFiles()) {
      if (sourceFile.isDeclarationFile) continue;

      const visit = (node: ts.Node) => {
        if (ts.isCallExpression(node)) {
          const callee = node.expression;
          const calleeSymbol = this.checker.getSymbolAtLocation(callee);
          const callerSymbol = this.getContainingFunction(node);

          if (callerSymbol && calleeSymbol) {
            const callerName = this.getFullSymbolName(callerSymbol);
            const calleeName = this.getFullSymbolName(calleeSymbol);

            if (!this.callGraph.has(calleeName)) {
              this.callGraph.set(calleeName, new Set());
            }
            this.callGraph.get(calleeName)!.add(callerName);
          }
        }
        ts.forEachChild(node, visit);
      };

      visit(sourceFile);
    }
  }

  private isExported(node: ts.Node): boolean {
    const modifiers = (node as ts.HasModifiers).modifiers;
    return !!modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
  }

  private getFullSymbolName(symbol: ts.Symbol): string {
    return this.checker.getFullyQualifiedName(symbol);
  }

  private getContainingFunction(node: ts.Node): ts.Symbol | undefined {
    let current: ts.Node | undefined = node;
    while (current) {
      if (ts.isFunctionDeclaration(current) || ts.isMethodDeclaration(current)) {
        if (current.name) {
          return this.checker.getSymbolAtLocation(current.name);
        }
      }
      current = current.parent;
    }
    return undefined;
  }
}
