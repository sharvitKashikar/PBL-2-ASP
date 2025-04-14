import { ModelConfig } from '../types';

export function preprocessText(text: string, modelConfig: ModelConfig): string {
  // Remove multiple newlines and spaces
  let processed = text.replace(/\n{2,}/g, '\n').replace(/\s+/g, ' ').trim();
  
  // Remove URLs if not needed for context
  processed = processed.replace(/https?:\/\/[^\s]+/g, '');
  
  // Remove common boilerplate text
  processed = processed.replace(/^(Introduction|Abstract|Conclusion):\s*/gi, '');
  
  // Handle bullet points and numbered lists
  processed = processed.replace(/^[•\-\d]+\s*/gm, '');
  
  // Remove references and citations
  processed = processed.replace(/\[\d+\]|\(\d{4}\)/g, '');
  
  // Special handling for long-form content
  if (modelConfig.isLongFormCapable) {
    // Keep section headers for structure
    processed = processed.replace(/^([A-Z][A-Za-z\s]{2,}):$/gm, '### $1 ###');
  }
  
  // Remove excessive punctuation
  processed = processed.replace(/([.!?])\1+/g, '$1');
  
  // Ensure proper spacing after punctuation
  processed = processed.replace(/([.!?])\s*/g, '$1 ');
  
  return processed.trim();
}

export function postprocessSummary(summary: string): string {
  // Ensure proper capitalization
  let processed = summary.charAt(0).toUpperCase() + summary.slice(1);
  
  // Remove any remaining special tokens
  processed = processed.replace(/###\s*|\s*###/g, '');
  
  // Ensure proper sentence endings
  processed = processed.replace(/([^.!?])$/, '$1.');
  
  // Fix common abbreviations spacing
  processed = processed.replace(/(\w)\.(\w)/g, '$1. $2');
  
  // Remove any double spaces
  processed = processed.replace(/\s+/g, ' ').trim();
  
  return processed;
}

export function detectContentType(text: string): string[] {
  const types: string[] = [];
  
  // Check for research paper indicators
  if (text.match(/(?:Abstract|Introduction|Methodology|References)/i)) {
    types.push('research');
  }
  
  // Check for news article indicators
  if (text.match(/(?:BREAKING|NEWS|Reuters|Associated Press)/i)) {
    types.push('news');
  }
  
  // Check for technical content
  if (text.match(/(?:code|algorithm|implementation|technical|specification)/i)) {
    types.push('technical');
  }
  
  // Check for blog post indicators
  if (text.match(/(?:blog|posted on|author:|comments)/i)) {
    types.push('blog');
  }
  
  // Default to general if no specific type detected
  if (types.length === 0) {
    types.push('general');
  }
  
  return types;
} 