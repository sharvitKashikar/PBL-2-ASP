import express from 'express';
import multer from 'multer';
import { auth } from '../middleware/auth';
import { Summary } from '../models/Summary';
import { promises as fs } from 'fs';
import fs_sync from 'fs';
import pdf from 'pdf-parse';
import dotenv from 'dotenv';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { CONFIG } from '../config';

dotenv.config();
const router = express.Router();
const execAsync = promisify(exec);

// Model configurations
interface ModelConfig {
  url: string;
  maxLength: number;
  minLength: number;
  temperature: number;
  numBeams: number;
  isLongFormCapable: boolean;
  preferredTextTypes: string[];
}

const MODEL_CONFIGS: Record<string, ModelConfig> = {
  'FLAN-T5-XL': {
    url: 'facebook/bart-large-cnn',
    maxLength: 200,  // Increased for better coverage
    minLength: 50,   // Adjusted for more detail
    temperature: 0.3, // Slightly increased for creativity
    numBeams: 4,     // Increased for better search
    isLongFormCapable: false,
    preferredTextTypes: ['article', 'blog', 'general']
  },
  'PEGASUS': {
    url: 'google/pegasus-xsum',
    maxLength: 800,  // Increased for research papers
    minLength: 150,  // Higher minimum for comprehensive summaries
    temperature: 0.2,
    numBeams: 6,     // More beams for complex content
    isLongFormCapable: true,
    preferredTextTypes: ['research', 'technical', 'long-form', 'pdf']
  },
  'BART-CNN': {
    url: 'facebook/bart-large-cnn',
    maxLength: 300,  // Adjusted for news articles
    minLength: 75,   // Increased for better context
    temperature: 0.25,
    numBeams: 5,     // Balanced for news content
    isLongFormCapable: false,
    preferredTextTypes: ['news', 'articles', 'web']
  }
};

// Add caching for summaries
const summaryCache = new Map<string, { summary: string, modelUsed: string }>();

// Helper function to create cache key
const createCacheKey = (text: string, fileType?: string): string => {
  return `${text.substring(0, 100)}_${fileType || 'text'}_${text.length}`;
};

// Python script execution function
const runLocalModel = async (text: string, modelName: string, params: any) => {
  let tmpInputPath = '';
  try {
    const scriptPath = path.resolve(__dirname, '../utils/local_inference.py');
    
    if (!fs_sync.existsSync(scriptPath)) {
      throw new Error(`Python script not found at path: ${scriptPath}`);
    }
    
    const tmpDir = path.resolve(CONFIG.UPLOAD_DIR);
    await fs.mkdir(tmpDir, { recursive: true });
    tmpInputPath = path.resolve(tmpDir, `${Date.now()}_input.txt`);
    await fs.writeFile(tmpInputPath, text);

    const pythonCmd = CONFIG.PYTHON_ENV;
    const cmd = `"${pythonCmd}" "${scriptPath}" "${tmpInputPath}" "${modelName}" '${JSON.stringify(params)}'`;
    console.log('Executing command:', cmd);
    
    const { stdout, stderr } = await execAsync(cmd);
    
    if (stderr) {
      console.error('Python script stderr:', stderr);
    }
    
    try {
      const result = JSON.parse(stdout);
      if (result.error) {
        throw new Error(result.error);
      }
      return result.summary;
    } catch (parseError) {
      console.error('Error parsing Python output:', parseError);
      console.error('Raw output:', stdout);
      throw new Error(`Failed to parse Python output. Raw output: ${stdout.substring(0, 200)}`);
    }
  } catch (error: any) {
    console.error('Local model inference error:', error);
    throw new Error(`Failed to run local model: ${error.message}`);
  } finally {
    if (tmpInputPath) {
      try {
        await fs.unlink(tmpInputPath).catch(() => {});
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  }
};

// Helper function to detect text type
const detectTextType = (text: string): string => {
  const wordCount = text.split(/\s+/).length;
  const hasAcademicKeywords = /(?:research|study|methodology|findings|conclusion|abstract)/i.test(text);
  const hasNewsKeywords = /(?:reported|announced|according to|news|today)/i.test(text);
  
  if (hasAcademicKeywords && wordCount > 1000) return 'research';
  if (hasNewsKeywords) return 'news';
  if (wordCount > 2000) return 'long-form';
  return 'article';
};

// Select best model based on text characteristics
const selectBestModel = (text: string, fileType?: string): string => {
  const wordCount = text.split(/\s+/).length;
  const textType = detectTextType(text);
  
  // For very long texts or PDFs, prefer PEGASUS
  if (wordCount > 2000 || fileType === 'application/pdf') {
    return 'PEGASUS';
  }
  
  // For news articles, prefer BART-CNN
  if (textType === 'news') {
    return 'BART-CNN';
  }
  
  // For general articles and shorter texts, use FLAN-T5-XL
  return 'FLAN-T5-XL';
};

// Main summarization function
const generateSummary = async (text: string, fileType?: string): Promise<{ summary: string, modelUsed: string }> => {
  // Check cache first
  const cacheKey = createCacheKey(text, fileType);
  const cachedResult = summaryCache.get(cacheKey);
  if (cachedResult) {
    return cachedResult;
  }

  const modelName = selectBestModel(text, fileType);
  const config = MODEL_CONFIGS[modelName];
  
  try {
    // Improved text preprocessing
    const cleanText = text
      .replace(/(?:Contact|Email|Phone|Copyright|All rights reserved|Follow us|Subscribe|Sign up|Read more|Read on|Click here|Terms of Service|Privacy Policy|©).*$/gim, '')
      .replace(/\s+/g, ' ')  // Normalize whitespace
      .trim();

    // Break text into smaller chunks if too long
    const maxChunkLength = 1000;
    let textToProcess = cleanText;
    if (cleanText.length > maxChunkLength) {
      const sentences = cleanText.match(/[^.!?]+[.!?]+/g) || [];
      const middleIndex = Math.floor(sentences.length / 2);
      textToProcess = sentences.slice(0, middleIndex + 1).join(' ');
    }

    // Focused prompt for better accuracy
    const prompt = `Provide a concise and accurate summary of the main points: ${textToProcess}`;

    const summary = await runLocalModel(textToProcess, config.url, {
      max_length: config.maxLength,
      min_length: config.minLength,
      temperature: config.temperature,
      num_beams: config.numBeams,
      no_repeat_ngram_size: 2,
      length_penalty: 0.8,        // Encourage conciseness
      early_stopping: true,
      top_p: 0.95,               // Slightly higher for better word choice
      repetition_penalty: 1.2
    });

    // Enhanced post-processing
    const cleanedSummary = summary
      .replace(/(?:read more|learn more|find out more|click here|discover|contact us|subscribe|sign up|in this article).*$/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    const result = {
      summary: cleanedSummary,
      modelUsed: modelName
    };

    // Cache the result
    summaryCache.set(cacheKey, result);
    
    // Clear old cache entries if cache gets too large
    if (summaryCache.size > 1000) {
      const oldestKey = summaryCache.keys().next().value;
      summaryCache.delete(oldestKey);
    }

    return result;
  } catch (error) {
    console.error('Summary generation error:', error);
    throw error;
  }
};

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (_req, _file, cb) => {
    try {
      await fs.access(CONFIG.UPLOAD_DIR);
    } catch {
      await fs.mkdir(CONFIG.UPLOAD_DIR, { recursive: true });
    }
    cb(null, CONFIG.UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: CONFIG.MAX_FILE_SIZE }
});

// Routes
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

router.post('/text', auth, async (req: any, res) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'No text provided' });
    }

    if (text.trim().length === 0) {
      return res.status(400).json({ error: 'Empty text provided' });
    }

    // Create temporary input file
    const tmpDir = path.resolve(CONFIG.UPLOAD_DIR);
    await fs.mkdir(tmpDir, { recursive: true });
    const tmpInputPath = path.resolve(tmpDir, `${Date.now()}_input.txt`);
    await fs.writeFile(tmpInputPath, text);

    try {
      const { summary, modelUsed } = await generateSummary(text);
      
      const newSummary = new Summary({
        userId: req.user._id,
        originalContent: text,
        summary,
        modelUsed,
        type: 'text'
      });
      
      await newSummary.save();
      
      res.status(200).json({ 
        summary, 
        model_used: modelUsed, 
        id: newSummary._id 
      });
    } catch (error: any) {
      console.error('Summary generation error:', error);
      
      // Check if error is from Python script
      if (typeof error.message === 'string' && error.message.includes('Failed to generate summary')) {
        return res.status(500).json({ 
          error: 'Failed to generate summary',
          details: error.message
        });
      }
      
      res.status(500).json({ 
        error: 'Error generating summary',
        details: error.message || 'Unknown error occurred'
      });
    } finally {
      // Clean up temporary file
      try {
        await fs.unlink(tmpInputPath);
      } catch (e) {
        console.error('Error deleting temporary file:', e);
      }
    }
  } catch (error: any) {
    console.error('Text summarization error:', error);
    res.status(500).json({ 
      error: 'Error processing request',
      details: error.message || 'Unknown error occurred'
    });
  }
});

router.post('/file', auth, upload.single('file'), async (req: any, res) => {
  let filePath = '';
  try {
    if (!req.file) {
      throw new Error('No file uploaded');
    }
    filePath = req.file.path;
    
    // Stricter file size limit for faster processing
    const maxFileSize = 2 * 1024 * 1024; // 2MB limit
    const stats = await fs.stat(filePath);
    if (stats.size > maxFileSize) {
      throw new Error('File too large for processing');
    }

    let text = '';
    if (req.file.mimetype === 'application/pdf') {
      const dataBuffer = await fs.readFile(filePath);
      const pdfData = await pdf(dataBuffer, { max: 20 }); // Reduced page limit
      text = pdfData.text;
    } else {
      text = await fs.readFile(filePath, 'utf8');
    }

    if (!text.trim()) {
      throw new Error('No readable text content found in file');
    }

    // Process only first portion for very long texts
    const maxChars = 2000;
    if (text.length > maxChars) {
      const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
      text = sentences.slice(0, 10).join(' '); // Take first 10 sentences
    }

    const { summary, modelUsed } = await generateSummary(text, req.file.mimetype);

    const newSummary = new Summary({
      userId: req.user._id,
      originalContent: text,
      summary,
      modelUsed,
      type: 'file',
      filename: req.file.originalname
    });

    await newSummary.save();
    await fs.unlink(filePath);

    res.status(200).json({
      summary,
      model_used: modelUsed,
      id: newSummary._id,
      filename: req.file.originalname
    });

  } catch (error: any) {
    if (filePath) {
      try {
        await fs.unlink(filePath);
      } catch (e) {
        console.error('Error deleting temporary file:', e);
      }
    }

    console.error('File processing error:', error);
    res.status(500).json({
      error: 'Error processing file',
      details: error.message,
      filename: req.file?.originalname
    });
  }
});

export default router; 