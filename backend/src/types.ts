export interface ModelConfig {
  url: string;
  maxLength: number;
  minLength: number;
  temperature: number;
  numBeams: number;
  isLongFormCapable: boolean;
  preferredTextTypes: string[];
}

export interface SummaryResult {
  summary: string;
  model: string;
  processingTime: number;
  contentTypes: string[];
}

export interface CacheEntry {
  result: SummaryResult;
  timestamp: number;
} 