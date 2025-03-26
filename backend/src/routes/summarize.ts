import express from 'express';
import multer from 'multer';
import { auth } from '../middleware/auth';
import { Summary } from '../models/Summary';
import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import pdf from 'pdf-parse';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();
const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage });

// Helper function to generate summary using Hugging Face API
const generateSummary = async (text: string): Promise<string> => {
  try {
    if (!process.env.HUGGING_FACE_API_KEY) {
      throw new Error('HUGGING_FACE_API_KEY is not configured');
    }

    // Input validation
    if (!text || typeof text !== 'string') {
      throw new Error('Invalid input: text must be a non-empty string');
    }

    // Trim and limit input size if needed
    text = text.trim();
    const maxInputLength = 1000; // Adjust this value based on model's limitations
    if (text.length > maxInputLength) {
      text = text.substring(0, maxInputLength);
      console.log(`Input text truncated to ${maxInputLength} characters`);
    }

    console.log('Sending request to Hugging Face API...');
    const API_URL = "https://api-inference.huggingface.co/models/facebook/bart-large-cnn";
    
    // Add retry logic
    const maxRetries = 3;
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await axios.post(
          API_URL,
          {
            inputs: text,
            parameters: {
              max_length: 150,
              min_length: 50,
              do_sample: false
            }
          },
          {
            headers: {
              'Authorization': `Bearer ${process.env.HUGGING_FACE_API_KEY}`,
              'Content-Type': 'application/json'
            },
            timeout: 30000 // 30 second timeout
          }
        );

        console.log('Response received:', response.data);

        if (Array.isArray(response.data) && response.data.length > 0) {
          if (response.data[0].summary_text) {
            return response.data[0].summary_text;
          }
          if (response.data[0].generated_text) {
            return response.data[0].generated_text;
          }
        }
        
        console.error('Unexpected API response format:', response.data);
        throw new Error('Invalid response format from summarization API');
      } catch (error: any) {
        lastError = error;
        
        // If it's a 503 (model loading) and we haven't exhausted retries, wait and retry
        if (error.response?.status === 503 && attempt < maxRetries) {
          const waitTime = attempt * 2000; // Exponential backoff: 2s, 4s, 6s
          console.log(`Model loading, retrying in ${waitTime/1000} seconds... (Attempt ${attempt}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }
        
        // For other errors or if we're out of retries, throw the error
        throw error;
      }
    }
    
    // If we get here, we've exhausted retries
    throw lastError;
  } catch (error: any) {
    console.error('Detailed summarization error:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    
    if (error.response?.status === 401) {
      throw new Error('Invalid API key or authentication failed');
    }
    if (error.response?.status === 503) {
      throw new Error('Model is still loading after multiple retries, please try again later');
    }
    if (error.code === 'ECONNABORTED') {
      throw new Error('Request timed out. The server might be experiencing high load.');
    }
    
    throw new Error(`Error generating summary: ${error.message}`);
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
    const summary = await generateSummary(text);
    console.log('Summary generated successfully:', {
      summaryLength: summary.length,
      summaryPreview: summary.substring(0, 100)
    });

    const model_used = 'BART-large-CNN';

    // Save to MongoDB
    const newSummary = new Summary({
      userId: req.user._id,
      originalContent: text,
      summary,
      modelUsed: model_used,
      type: 'text'
    });
    
    console.log('Saving summary to database...');
    await newSummary.save();
    console.log('Summary saved successfully');

    res.status(200).json({ summary, model_used, id: newSummary._id });
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
    const summary = await generateSummary(content);
    const model_used = 'BART-large-CNN';

    // Save to MongoDB
    const newSummary = new Summary({
      userId: req.user._id,
      originalContent: content,
      summary,
      modelUsed: model_used,
      type: 'url',
      sourceUrl: url
    });
    await newSummary.save();

    res.status(200).json({ summary, model_used, id: newSummary._id });
  } catch (error) {
    console.error('URL summarization error:', error);
    res.status(500).json({ error: 'Error summarizing URL' });
  }
});

// File upload endpoint
router.post('/file', auth, upload.single('file'), async (req: any, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log('File upload received:', {
      filename: req.file.filename,
      mimetype: req.file.mimetype,
      size: req.file.size
    });

    // Validate file type
    const allowedTypes = ['text/plain', 'application/pdf'];
    if (!allowedTypes.includes(req.file.mimetype)) {
      await fs.unlink(req.file.path); // Clean up invalid file
      return res.status(400).json({ 
        error: 'Invalid file type. Only PDF and text files are allowed.',
        details: `Received file type: ${req.file.mimetype}`
      });
    }

    // Read file content
    let text = '';
    const filePath = req.file.path;

    if (req.file.mimetype === 'application/pdf') {
      const dataBuffer = await fs.readFile(filePath);
      const pdfData = await pdf(dataBuffer);
      text = pdfData.text;
    } else {
      text = await fs.readFile(filePath, 'utf8');
    }

    // Clean up file after reading
    await fs.unlink(filePath);

    if (!text.trim()) {
      return res.status(400).json({ error: 'The file appears to be empty or contains no readable text' });
    }

    console.log('Attempting to generate summary from file content...');
    const summary = await generateSummary(text);
    const model_used = 'BART-large-CNN';

    // Save to MongoDB
    const newSummary = new Summary({
      userId: req.user._id,
      originalContent: text,
      summary,
      modelUsed: model_used,
      type: 'file',
      filename: req.file.originalname
    });

    await newSummary.save();
    res.status(200).json({ summary, model_used, id: newSummary._id });
  } catch (error: any) {
    // Clean up file in case of error
    if (req.file?.path) {
      try {
        await fs.unlink(req.file.path);
      } catch (unlinkError) {
        console.error('Error deleting file:', unlinkError);
      }
    }

    console.error('File processing error:', {
      error: error.message,
      stack: error.stack,
      file: req.file
    });

    res.status(500).json({ 
      error: 'Error processing file',
      details: error.message
    });
  }
});

export default router; 