import express from 'express';
import multer from 'multer';
import { auth } from '../middleware/auth';
import { Summary } from '../models/Summary';
import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import pdf from 'pdf-parse';
import dotenv from 'dotenv';
import { PDFDocument } from 'pdf-lib';

dotenv.config();

const router = express.Router();

// Ensure uploads directory exists
const UPLOAD_DIR = 'uploads';
const ensureUploadsDir = async () => {
  try {
    await fs.access(UPLOAD_DIR);
  } catch {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    console.log('Created uploads directory');
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
const BART_MAX_LENGTH = 1024;  // BART's maximum input length
const BART_CHUNK_SIZE = 900;   // Slightly smaller to account for overlap
const CHUNK_OVERLAP = 100;     // Overlap between chunks to maintain context
const LONGT5_MAX_LENGTH = 16000;
const BART_API_URL = "https://api-inference.huggingface.co/models/facebook/bart-large-cnn";
const LONGT5_API_URL = "https://api-inference.huggingface.co/models/pszemraj/long-t5-tglobal-base-16384-book-summary";

// Constants for text processing
const CHUNK_SIZE = 8000;  // Increased chunk size
const OVERLAP_SIZE = 500; // Increased overlap for better context

// Helper function to detect document type
const detectDocumentType = (text: string): 'cover_letter' | 'research_paper' | 'general' => {
  const lowerText = text.toLowerCase();
  
  // Check for cover letter patterns
  if ((lowerText.includes('dear') || lowerText.includes('to whom it may concern')) &&
      (lowerText.includes('sincerely') || lowerText.includes('regards') || lowerText.includes('thank you'))) {
    return 'cover_letter';
  }
  
  // Check for research paper patterns
  if (lowerText.includes('abstract') && 
      (lowerText.includes('introduction') || lowerText.includes('methodology') || 
       lowerText.includes('conclusion') || lowerText.includes('references'))) {
    return 'research_paper';
  }
  
  return 'general';
};

// Helper function to determine which model to use
const selectModel = (text: string, type: 'text' | 'url' | 'file'): { model: string, apiUrl: string } => {
  const textLength = text.length;
  const documentType = detectDocumentType(text);
  
  console.log(`Selecting model for document type: ${documentType}, length: ${textLength}`);
  
  // Always use BART for cover letters regardless of length
  if (documentType === 'cover_letter') {
    console.log('Selected BART model for cover letter');
    return {
      model: 'BART-large-CNN',
      apiUrl: BART_API_URL
    };
  }
  
  // Always use LONGT5 for research papers
  if (documentType === 'research_paper') {
    console.log('Selected LONGT5 model for research paper');
    return {
      model: 'LONGT5',
      apiUrl: LONGT5_API_URL
    };
  }
  
  // For general text, use length-based selection
  if (textLength <= BART_MAX_LENGTH) {
    console.log('Selected BART model for short document');
    return {
      model: 'BART-large-CNN',
      apiUrl: BART_API_URL
    };
  }
  
  console.log('Selected LONGT5 model for long document');
  return {
    model: 'LONGT5',
    apiUrl: LONGT5_API_URL
  };
};

// Helper function to calculate dynamic max length
const calculateMaxLength = (inputLength: number, model: string): number => {
  // For summarization, output should be shorter than input
  if (model === 'LONGT5') {
    return Math.min(Math.floor(inputLength * 0.4), 512); // 40% of input length, max 512
  }
  return Math.min(Math.floor(inputLength * 0.3), 150); // 30% of input length, max 150 for BART
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

// Add new helper function for recursive summarization
const recursiveSummarize = async (text: string, depth: number = 0): Promise<string> => {
  const maxDepth = 2; // Maximum levels of recursive summarization
  
  if (text.length <= BART_MAX_LENGTH || depth >= maxDepth) {
    // Base case: text is short enough or max depth reached
    const response = await axios.post(
      BART_API_URL,
      {
        inputs: text,
        parameters: {
          max_length: Math.min(150, Math.floor(text.length * 0.3)),
          min_length: Math.min(50, Math.floor(text.length * 0.1)),
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

    return Array.isArray(response.data) ? response.data[0].summary_text : response.data.summary_text;
  }

  // Split text into chunks
  const chunks = chunkTextForBART(text);
  const chunkSummaries = await Promise.all(
    chunks.map(chunk => recursiveSummarize(chunk, depth + 1))
  );

  // Combine chunk summaries and summarize again
  const combinedSummary = chunkSummaries.join(' ');
  return recursiveSummarize(combinedSummary, depth + 1);
};

// Update the generateSummary function
const generateSummary = async (text: string, type: 'text' | 'url' | 'file'): Promise<{ summary: string, modelUsed: string }> => {
  try {
    if (!process.env.HUGGING_FACE_API_KEY) {
      throw new Error('HUGGING_FACE_API_KEY is not configured');
    }

    // Input validation and cleaning
    if (!text || typeof text !== 'string') {
      throw new Error('Invalid input: text must be a non-empty string');
    }
    text = text.trim();

    // Select model based on text characteristics
    const { model, apiUrl } = selectModel(text, type);
    const documentType = detectDocumentType(text);

    let summary: string;
    
    if (model === 'BART-large-CNN' && text.length > BART_MAX_LENGTH) {
      console.log('Text exceeds BART length limit, using chunking strategy...');
      summary = await recursiveSummarize(text);
      console.log('Successfully generated summary using chunking strategy');
    } else {
      // Use existing logic for LONGT5 or short texts
      const params = model === 'BART-large-CNN' ? {
        max_length: documentType === 'cover_letter' ? 200 : 150,
        min_length: documentType === 'cover_letter' ? 100 : 50,
        do_sample: false,
        num_beams: 4,
        length_penalty: documentType === 'cover_letter' ? 1.5 : 2.0,
        early_stopping: true
      } : {
        max_length: 512,
        min_length: 100,
        do_sample: false,
        num_beams: 4,
        length_penalty: 2.0,
        early_stopping: true
      };

      const response = await axios.post(
        apiUrl,
        {
          inputs: text,
          parameters: params
        },
        {
          headers: {
            'Authorization': `Bearer ${process.env.HUGGING_FACE_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      summary = Array.isArray(response.data) ? 
        response.data[0].summary_text : 
        response.data.summary_text;
    }

    // Clean up the summary
    summary = summary
      .replace(/^summarize:\s*/i, '')
      .replace(/\s+/g, ' ')
      .replace(/^\s*-\s*/, '')
      .trim();

    if (!summary.trim()) {
      throw new Error('Generated summary is empty');
    }

    return { summary, modelUsed: model };
  } catch (error: any) {
    console.error('Summarization error:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    throw error;
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

// Summarize URL
router.post('/url', auth, async (req: any, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'No URL provided' });
    }

    // Fetch content from URL
    const response = await axios.get(url);
    const content = response.data;
    const { summary, modelUsed } = await generateSummary(content, 'url');

    // Save to MongoDB
    const newSummary = new Summary({
      userId: req.user._id,
      originalContent: content,
      summary,
      modelUsed,
      type: 'url',
      sourceUrl: url
    });
    await newSummary.save();

    res.status(200).json({ summary, model_used: modelUsed, id: newSummary._id });
  } catch (error) {
    console.error('URL summarization error:', error);
    res.status(500).json({ error: 'Error summarizing URL' });
  }
});

// Add debug logging function
const debugLog = (message: string, data?: any) => {
  console.log(`[DEBUG] ${message}`, data ? data : '');
};

// Improve text cleaning function
const cleanText = (text: string): string => {
  if (!text) return '';
  
  return text
    .replace(/\s+/g, ' ')           // Replace multiple spaces with single space
    .replace(/[\r\n]+/g, ' ')       // Replace newlines with space
    .replace(/[^\x20-\x7E\n]/g, '') // Keep only printable characters and newlines
    .replace(/\.([A-Z])/g, '. $1')  // Add space after periods followed by capital letters
    .trim();
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