import Anthropic from '@anthropic-ai/sdk';
import * as fs from 'fs';
import * as path from 'path';
import { findFiles } from '../utils/astParser';

export interface CodeBlock {
  file: string;
  code: string;
  type: string;
  name?: string;
}

export interface DuplicateFinding {
  file1: string;
  file2: string;
  similarity: number;
  codeBlock1: string;
  codeBlock2: string;
  recommendation: string;
}

export class DuplicateAnalyzer {
  private anthropic: Anthropic;
  private repoPath: string;

  constructor(apiKey: string, repoPath: string) {
    this.anthropic = new Anthropic({ apiKey });
    this.repoPath = repoPath;
  }

  async analyze(files?: string[]): Promise<DuplicateFinding[]> {
    const findings: DuplicateFinding[] = [];
    const targetFiles =
      files ?? (await findFiles(this.repoPath, ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx']));

    const codeBlocks = await this.extractCodeBlocks(targetFiles);

    // Limit comparisons for performance (O(n^2) - cap at 50 blocks)
    const blocksToCompare = codeBlocks.slice(0, 50);

    for (let i = 0; i < blocksToCompare.length; i++) {
      for (let j = i + 1; j < blocksToCompare.length; j++) {
        const block1 = blocksToCompare[i];
        const block2 = blocksToCompare[j];

        if (block1.file === block2.file) continue;

        try {
          const { score, recommendation } = await this.checkSimilarity(
            block1,
            block2
          );

          if (score > 0.75) {
            findings.push({
              file1: block1.file,
              file2: block2.file,
              similarity: score,
              codeBlock1: block1.code,
              codeBlock2: block2.code,
              recommendation,
            });
          }
        } catch (err) {
          // Skip failed comparisons
          console.warn(`Skipped comparison ${block1.file} vs ${block2.file}:`, err);
        }
      }
    }

    return findings;
  }

  private async checkSimilarity(
    block1: CodeBlock,
    block2: CodeBlock
  ): Promise<{ score: number; recommendation: string }> {
    const truncated1 = block1.code.slice(0, 2000);
    const truncated2 = block2.code.slice(0, 2000);

    const message = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      messages: [
        {
          role: 'user',
          content: `Compare these two code blocks for semantic similarity.

Block 1 (${block1.file}):
\`\`\`
${truncated1}
\`\`\`

Block 2 (${block2.file}):
\`\`\`
${truncated2}
\`\`\`

Provide:
1. Similarity score (0-100)
2. Are they duplicates or just similar patterns?
3. Recommendation for refactoring if duplicates

Respond in valid JSON only:
{"similarity": <number>, "is_duplicate": <boolean>, "recommendation": "<string>"}`,
        },
      ],
    });

    const text =
      message.content[0].type === 'text'
        ? message.content[0].text
        : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch
      ? JSON.parse(jsonMatch[0])
      : { similarity: 0, recommendation: 'Unable to analyze' };

    return {
      score: (parsed.similarity ?? 0) / 100,
      recommendation: parsed.recommendation ?? 'Review manually',
    };
  }

  private async extractCodeBlocks(files: string[]): Promise<CodeBlock[]> {
    const blocks: CodeBlock[] = [];

    for (const file of files) {
      try {
        const content = fs.readFileSync(file, 'utf-8');
        const relPath = path.relative(this.repoPath, file);

        // Extract function declarations
        const functionRegex =
          /(?:function\s+(\w+)\s*\([^)]*\)\s*\{[\s\S]*?\}(?=\s*(?:function|const|let|var|$))|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?(?:function|\([^)]*\)\s*=>)\s*\{[\s\S]*?\}(?=\s*(?:function|const|let|var|$)))/g;
        let match;
        while ((match = functionRegex.exec(content)) !== null) {
          blocks.push({
            file: relPath,
            code: match[0],
            type: 'function',
            name: match[1] || match[2],
          });
        }

        // Extract class methods (simplified - get class blocks)
        const classRegex = /class\s+\w+\s*\{[\s\S]*?\}(?=\s*(?:class|export|$))/g;
        while ((match = classRegex.exec(content)) !== null) {
          blocks.push({
            file: relPath,
            code: match[0],
            type: 'class',
          });
        }
      } catch {
        // Skip unreadable files
      }
    }

    return blocks;
  }
}
