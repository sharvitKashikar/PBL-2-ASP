export function generateReport(scores: { rouge1: number[] }): string {
  let report = 'Summary Evaluation Report\n';
  report += '========================\n\n';
  
  if (scores.rouge1 && scores.rouge1.length > 0) {
    report += 'ROUGE-1 Scores:\n';
    report += '--------------\n';
    for (let i = 0; i < scores.rouge1.length; i++) {
      report += `Model ${i + 1}: ${(scores.rouge1[i] * 100).toFixed(2)}%\n`;
    }
    report += '\n';
  }
  
  return report;
}

export async function showReport(): Promise<void> {
  // Implementation here
} 