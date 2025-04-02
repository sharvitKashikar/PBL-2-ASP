import express from 'express';
import multer from 'multer';
import { auth } from '../middleware/auth';
import { Summary } from '../models/Summary';
import axios from 'axios';
import fs from 'fs/promises';
import pdf from 'pdf-parse';
import dotenv from 'dotenv';


dotenv.config();

const router = express.Router();

// Ensure uploads directory exists
const UPLOAD_DIR = 'uploads';
const logDebug = (message: string, data?: any) => {
  console.log(`[${new Date().toISOString()}] ${message}`);
  if (data) {
    console.log('Data:', JSON.stringify(data, null, 2));
  }
};

const ensureUploadsDir = async () => {
  try {
    await fs.access(UPLOAD_DIR);
  } catch {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    logDebug('Created uploads directory');
  }
};

// Initialize upload directory
ensureUploadsDir().catch(console.error);

const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      await ensureUploadsDir();
      cb(null, UPLOAD_DIR);
    } catch (error) {
      cb(error as Error, UPLOAD_DIR);
    }
  },
  filename: (req, file, cb) => {
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const uniqueName = `${Date.now()}-${sanitizedName}`;
    cb(null, uniqueName);
  }
});

// Configure multer with larger size limits
const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
    files: 1
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'text/plain'];
    if (!allowedTypes.includes(file.mimetype)) {
      cb(new Error(`Invalid file type. Only PDF and text files are allowed. Received: ${file.mimetype}`));
      return;
    }
    cb(null, true);
  }
});

// Constants for model selection
const BART_MAX_LENGTH = 512;
const BART_CHUNK_SIZE = 450;
const CHUNK_OVERLAP = 50;
const MIN_COMPRESSION_RATIO = 0.4;  // Adjusted for better balance
const MAX_OUTPUT_LENGTH = 400;  // Increased for more complete summaries
const LONGT5_MAX_LENGTH = 16000;

// API URLs for different models
const BART_API_URL = "https://api-inference.huggingface.co/models/facebook/bart-large-cnn";
const LONGT5_API_URL = "https://api-inference.huggingface.co/models/pszemraj/long-t5-tglobal-base-16384-book-summary";
const T5_API_URL = "https://api-inference.huggingface.co/models/t5-base";
const PEGASUS_API_URL = "https://api-inference.huggingface.co/models/google/pegasus-xsum";
const BART_XSUM_API_URL = "https://api-inference.huggingface.co/models/facebook/bart-large-xsum";

// Enhanced text processing
const cleanText = (text: string): string => {
  return text
    .replace(/\s+/g, ' ')
    .replace(/[\n\r]+/g, ' ')
    .replace(/\t+/g, ' ')
    .replace(/([.!?])\s*(?=[A-Z])/g, '$1\n')  // Better sentence splitting
    .replace(/\s+/g, ' ')
    .trim();
};

// Improved prompt engineering for technical and environmental content
const createFocusedPrompt = (text: string): string => {
  const hasTechnicalTerms = /internet|technology|digital|cybersecurity|network|communication|social media|e-commerce/i.test(text);
  
  if (hasTechnicalTerms) {
    return `Create a comprehensive summary of this technology and communication text that must:
1. Cover the evolution and current state
2. Include key benefits and applications
3. Address challenges and concerns
4. Discuss future implications
5. Maintain technical accuracy
6. Preserve important terminology

Text to summarize: ${text}

Note: Ensure the summary captures both positive impacts and challenges while maintaining a balanced perspective.`;
  }
  
  const hasScientificTerms = /space|exploration|scientific|technology|research|mission|discovery|innovation/i.test(text);
  
  if (hasScientificTerms) {
    return `Create a comprehensive summary of this scientific/technical text that must:
1. Highlight key scientific discoveries and technological innovations
2. Include specific technical details and their significance
3. Cover both achievements AND challenges
4. Maintain logical flow: context → achievements → challenges → future implications
5. Preserve important terminology and numerical data
6. Balance historical context with future outlook

Text to summarize: ${text}

Note: Ensure the summary is analytical and covers both progress and obstacles while maintaining technical accuracy.`;
  }
  
  const hasTechnicalTermsOld = /electric|vehicles|battery|infrastructure|technology|emissions|renewable|sustainable/i.test(text);
  
  if (hasTechnicalTermsOld) {
    return `Create a comprehensive summary of this text about technology and sustainability. The summary must:
1. Cover ALL main points including benefits AND challenges
2. Include specific technical details and statistics
3. Maintain the logical structure: context → benefits → challenges → future outlook
4. Preserve important terminology and concepts
5. End with the current state or future implications

Text to summarize: ${text}

Note: Ensure the summary is complete and well-balanced, covering both advantages and limitations.`;
  }
  
  return `Provide a comprehensive summary of the following text that:
1. Captures ALL key points and main ideas
2. Preserves important technical details and solutions
3. Maintains the logical flow: problem → solution → challenges
4. Includes both benefits and limitations
5. Retains critical terminology and concepts

Text to summarize: ${text}`;
};

// Model configurations with optimized parameters
const MODEL_CONFIGS = {
  'BART-large-CNN': {
    url: BART_API_URL,
    maxLength: 512,
    minLength: 250,
    compressionFactor: 0.5,  // Adjusted for better coverage
    temperature: 0.4,        // Balanced for coherence
    numBeams: 8,
    lengthPenalty: 2.0,     // Balanced for completeness
    repetitionPenalty: 1.3,  // Balanced to avoid redundancy
    strengths: ['technical content', 'news articles', 'medium-length content']
  },
  'LONGT5': {
    url: LONGT5_API_URL,
    maxLength: 16000,
    minLength: 200,
    compressionFactor: 0.4,
    temperature: 0.5,
    numBeams: 5,
    lengthPenalty: 1.8,
    repetitionPenalty: 1.3,
    strengths: ['research papers', 'long documents', 'technical content']
  },
  'T5': {
    url: T5_API_URL,
    maxLength: 1024,
    minLength: 150,
    compressionFactor: 0.45,
    temperature: 0.6,
    numBeams: 5,
    lengthPenalty: 1.5,
    repetitionPenalty: 1.2,
    strengths: ['general text', 'medium-length content', 'multi-language']
  },
  'PEGASUS': {
    url: PEGASUS_API_URL,
    maxLength: 1024,
    minLength: 120,
    compressionFactor: 0.4,
    temperature: 0.5,
    numBeams: 6,
    lengthPenalty: 1.6,
    repetitionPenalty: 1.3,
    strengths: ['news articles', 'short documents', 'extractive summaries']
  },
  'BART-large-XSUM': {
    url: BART_XSUM_API_URL,
    maxLength: 512,
    minLength: 100,
    compressionFactor: 0.35,
    temperature: 0.6,
    numBeams: 6,
    lengthPenalty: 1.4,
    repetitionPenalty: 1.2,
    strengths: ['concise summaries', 'news articles', 'short documents']
  }
};

// Constants for text processing
const CHUNK_SIZE = 8000;  // Increased chunk size
const OVERLAP_SIZE = 500; // Increased overlap for better context

// Enhanced file validation
const isValidFileType = (filename: string): boolean => {
  const allowedExtensions = ['.txt', '.pdf', '.doc', '.docx'];
  const ext = filename.toLowerCase().split('.').pop();
  return allowedExtensions.includes(`.${ext}`);
};

// Enhanced document type detection
const detectDocumentType = (text: string): 'cover_letter' | 'research_paper' | 'general' => {
  const lowerText = text.toLowerCase();
  
  logDebug('Detecting document type', { textLength: text.length });
  
  // Check for cover letter patterns with more context
  if ((lowerText.includes('dear') || lowerText.includes('to whom it may concern')) &&
      (lowerText.includes('sincerely') || lowerText.includes('regards') || lowerText.includes('thank you')) &&
      (lowerText.includes('application') || lowerText.includes('position') || lowerText.includes('job'))) {
    logDebug('Detected document type: cover_letter');
    return 'cover_letter';
  }
  
  // Check for research paper patterns with more sections
  if (lowerText.includes('abstract') && 
      (lowerText.includes('introduction') || lowerText.includes('methodology') || 
       lowerText.includes('conclusion') || lowerText.includes('references') ||
       lowerText.includes('results') || lowerText.includes('discussion') ||
       lowerText.includes('method') || lowerText.includes('analysis'))) {
    logDebug('Detected document type: research_paper');
    return 'research_paper';
  }
  
  logDebug('Detected document type: general');
  return 'general';
};

// Add type definitions at the top of the file
interface ModelConfig {
  url: string;
  maxLength: number;
  minLength: number;
  compressionFactor: number;
  temperature: number;
  numBeams: number;
  lengthPenalty: number;
  repetitionPenalty: number;
  strengths: string[];
}

interface ModelConfigs {
  [key: string]: ModelConfig;
}

// Validate API key
const validateApiKey = () => {
  if (!process.env.HUGGING_FACE_API_KEY) {
    throw new Error('HUGGING_FACE_API_KEY is not set in environment variables');
  }
};

// Enhanced error handling
const handleApiError = (error: any): never => {
  if (error.response) {
    const status = error.response.status;
    const message = error.response.data?.error || error.message;
    
    switch (status) {
      case 401:
        throw new Error('Invalid API key. Please check your Hugging Face API key.');
      case 429:
        throw new Error('Rate limit exceeded. Please try again later.');
      case 503:
        throw new Error('Model is currently loading. Please try again in a few moments.');
      default:
        throw new Error(`API request failed: ${message}`);
    }
  }
  
  if (error.request) {
    throw new Error('No response received from API. Please check your internet connection.');
  }
  
  throw new Error(`Failed to make API request: ${error.message}`);
};

// Update model selection with error handling
const selectModel = (text: string, type: 'text' | 'url' | 'file'): { model: string, apiUrl: string } => {
  try {
    const textLength = text.length;
    const documentType = detectDocumentType(text);
    const hasTechnicalTerms = /internet|technology|digital|cybersecurity|network|communication|social media|e-commerce/i.test(text);
    
    logDebug('Analyzing text for model selection', { 
      textLength, 
      documentType,
      type,
      hasTechnicalTerms,
      previewText: text.substring(0, 100)
    });

    // Research papers always use LONGT5
    if (documentType === 'research_paper') {
      logDebug('Selected LONGT5 model for research paper');
      return {
        model: 'LONGT5',
        apiUrl: MODEL_CONFIGS['LONGT5'].url
      };
    }

    // Technical content between 500-1500 characters uses BART-large-CNN
    if (hasTechnicalTerms && textLength > 500 && textLength <= 1500) {
      logDebug('Selected BART-large-CNN for technical content');
      return {
        model: 'BART-large-CNN',
        apiUrl: MODEL_CONFIGS['BART-large-CNN'].url
      };
    }

    // Length-based selection with improved thresholds
    if (textLength <= 300) {
      logDebug('Selected BART-large-XSUM model for very short text');
      return {
        model: 'BART-large-XSUM',
        apiUrl: MODEL_CONFIGS['BART-large-XSUM'].url
      };
    }

    if (textLength <= 800) {
      logDebug('Selected PEGASUS model for short text');
      return {
        model: 'PEGASUS',
        apiUrl: MODEL_CONFIGS['PEGASUS'].url
      };
    }

    if (textLength <= 1500) {
      logDebug('Selected T5 model for medium text');
      return {
        model: 'T5',
        apiUrl: MODEL_CONFIGS['T5'].url
      };
    }

    if (textLength <= 4000) {
      logDebug('Selected BART-large-CNN for longer text');
      return {
        model: 'BART-large-CNN',
        apiUrl: MODEL_CONFIGS['BART-large-CNN'].url
      };
    }

    // For very long texts, use LONGT5
    logDebug('Selected LONGT5 model for very long text');
    return {
      model: 'LONGT5',
      apiUrl: MODEL_CONFIGS['LONGT5'].url
    };
  } catch (error) {
    logDebug('Error in model selection', { error });
    throw new Error('Failed to select appropriate model for summarization');
  }
};

// Helper function to calculate dynamic max length
const calculateMaxLength = (inputLength: number, model: string): number => {
  if (model === 'LONGT5') {
    return Math.min(Math.floor(inputLength * 0.3), 512); // Reduced from 0.4 to 0.3
  }
  return Math.min(Math.floor(inputLength * 0.25), 100); // More aggressive for BART
};

// Add new helper function for BART chunking
const chunkTextForBART = (text: string): string[] => {
  const chunks: string[] = [];
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  let currentChunk = '';

  for (const sentence of sentences) {
    if ((currentChunk + sentence).length <= BART_CHUNK_SIZE) {
      currentChunk += sentence;
    } else {
      if (currentChunk) chunks.push(currentChunk.trim());
      currentChunk = sentence;
    }
  }

  if (currentChunk) chunks.push(currentChunk.trim());
  return chunks;
};

// Function to split text into chunks for LONGT5
const chunkTextForLONGT5 = (text: string): string[] => {
  const chunks: string[] = [];
  let startIndex = 0;
  
  while (startIndex < text.length) {
    const endIndex = Math.min(startIndex + LONGT5_MAX_LENGTH, text.length);
    let chunk = text.slice(startIndex, endIndex);
    
    // If this isn't the last chunk, try to break at a sentence boundary
    if (endIndex < text.length) {
      const lastPeriod = chunk.lastIndexOf('.');
      if (lastPeriod !== -1 && lastPeriod > LONGT5_MAX_LENGTH * 0.75) {
        // Only break at sentence if we've processed at least 75% of max length
        chunk = chunk.slice(0, lastPeriod + 1);
        startIndex += lastPeriod + 1;
      } else {
        // Otherwise use the full chunk and add overlap
        startIndex += LONGT5_MAX_LENGTH - CHUNK_OVERLAP;
      }
    } else {
      startIndex = text.length;
    }
    
    chunks.push(chunk.trim());
  }
  
  console.log(`Split text into ${chunks.length} chunks for LONGT5`);
  return chunks;
};

// Helper function to check if summary is sufficiently compressed
const isCompressionSufficient = (originalText: string, summary: string): boolean => {
  const compressionRatio = summary.length / originalText.length;
  console.log(`Compression ratio: ${(compressionRatio * 100).toFixed(2)}%`);
  return compressionRatio <= MIN_COMPRESSION_RATIO;
};

// Improved recursive summarization that respects model selection
const recursiveSummarize = async (text: string, depth: number = 0): Promise<{ summary: string, modelUsed: string }> => {
  const maxDepth = 2; // Maximum levels of recursive summarization
  
  if (depth >= maxDepth) {
    console.log('Reached max recursion depth, using BART for final summary');
    const response = await axios.post(
      BART_API_URL,
      {
        inputs: text,
        parameters: {
          max_length: 150,
          min_length: 50,
          do_sample: false,
          num_beams: 4,
          length_penalty: 2.0,
          early_stopping: true
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.HUGGING_FACE_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    const summary = Array.isArray(response.data) ? response.data[0].summary_text : response.data.summary_text;
    return { summary, modelUsed: 'BART-large-CNN' };
  }

  // For recursive summarization, use LONGT5 if text is very long
  const { model, apiUrl } = selectModel(text, 'text');
  const chunks = model === 'LONGT5' ? chunkTextForLONGT5(text) : chunkTextForBART(text);
  
  if (chunks.length === 1) {
    const response = await axios.post(
      apiUrl,
      {
        inputs: text,
        parameters: {
          max_length: model === 'LONGT5' ? 512 : 150,
          min_length: model === 'LONGT5' ? 100 : 50,
          do_sample: false,
          num_beams: 4,
          length_penalty: 2.0,
          early_stopping: true
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.HUGGING_FACE_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    const summary = Array.isArray(response.data) ? response.data[0].summary_text : response.data.summary_text;
    return { summary, modelUsed: model };
  }

  // Process chunks recursively
  const chunkSummaries = await Promise.all(chunks.map((chunk: string) => recursiveSummarize(chunk, depth + 1)));
  const combinedText = chunkSummaries.map((s: { summary: string }) => s.summary).join(' ');
  
  // Final summarization of combined summaries
  return recursiveSummarize(combinedText, depth + 1);
};

// Update generateSummary with improved error handling
const generateSummary = async (text: string, type: 'text' | 'url' | 'file'): Promise<{ summary: string, modelUsed: string }> => {
  try {
    validateApiKey();
    
    if (!text || text.trim().length === 0) {
      throw new Error('No text provided for summarization');
    }

    logDebug(`Generating summary for ${type}`, { textLength: text.length });

    // Clean and prepare text
    text = cleanText(text);
    
    const { model, apiUrl } = selectModel(text, type);
    logDebug(`Selected model: ${model}`);
    
    const modelConfig = MODEL_CONFIGS[model as keyof typeof MODEL_CONFIGS];
    if (!modelConfig) {
      throw new Error(`Invalid model configuration for ${model}`);
    }

    let summary: string;
    let modelUsed = model;
    let attempts = 0;
    const maxAttempts = 2;

    do {
      const compressionFactor = attempts === 0 ? modelConfig.compressionFactor : modelConfig.compressionFactor * 0.9;
      const params = {
        max_length: Math.min(Math.floor(text.length * compressionFactor), modelConfig.maxLength),
        min_length: Math.min(Math.floor(text.length * 0.3), modelConfig.minLength),
        do_sample: true,
        num_beams: modelConfig.numBeams,
        length_penalty: modelConfig.lengthPenalty,
        early_stopping: true,
        temperature: modelConfig.temperature,
        no_repeat_ngram_size: 3,
        top_p: 0.95,
        repetition_penalty: modelConfig.repetitionPenalty,
        encoder_no_repeat_ngram_size: 3
      };

      logDebug('Sending request to model API', { model, params });

      const response = await axios.post(
        apiUrl,
        {
          inputs: createFocusedPrompt(text),
          parameters: params
        },
        {
          headers: {
            'Authorization': `Bearer ${process.env.HUGGING_FACE_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      summary = Array.isArray(response.data) ? response.data[0].summary_text : response.data.summary_text;
      
      // Additional cleaning to prevent truncation
      summary = cleanText(summary)
        .replace(/\s+\w+\.?$/, '.')
        .replace(/\s+obsta\.?$/, '')
        .trim();

      logDebug('Received summary', { 
        summaryLength: summary.length,
        originalLength: text.length,
        compressionRatio: summary.length / text.length
      });

      attempts++;
    } while (!isCompressionSufficient(text, summary) && attempts < maxAttempts);

    return { summary, modelUsed };
  } catch (error: any) {
    handleApiError(error);
    // This line is unreachable but satisfies the TypeScript compiler
    return { summary: '', modelUsed: '' };
  }
};

// Get user's summary history
router.get('/history', auth, async (req: any, res) => {
  try {
    const summaries = await Summary.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(10);
    res.status(200).json(summaries);
  } catch (error) {
    console.error('Error fetching history:', error);
    res.status(500).json({ error: 'Error fetching summary history' });
  }
});

// Summarize text
router.post('/text', auth, async (req: any, res) => {
  try {
    const { text } = req.body;
    console.log('Received text summarization request:', {
      textLength: text?.length,
      textPreview: text?.substring(0, 100)
    });

    if (!text) {
      console.log('No text provided in request');
      return res.status(400).json({ error: 'No text provided' });
    }

    console.log('Attempting to generate summary...');
    const { summary, modelUsed } = await generateSummary(text, 'text');
    console.log('Summary generated successfully:', {
      summaryLength: summary.length,
      summaryPreview: summary.substring(0, 100),
      modelUsed
    });

    // Save to MongoDB
    const newSummary = new Summary({
      userId: req.user._id,
      originalContent: text,
      summary,
      modelUsed,
      type: 'text'
    });
    
    console.log('Saving summary to database...');
    await newSummary.save();
    console.log('Summary saved successfully');

    res.status(200).json({ summary, model_used: modelUsed, id: newSummary._id });
  } catch (error: any) {
    console.error('Detailed text summarization error:', {
      error: error.message,
      stack: error.stack,
      response: error.response?.data,
      status: error.response?.status
    });
    res.status(500).json({ error: error.message || 'Error summarizing text' });
  }
});

// Helper function to extract text from HTML
const extractTextFromHTML = (html: string): string => {
  let text = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"');
  
  return cleanText(text);
};

// Validate URL
const isValidUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

// Summarize URL
router.post('/url', auth, async (req: any, res) => {
  try {
    const { url } = req.body;
    
    // Input validation
    if (!url) {
      return res.status(400).json({ error: 'No URL provided' });
    }

    if (!isValidUrl(url)) {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    console.log('Processing URL:', url);

    // Fetch content from URL with timeout and proper headers
    const response = await axios.get(url, {
      timeout: 10000, // 10 second timeout
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; NewsBot/1.0)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      },
      maxContentLength: 10 * 1024 * 1024 // 10MB limit
    });

    // Check content type
    const contentType = response.headers['content-type'] || '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xml')) {
      throw new Error('URL does not point to a readable web page');
    }

    // Extract text from HTML
    const htmlContent = response.data;
    const extractedText = extractTextFromHTML(htmlContent);

    if (!extractedText || extractedText.length < 50) {
      throw new Error('No meaningful content found on the webpage');
    }

    console.log('Successfully extracted text from URL:', {
      urlLength: url.length,
      extractedLength: extractedText.length,
      preview: extractedText.substring(0, 100)
    });

    // Generate summary
    const { summary, modelUsed } = await generateSummary(extractedText, 'url');

    // Save to MongoDB
    const newSummary = new Summary({
      userId: req.user._id,
      originalContent: extractedText,
      summary,
      modelUsed,
      type: 'url',
      sourceUrl: url
    });
    await newSummary.save();

    console.log('Summary generated and saved successfully:', {
      summaryLength: summary.length,
      modelUsed,
      summaryPreview: summary.substring(0, 100)
    });

    res.status(200).json({ 
      summary, 
      model_used: modelUsed, 
      id: newSummary._id,
      url: url
    });

  } catch (error: any) {
    console.error('URL summarization error:', {
      message: error.message,
      url: req.body.url,
      response: error.response?.data,
      status: error.response?.status
    });

    // Send appropriate error message based on the type of error
    let errorMessage = 'Error summarizing URL';
    let statusCode = 500;

    if (error.code === 'ECONNABORTED') {
      errorMessage = 'URL request timed out';
      statusCode = 408;
    } else if (error.response) {
      if (error.response.status === 404) {
        errorMessage = 'URL not found';
        statusCode = 404;
      } else if (error.response.status === 403) {
        errorMessage = 'Access to URL forbidden';
        statusCode = 403;
      }
    } else if (!isValidUrl(req.body.url)) {
      errorMessage = 'Invalid URL format';
      statusCode = 400;
    }

    res.status(statusCode).json({ 
      error: errorMessage,
      details: error.message
    });
  }
});

// Add debug logging function
const debugLog = (message: string, data?: any) => {
  console.log(`[DEBUG] ${message}`, data ? data : '');
};

// Wrapper for handling multer errors
const handleFileUpload = (req: express.Request, res: express.Response) => {
  return new Promise<void>((resolve, reject) => {
    upload.single('file')(req, res, (err: any) => {
      if (err instanceof multer.MulterError) {
        // Multer-specific errors
        if (err.code === 'LIMIT_FILE_SIZE') {
          reject(new Error('File is too large. Maximum size is 50MB'));
        } else {
          reject(new Error(`File upload error: ${err.message}`));
        }
      } else if (err) {
        // Other errors
        reject(err);
      } else {
        resolve();
      }
    });
  });
};

// Function to split text into overlapping chunks
const splitIntoChunks = (text: string): string[] => {
  const chunks: string[] = [];
  let startIndex = 0;
  
  while (startIndex < text.length) {
    const endIndex = Math.min(startIndex + CHUNK_SIZE, text.length);
    let chunk = text.slice(startIndex, endIndex);
    
    // If this isn't the last chunk, try to break at a sentence boundary
    if (endIndex < text.length) {
      const lastPeriod = chunk.lastIndexOf('.');
      if (lastPeriod !== -1) {
        chunk = chunk.slice(0, lastPeriod + 1);
        startIndex += lastPeriod + 1;
      } else {
        startIndex += CHUNK_SIZE - OVERLAP_SIZE;
      }
    } else {
      startIndex = text.length;
    }
    
    chunks.push(chunk.trim());
  }
  
  return chunks;
};

// Function to merge summaries
const mergeSummaries = (summaries: string[]): string => {
  if (summaries.length === 0) return '';
  if (summaries.length === 1) return summaries[0];
  
  // Join the summaries and generate a final summary
  const combinedText = summaries.join(' ');
  return combinedText;
};

// Function to process text in chunks with progress tracking
const processTextInChunks = async (
  text: string,
  onProgress?: (progress: number) => void
): Promise<string> => {
  const chunks = splitIntoChunks(text);
  const totalChunks = chunks.length;
  const summaries: string[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    try {
      const { summary } = await generateSummary(chunk, 'file');
      summaries.push(summary);

      // Report progress
      if (onProgress) {
        onProgress((i + 1) / totalChunks * 100);
      }
    } catch (error) {
      console.error(`Error processing chunk ${i + 1}/${totalChunks}:`, error);
      throw error;
    }
  }

  // If we have multiple summaries, combine them
  if (summaries.length > 1) {
    const combinedSummary = summaries.join(' ');
    const { summary } = await generateSummary(combinedSummary, 'text');
    return summary;
  }

  return summaries[0];
};

// File upload endpoint
router.post('/file', auth, async (req: any, res) => {
  let filePath = '';
  
  try {
    console.log('Starting file upload process...');
    
    // Handle file upload
    try {
      await new Promise((resolve, reject) => {
        upload.single('file')(req, res, (err) => {
          if (err) {
            console.error('File upload error:', err);
            reject(err);
          } else {
            resolve(undefined);
          }
        });
      });
    } catch (uploadError: any) {
      console.error('Upload error:', uploadError);
      throw new Error(`File upload failed: ${uploadError.message}`);
    }

    if (!req.file) {
      throw new Error('No file uploaded');
    }

    console.log('File received:', {
      filename: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size
    });

    filePath = req.file.path;
    let text = '';

    // Process PDF file
    if (req.file.mimetype === 'application/pdf') {
      console.log('Processing PDF file...');
      try {
        const dataBuffer = await fs.readFile(filePath);
        console.log('PDF file read, size:', dataBuffer.length);

        // Try pdf-parse
        try {
          console.log('Attempting to parse PDF...');
          const pdfData = await pdf(dataBuffer);
          text = pdfData.text;
          console.log('PDF parsed successfully, text length:', text.length);
          console.log('Text preview:', text.substring(0, 200));
        } catch (parseError: any) {
          console.error('PDF parsing error:', parseError);
          throw new Error(`Could not parse PDF: ${parseError.message}`);
        }

        if (!text || text.trim().length === 0) {
          console.error('No text extracted from PDF');
          throw new Error('No readable text content extracted from PDF');
        }

        // Clean the text
        console.log('Cleaning extracted text...');
        text = text
          .replace(/\s+/g, ' ')
          .replace(/[\r\n]+/g, ' ')
          .replace(/[^\x20-\x7E\n]/g, '')
          .replace(/\.([A-Z])/g, '. $1')
          .trim();

        console.log('Text cleaned, final length:', text.length);
        console.log('Cleaned text preview:', text.substring(0, 200));

      } catch (fileError: any) {
        console.error('File processing error:', fileError);
        throw new Error(`Failed to process PDF: ${fileError.message}`);
      }
    } else {
      // Process text file
      console.log('Processing text file...');
      try {
        text = await fs.readFile(filePath, 'utf8');
        console.log('Text file read, length:', text.length);
      } catch (readError: any) {
        console.error('Text file reading error:', readError);
        throw new Error(`Failed to read text file: ${readError.message}`);
      }
    }

    // Validate text content
    if (!text.trim()) {
      throw new Error('No readable text content found in file');
    }

    console.log('Generating summary...');
    try {
      const { summary, modelUsed } = await generateSummary(text, 'file');
      const documentType = detectDocumentType(text);
      console.log('Summary generated successfully:', {
        modelUsed,
        documentType,
        summaryLength: summary.length
      });

      // Save to database
      const newSummary = new Summary({
        userId: req.user._id,
        originalContent: text,
        summary,
        modelUsed,
        type: 'file',
        filename: req.file.originalname
      });

      await newSummary.save();
      console.log('Summary saved to database');

      // Clean up the uploaded file
      try {
        await fs.unlink(filePath);
        console.log('Temporary file cleaned up');
      } catch (unlinkError) {
        console.error('Error deleting temporary file:', unlinkError);
        // Continue despite cleanup error
      }

      return res.status(200).json({
        summary,
        model_used: modelUsed,
        id: newSummary._id,
        filename: req.file.originalname
      });

    } catch (summaryError: any) {
      console.error('Summary generation error:', {
        error: summaryError,
        response: summaryError.response?.data,
        status: summaryError.response?.status
      });
      throw new Error(`Failed to generate summary: ${summaryError.message}`);
    }

  } catch (error: any) {
    // Clean up file if it exists
    if (filePath) {
      try {
        await fs.unlink(filePath);
        console.log('Cleaned up temporary file after error');
      } catch (unlinkError) {
        console.error('Error deleting temporary file:', unlinkError);
      }
    }

    console.error('Complete error details:', {
      message: error.message,
      stack: error.stack,
      response: error.response?.data,
      status: error.response?.status
    });

    return res.status(500).json({
      error: 'Error processing file',
      details: error.message,
      filename: req.file?.originalname
    });
  }
});

export default router; 