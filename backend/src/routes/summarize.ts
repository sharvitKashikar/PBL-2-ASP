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
import { Response } from 'express';

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
    url: 'google/flan-t5-xl',
    maxLength: 100,
    minLength: 30,
    temperature: 0.8,
    numBeams: 6,
    isLongFormCapable: false,
    preferredTextTypes: ['article', 'blog', 'general']
  },
  'PEGASUS': {
    url: 'google/pegasus-large',
    maxLength: 120,
    minLength: 40,
    temperature: 0.8,
    numBeams: 6,
    isLongFormCapable: true,
    preferredTextTypes: ['research', 'technical', 'long-form', 'pdf']
  },
  'BART-CNN': {
    url: 'facebook/bart-large-cnn',
    maxLength: 75,
    minLength: 25,
    temperature: 0.8,
    numBeams: 6,
    isLongFormCapable: true,
    preferredTextTypes: ['all']
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
// const detectTextType = (text: string): string => {
//   const wordCount = text.split(/\s+/).length;
//   const hasAcademicKeywords = /(?:research|study|methodology|findings|conclusion|abstract)/i.test(text);
//   const hasNewsKeywords = /(?:reported|announced|according to|news|today)/i.test(text);
  
//   if (hasAcademicKeywords && wordCount > 1000) return 'research';
//   if (hasNewsKeywords) return 'news';
//   if (wordCount > 2000) return 'long-form';
//   return 'article';
// };

// Select best model based on text characteristics
const selectBestModel = (_text: string, _fileType?: string): string => {
  return 'BART-CNN';
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

    const summary = await runLocalModel(cleanText, config.url, {
      max_length: 150,
      min_length: 75,
      temperature: 0.7,
      num_beams: 8,
      no_repeat_ngram_size: 3,
      length_penalty: 2.0,
      early_stopping: true,
      top_p: 0.92,
      top_k: 50,
      repetition_penalty: 1.5
    });

    const result = {
      summary: summary,
      modelUsed: modelName
    };

    // Cache the result
    summaryCache.set(cacheKey, result);
    return result;
  } catch (error: any) {
    throw new Error(`Failed to generate summary: ${error.message}`);
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

router.post('/text', auth, async (req: any, res: Response) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'No text provided' });
    }

    console.log('[%s] Received text summarization request', new Date().toISOString());
    console.log('Data:', {
      textLength: text.length,
      textPreview: text.substring(0, 100)
    });

    const result = await generateSummary(text);
    return res.json(result);
  } catch (error: any) {
    console.error('Text summarization error:', error);
    return res.status(500).json({ error: 'Failed to generate summary' });
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