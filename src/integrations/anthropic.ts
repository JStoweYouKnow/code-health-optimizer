import Anthropic from '@anthropic-ai/sdk';

export interface AnalysisInput {
  deadCode: unknown[];
  duplicates: unknown[];
  dependencies: unknown[];
}

export interface AnalyzedIssue {
  type: string;
  severity: 'low' | 'medium' | 'high';
  confidence: number;
  file_path?: string;
  line_start?: number;
  line_end?: number;
  description: string;
  recommendation: string;
  build_time_saved?: string;
  size_reduction?: string;
  language?: string;
  code_snippet?: string;
}

export async function analyzeWithClaude(
  apiKey: string,
  input: AnalysisInput
): Promise<AnalyzedIssue[]> {
  const anthropic = new Anthropic({ apiKey });

  const prompt = `Analyze this codebase for efficiency issues.

Dead code findings: ${JSON.stringify(input.deadCode, null, 2)}
Duplicate code findings: ${JSON.stringify(input.duplicates, null, 2)}
Dependency issues: ${JSON.stringify(input.dependencies, null, 2)}

For each issue:
1. Assess confidence (0-100%)
2. Estimate impact (low/medium/high)
3. Provide safe removal recommendation
4. Note any potential side effects

Output a valid JSON array of issues with this structure:
[{"type":"string","severity":"low|medium|high","confidence":0-100,"file_path":"","line_start":0,"line_end":0,"description":"","recommendation":"","build_time_saved":"","size_reduction":"","language":"","code_snippet":""}]
Respond with ONLY the JSON array, no other text.`;

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4000,
    system:
      'You are a senior code reviewer focused on code health and maintainability. Output only valid JSON.',
    messages: [{ role: 'user', content: prompt }],
  });

  const textBlock = message.content.find((c) => c.type === 'text');
  const text = textBlock && 'text' in textBlock ? textBlock.text : '';
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    return [];
  }
  return JSON.parse(jsonMatch[0]) as AnalyzedIssue[];
}
