import path from 'path';

export const CONFIG = {
  UPLOAD_DIR: path.join(__dirname, '../uploads'),
  MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB
  MAX_SUMMARY_LENGTH: 2048,
  MIN_SUMMARY_LENGTH: 100,
  CHUNK_SIZE: 10000,  // Size of text chunks for processing
  OVERLAP_SIZE: 1000, // Size of overlap between chunks
  ALLOWED_FILE_TYPES: [
    'application/pdf',
    'text/plain',
    'text/markdown',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ],
  PYTHON_ENV: process.env.PYTHON_ENV || 'python3',
  MODEL_CACHE_DIR: path.resolve(__dirname, '../model_cache'),
  DEBUG: process.env.DEBUG === 'true'
}; 