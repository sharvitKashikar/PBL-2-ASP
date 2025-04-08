import express from 'express';
import multer from 'multer';
import { auth } from '../middleware/auth';
import { Summary } from '../models/Summary';
import axios from 'axios';
import { promises as fs } from 'fs';
import pdf from 'pdf-parse';
import dotenv from 'dotenv';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { CONFIG } from '../config';

dotenv.config();
const router = express.Router();
const execAsync = promisify(exec);

// Enhanced model configurations
interface ModelConfig {
  url: string;
  maxLength: number;
  minLength: number;
  temperature: number;
  numBeams: number;
  lengthPenalty: number;
  repetitionPenalty: number;
  bestFor: string[];
}

// First, add the Python script execution function
const runLocalModel = async (text: string, modelName: string, params: any) => {
  try {
    // Get the path to the Python script
    const scriptPath = path.join(__dirname, '../utils/local_inference.py');
    
    // Create a temporary file for the input text
    const tmpInputPath = path.join(CONFIG.UPLOAD_DIR, `${Date.now()}_input.txt`);
    await fs.writeFile(tmpInputPath, text);

    // Execute the Python script with parameters
    const cmd = `python3 ${scriptPath} "${tmpInputPath}" "${modelName}" '${JSON.stringify(params)}'`;
    const { stdout } = await execAsync(cmd);
    
    // Clean up temp file
    await fs.unlink(tmpInputPath);
    
    // Parse and return the result
    return JSON.parse(stdout).summary;
  } catch (error: any) {
    console.error('Local model inference error:', error);
    throw new Error(`Failed to run local model: ${error.message}`);
  }
};

// Update model configurations to use local models
const MODEL_CONFIGS: Record<string, ModelConfig> = {
  'FLAN-T5-XL': {
    url: 'google/flan-t5-base',  // Using smaller base model for local inference
    maxLength: 1024,
    minLength: 200,
    temperature: 0.3,
    numBeams: 8,
    lengthPenalty: 2.0,
    repetitionPenalty: 1.5,
    bestFor: ['technical', 'scientific', 'short', 'business']
  },
  'BART-LARGE-CNN': {
    url: 'facebook/bart-base',  // Using smaller base model
    maxLength: 1024,
    minLength: 250,
    temperature: 0.4,
    numBeams: 6,
    lengthPenalty: 2.2,
    repetitionPenalty: 1.4,
    bestFor: ['news', 'articles', 'medium']
  },
  'LED-BASE-16384': {
    url: 'allenai/led-base-16384',
    maxLength: 16384,
    minLength: 400,
    temperature: 0.3,
    numBeams: 10,
    lengthPenalty: 2.5,
    repetitionPenalty: 1.8,
    bestFor: ['research', 'long', 'technical']
  },
  'PEGASUS-LARGE': {
    url: 'google/pegasus-base',  // Using smaller base model
    maxLength: 1024,
    minLength: 150,
    temperature: 0.4,
    numBeams: 8,
    lengthPenalty: 2.0,
    repetitionPenalty: 1.6,
    bestFor: ['scientific', 'medium', 'structured']
  },
  'T5-LARGE': {
    url: 't5-base',  // Using smaller base model
    maxLength: 1024,
    minLength: 200,
    temperature: 0.3,
    numBeams: 8,
    lengthPenalty: 2.0,
    repetitionPenalty: 1.5,
    bestFor: ['verification', 'cross-check']
  }
};

// Replace the API call function with local inference
const callHuggingFaceAPI = async (modelName: string, inputs: any, parameters: any) => {
  const config = MODEL_CONFIGS[modelName];
  if (!config) {
    throw new Error(`Invalid model configuration for ${modelName}`);
  }

  try {
    return await runLocalModel(inputs, config.url, parameters);
  } catch (error: any) {
    console.error(`Error running local model ${modelName}:`, error);
    throw error;
  }
};

// Enhanced document type detection
interface DocumentAnalysis {
  type: 'research' | 'technical' | 'article' | 'general' | 'business';
  complexity: 'high' | 'medium' | 'low';
  length: 'short' | 'medium' | 'long';
  hasEquations: boolean;
  hasCitations: boolean;
  hasCode: boolean;
  domain?: 'technology' | 'finance' | 'management' | 'general_business';
}

// Storage configuration for file uploads
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
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const uniqueName = `${Date.now()}-${sanitizedName}`;
    cb(null, uniqueName);
  }
});

// Configure multer with larger size limits
const upload = multer({
  storage,
  limits: {
    fileSize: CONFIG.MAX_FILE_SIZE,
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

// Debug logging function
const logDebug = (message: string, data?: any) => {
  console.log(`[${new Date().toISOString()}] ${message}`);
  if (data) {
    console.log('Data:', JSON.stringify(data, null, 2));
  }
};

// Document analysis function
const analyzeDocument = (text: string): DocumentAnalysis => {
  const lowerText = text.toLowerCase();
  
  // Enhanced business/tech content detection
  const businessTerms = /(digital transformation|business|customer|market|strategy|innovation|ROI|revenue|operational|enterprise)/gi;
  const techTerms = /(technology|software|AI|automation|cloud|data|analytics|IoT|cybersecurity|digital)/gi;
  const managementTerms = /(leadership|management|organization|workforce|culture|performance|productivity)/gi;
  const financeTerms = /(cost|investment|financial|budget|profit|pricing|revenue)/gi;
  
  const businessScore = (lowerText.match(businessTerms) || []).length;
  const techScore = (lowerText.match(techTerms) || []).length;
  const managementScore = (lowerText.match(managementTerms) || []).length;
  const financeScore = (lowerText.match(financeTerms) || []).length;
  
  // Determine document characteristics
  const hasAbstract = /abstract[\s\n]+/i.test(text);
  const hasMethodology = /(methodology|methods|experimental setup)/i.test(text);
  const hasResults = /(results|findings|outcomes|impact)/i.test(text);
  const hasConclusion = /(conclusion|discussion|future|recommendations)/i.test(text);
  const hasReferences = /(references|bibliography|works cited)/i.test(text);
  const hasCitations = /\[\d+\]|\(\w+\s+et\s+al\.,?\s+\d{4}\)|\(\w+,\s+\d{4}\)/i.test(text);
  const hasEquations = /[=+\-×÷∑∏√∫]|[α-ωΑ-Ω]|dx\/dt/i.test(text);
  const hasCode = /(function|class|def|var|let|const|if|else|for|while|return|import|from)/i.test(text);
  
  // Determine domain based on term frequency
  let domain: 'technology' | 'finance' | 'management' | 'general_business' = 'general_business';
  const scores = {
    technology: techScore,
    finance: financeScore,
    management: managementScore
  };
  const maxScore = Math.max(techScore, financeScore, managementScore);
  if (maxScore > 2) {
    domain = (Object.entries(scores).find(([_, score]) => score === maxScore)?.[0] as any) || 'general_business';
  }
  
  // Determine complexity
  const complexityScore = [
    hasEquations,
    hasCitations,
    hasCode,
    hasMethodology,
    hasResults
  ].filter(Boolean).length;
  
  const complexity = complexityScore >= 3 ? 'high' : 
                    complexityScore >= 1 ? 'medium' : 'low';
  
  // Determine length category
  const length = text.length > 10000 ? 'long' :
                text.length > 3000 ? 'medium' : 'short';
  
  // Determine document type with enhanced business detection
  const type = businessScore > 3 ? 'business' :
               (hasAbstract && hasMethodology && hasResults && hasReferences) ? 'research' :
               (hasCode || hasEquations || complexity === 'high') ? 'technical' :
               (hasAbstract || hasCitations) ? 'article' : 'general';
  
  return {
    type,
    complexity,
    length,
    hasEquations,
    hasCitations,
    hasCode,
    domain
  };
};

// Enhanced text preprocessing
const preprocessText = (text: string, analysis: DocumentAnalysis): string => {
  let processed = text;
  
  // Basic cleaning
  processed = processed
    .replace(/(?:\r\n|\r|\n){2,}/g, '\n\n')
    .replace(/\s+/g, ' ')
    .trim();
  
  // Handle citations based on document type
  if (analysis.type === 'research' || analysis.hasCitations) {
    processed = processed
      .replace(/\[\d+(?:,\s*\d+)*\]/g, '')  // Remove numbered citations
      .replace(/\(\w+\s+et\s+al\.,?\s+\d{4}\)/g, '')  // Remove author-year citations
      .replace(/\([^)]+\d{4}[^)]*\)/g, '');  // Remove other year-based citations
  }
  
  // Handle equations if present
  if (analysis.hasEquations) {
    processed = processed
      .replace(/\$\$[^$]+\$\$/g, '[EQUATION]')  // Replace display equations
      .replace(/\$[^$]+\$/g, '[EQUATION]');     // Replace inline equations
  }
  
  // Handle code blocks if present
  if (analysis.hasCode) {
    processed = processed
      .replace(/```[^`]+```/g, '[CODE_BLOCK]')
      .replace(/`[^`]+`/g, '[CODE]');
  }
  
  // Extract main content for research papers
  if (analysis.type === 'research') {
    const sections = processed.split(/\n(?=[A-Z][a-z]+\s*\n|[A-Z][A-Z\s]+\n)/);
    const relevantSections = sections.filter(section => 
      !/^(Acknowledgements|References|Bibliography|Appendix)/i.test(section)
    );
    processed = relevantSections.join('\n\n');
  }
  
  return processed;
};

// Enhanced prompt engineering
const createPrompt = (text: string, analysis: DocumentAnalysis): string => {
  const basePrompt = `Generate a comprehensive and accurate summary that preserves all key information and maintains the original meaning. The summary should be well-structured and logically organized.`;
  
  const typeSpecificPrompts = {
    business: `Provide an insightful business analysis summary that covers:

1. Context & Trends
   - Key industry trends and market dynamics
   - Business challenges and opportunities
   - Technological or operational shifts
   ${analysis.domain === 'technology' ? '- Technical innovations and their business impact' : ''}
   ${analysis.domain === 'finance' ? '- Financial implications and considerations' : ''}
   ${analysis.domain === 'management' ? '- Organizational and management aspects' : ''}

2. Strategic Implications
   - Business value and competitive advantages
   - Operational improvements and efficiencies
   - Risk factors and mitigation strategies
   - Market positioning and differentiation

3. Implementation & Impact
   - Practical applications and use cases
   - Success factors and best practices
   - Change management considerations
   - Expected outcomes and benefits

4. Future Outlook
   - Growth opportunities and potential challenges
   - Recommendations for action
   - Industry-specific considerations
   - Long-term strategic implications

Maintain professional business language while providing actionable insights and clear value propositions.`,
    research: `Summarize this research paper with emphasis on:
1. Research Problem & Objectives
   - Main research questions and goals
   - Significance and context
   - Key hypotheses if present

2. Methodology
   - Research design and approach
   - Data collection methods
   - Analysis techniques
   - Key experimental procedures

3. Results & Findings
   - Primary discoveries
   - Statistical significance
   - Key measurements and outcomes
   - Important observations

4. Conclusions & Implications
   - Main conclusions
   - Theoretical contributions
   - Practical applications
   - Future research directions

Maintain academic rigor and preserve technical accuracy. Include specific metrics and measurements where relevant.`,
    
    technical: `Provide a technical summary that includes:
1. Core Concepts & Technology
   - Key technical components
   - System architecture/design
   - Implementation details
   ${analysis.hasCode ? '- Key algorithms or code structures' : ''}
   ${analysis.hasEquations ? '- Mathematical models or equations' : ''}

2. Technical Specifications
   - Performance metrics
   - System requirements
   - Technical constraints
   - Implementation considerations

3. Results & Validation
   - Performance results
   - Testing outcomes
   - Validation methods
   - Technical limitations`,
    
    article: `Create a comprehensive summary that covers:
1. Main Topics & Arguments
   - Central themes
   - Key arguments
   - Supporting evidence
   - Context and background

2. Analysis & Discussion
   - Critical points
   - Different perspectives
   - Supporting data
   - Expert opinions

3. Conclusions & Implications
   - Main takeaways
   - Practical implications
   - Future considerations`,
    
    general: `Provide a clear and concise summary that:
1. Captures main ideas and key points
2. Maintains logical flow and structure
3. Includes supporting details and examples
4. Preserves important context and relationships
5. Concludes with key takeaways`
  };
  
  return `${basePrompt}\n\n${typeSpecificPrompts[analysis.type] || typeSpecificPrompts.general}\n\nText to summarize: ${text}`;
};

// Enhanced model selection
const selectModel = (text: string, type: 'text' | 'url' | 'file'): string => {
  const analysis = analyzeDocument(text);
  
  if (analysis.type === 'research' || analysis.length === 'long') {
    return 'LED-BASE-16384';
  }
  
  if (analysis.type === 'technical' || analysis.complexity === 'high') {
    return 'FLAN-T5-XL';
  }
  
  if (analysis.type === 'article' && analysis.length === 'medium') {
    return 'BART-LARGE-CNN';
  }
  
  return 'PEGASUS-LARGE';
};

// Enhanced text chunking
const chunkText = (text: string, analysis: DocumentAnalysis): string[] => {
  const chunks: string[] = [];
  
  if (analysis.type === 'research') {
    // Split by sections for research papers
    const sections = text.split(/\n(?=[A-Z][a-z]+\s*\n|[A-Z][A-Z\s]+\n)/);
    let currentChunk = '';
    
    for (const section of sections) {
      if ((currentChunk + section).length <= CONFIG.CHUNK_SIZE) {
        currentChunk += (currentChunk ? '\n\n' : '') + section;
      } else {
        if (currentChunk) chunks.push(currentChunk.trim());
        currentChunk = section;
      }
    }
    
    if (currentChunk) chunks.push(currentChunk.trim());
  } else {
    // Split by paragraphs for other document types
    let startIndex = 0;
    
    while (startIndex < text.length) {
      let endIndex = startIndex + CONFIG.CHUNK_SIZE;
      
      if (endIndex < text.length) {
        // Find the last sentence boundary
        const chunk = text.slice(startIndex, endIndex + 100);
        const sentences = chunk.match(/[^.!?]+[.!?]+/g) || [];
        
        if (sentences.length > 1) {
          const lastComplete = sentences.slice(0, -1).join('');
          endIndex = startIndex + lastComplete.length;
        }
      }
      
      chunks.push(text.slice(startIndex, endIndex).trim());
      startIndex = endIndex - CONFIG.OVERLAP_SIZE;
    }
  }
  
  return chunks;
};

// Enhanced content verification interface
interface ContentCheckpoint {
  key_points: string[];
  entities: string[];
  relationships: string[];
  metrics: string[];
  context: string[];
}

// Function to extract key information using NLP patterns
const extractKeyInformation = (text: string): ContentCheckpoint => {
  const checkpoint: ContentCheckpoint = {
    key_points: [],
    entities: [],
    relationships: [],
    metrics: [],
    context: []
  };

  // Extract key points (sentences with important indicators)
  const keyPointPatterns = [
    /(?:most|key|main|primary|critical|essential|significant|important).*?[.!?]/gi,
    /(?:notably|specifically|particularly|especially).*?[.!?]/gi,
    /(?:results? show|we found|analysis reveals|demonstrates|indicates).*?[.!?]/gi,
    /(?:conclude|conclusion|therefore|thus|hence).*?[.!?]/gi
  ];

  keyPointPatterns.forEach(pattern => {
    const matches = text.match(pattern) || [];
    checkpoint.key_points.push(...matches);
  });

  // Extract entities (proper nouns, technologies, methods)
  const entityPatterns = [
    /[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/g,  // Proper nouns
    /(?:AI|ML|API|IoT|SaaS|Cloud|Big Data|Blockchain)[a-z\s]*/g,  // Tech terms
    /(?:method|approach|technique|strategy|framework|model|system)[a-z\s]*/gi  // Methods
  ];

  entityPatterns.forEach(pattern => {
    const matches = text.match(pattern) || [];
    checkpoint.entities.push(...matches);
  });

  // Extract relationships (causal and correlational)
  const relationshipPatterns = [
    /(?:causes|leads to|results in|affects|impacts|influences).*?[.!?]/gi,
    /(?:correlates with|associated with|related to|connected to).*?[.!?]/gi,
    /(?:depends on|relies on|based on|derived from).*?[.!?]/gi
  ];

  relationshipPatterns.forEach(pattern => {
    const matches = text.match(pattern) || [];
    checkpoint.relationships.push(...matches);
  });

  // Extract metrics and measurements
  const metricPatterns = [
    /\d+(?:\.\d+)?%/g,  // Percentages
    /\d+(?:\.\d+)?\s*(?:times|x)/g,  // Multipliers
    /(?:increased|decreased|reduced|improved|enhanced|declined)\s+by\s+\d+(?:\.\d+)?%/g,  // Changes
    /(?:accuracy|precision|recall|F1|score|metric|measurement|rate)\s*(?:of|:)?\s*\d+(?:\.\d+)?/gi  // Metrics
  ];

  metricPatterns.forEach(pattern => {
    const matches = text.match(pattern) || [];
    checkpoint.metrics.push(...matches);
  });

  // Extract contextual information
  const contextPatterns = [
    /(?:previously|historically|traditionally|conventionally).*?[.!?]/gi,
    /(?:currently|presently|now|today).*?[.!?]/gi,
    /(?:in the future|going forward|potentially|possibly).*?[.!?]/gi,
    /(?:however|although|despite|nevertheless).*?[.!?]/gi
  ];

  contextPatterns.forEach(pattern => {
    const matches = text.match(pattern) || [];
    checkpoint.context.push(...matches);
  });

  return checkpoint;
};

// Function to validate summary completeness
const validateSummaryCompleteness = (
  originalCheckpoint: ContentCheckpoint,
  summaryCheckpoint: ContentCheckpoint
): boolean => {
  // Calculate coverage ratios
  const keyPointsCoverage = summaryCheckpoint.key_points.length / originalCheckpoint.key_points.length;
  const entitiesCoverage = summaryCheckpoint.entities.length / originalCheckpoint.entities.length;
  const metricsCoverage = summaryCheckpoint.metrics.length / originalCheckpoint.metrics.length;

  // Summary should maintain at least 70% coverage of key elements
  return keyPointsCoverage >= 0.7 && entitiesCoverage >= 0.7 && metricsCoverage >= 0.7;
};

// Enhanced summary generation with cross-validation
const generateEnhancedSummary = async (text: string, type: 'text' | 'url' | 'file'): Promise<{ summary: string, modelUsed: string }> => {
  const analysis = analyzeDocument(text);
  const originalCheckpoint = extractKeyInformation(text);
  
  // Select model based on type and analysis
  const selectedModel = type === 'file' ? 'LED-BASE-16384' : selectModel(text, type);
  
  // Generate summaries using multiple models
  const summaries = await Promise.all(
    Object.entries(MODEL_CONFIGS).map(async ([modelName, config]) => {
      try {
        const prompt = createPrompt(text, analysis);
        const summary = await callHuggingFaceAPI(
          modelName,
          prompt,
          {
            max_length: config.maxLength,
            min_length: config.minLength,
            temperature: config.temperature,
            num_beams: config.numBeams,
            length_penalty: config.lengthPenalty,
            repetition_penalty: config.repetitionPenalty,
            do_sample: true,
            top_p: 0.95,
            no_repeat_ngram_size: 3
          }
        );

        const summaryCheckpoint = extractKeyInformation(summary);
        
        return {
          modelName,
          summary,
          isComplete: validateSummaryCompleteness(originalCheckpoint, summaryCheckpoint),
          checkpoint: summaryCheckpoint
        };
      } catch (error) {
        console.error(`Error with model ${modelName}:`, error);
        return null;
      }
    })
  );

  // Filter out failed attempts
  const validSummaries = summaries.filter(s => s !== null);
  
  // Ensure all code paths return a value
  if (validSummaries.length === 0) {
    throw new Error('All summary generation attempts failed');
  }

  const bestSummary = validSummaries.reduce((best, current) => {
    if (!best || (current?.isComplete && !best.isComplete)) {
      return current;
    }
    if (best.isComplete === current?.isComplete) {
      const bestCoverage = Object.keys(best.checkpoint).length;
      const currentCoverage = Object.keys(current.checkpoint).length;
      return currentCoverage > bestCoverage ? current : best;
    }
    return best;
  });

  return {
    summary: bestSummary?.summary || validSummaries[0]?.summary,
    modelUsed: bestSummary?.modelName || validSummaries[0]?.modelName
  };
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
    logDebug('Received text summarization request', {
      textLength: text?.length,
      textPreview: text?.substring(0, 100)
    });

    if (!text) {
      return res.status(400).json({ error: 'No text provided' });
    }

    const { summary, modelUsed } = await generateEnhancedSummary(text, 'text');
    
    // Save to MongoDB
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
    console.error('Text summarization error:', error);
    res.status(500).json({ error: error.message || 'Error summarizing text' });
  }
});

// URL summarization endpoint
router.post('/url', auth, async (req: any, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    logDebug('Processing URL:', url);

    // Get the path to the Python script
    const scriptPath = path.join(__dirname, '../utils/article_extractor.py');

    // Execute the Python script
    const { stdout } = await execAsync(`python3 ${scriptPath} "${url}"`);
    
    // Parse the Python script output
    const articleData = JSON.parse(stdout);

    if (!articleData.success) {
      return res.status(400).json({ 
        error: 'Failed to extract article content',
        details: articleData.error 
      });
    }

    if (!articleData.text) {
      return res.status(400).json({ error: 'No readable content found at URL' });
    }

    // Generate summary using the extracted text
    const { summary, modelUsed } = await generateEnhancedSummary(articleData.text, 'url');

    // Save to MongoDB
    const newSummary = new Summary({
      userId: req.user._id,
      originalContent: articleData.text,
      summary,
      modelUsed,
      type: 'url',
      sourceUrl: url,
      metadata: {
        title: articleData.title,
        authors: articleData.authors,
        publishDate: articleData.publish_date,
        topImage: articleData.top_image
      }
    });
    await newSummary.save();

    return res.status(200).json({ 
      summary, 
      model_used: modelUsed, 
      id: newSummary._id,
      metadata: {
        title: articleData.title,
        authors: articleData.authors,
        publishDate: articleData.publish_date,
        topImage: articleData.top_image
      }
    });

  } catch (error: any) {
    console.error('URL summarization error:', error);
    
    if (error.code === 'ENOENT') {
      return res.status(500).json({ 
        error: 'Article extraction script not found. Please ensure Python and newspaper3k are installed.' 
      });
    }

    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      return res.status(400).json({ 
        error: 'Could not connect to the URL. Please check if the URL is valid and accessible.' 
      });
    }

    return res.status(500).json({ 
      error: `Failed to process URL: ${error.message}` 
    });
  }
});

// File upload endpoint
router.post('/file', auth, async (req: any, res) => {
  let filePath = '';
  
  try {
    logDebug('Starting file upload process...');
    
    // Handle file upload
    await new Promise<void>((resolve, reject) => {
      upload.single('file')(req, res, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });

    if (!req.file) {
      throw new Error('No file uploaded');
    }

    filePath = req.file.path;
    let text = '';

    // Process PDF file
    if (req.file.mimetype === 'application/pdf') {
      logDebug('Processing PDF file...');
      const dataBuffer = await fs.readFile(filePath);
      
      const pdfData = await pdf(dataBuffer, {
        // Add custom PDF parsing options
        pagerender: (pageData: any) => {
          return pageData.getTextContent({
            normalizeWhitespace: true,
            disableCombineTextItems: false
          }).then((textContent: any) => {
            return textContent.items
              .map((item: any) => item.str)
              .join(' ');
          });
        }
      });
      
      let text = pdfData.text;
      
      // Skip NBER disclaimer if present
      const nberDisclaimer = text.match(/NBER working papers are circulated for discussion and comment purposes[^]*/);
      if (nberDisclaimer) {
        text = text.substring(nberDisclaimer[0].length).trim();
      }
      
      // Enhanced text extraction and cleaning for research papers
      text = text
        .replace(/(?:\r\n|\r|\n){2,}/g, '\n\n')  // Normalize line breaks
        .replace(/\[[\d,\s-]+\]/g, ' ')  // Replace citations with space instead of removing
        .replace(/Fig\.\s*\d+|Figure\s*\d+/gi, '')  // Remove figure references
        .replace(/Table\s*\d+/gi, '')  // Remove table references
        .replace(/^\s*\d+\s*$\n/gm, '')  // Remove standalone page numbers
        .replace(/^Page\s+\d+\s+of\s+\d+$/gm, '')  // Remove page indicators
        .replace(/\f/g, '\n\n')  // Replace form feeds with double newlines
        .trim();

      // Improved section detection for research papers
      const sections = text.split(/(?=\n\s*[A-Z][A-Za-z\s]{2,}(?:\n|\s*$))/);
      const processedSections = [];
      let inMainContent = false;
      
      for (const section of sections) {
        const sectionTitle = section.match(/^\s*([A-Z][A-Za-z\s]{2,})\s*(?:\n|$)/)?.[1]?.trim().toLowerCase();
        
        // Start capturing from abstract or introduction
        if (!inMainContent && sectionTitle && (sectionTitle === 'abstract' || sectionTitle === 'introduction')) {
          inMainContent = true;
        }
        
        // Stop capturing at references or appendix
        if (inMainContent && sectionTitle && (sectionTitle === 'references' || sectionTitle === 'bibliography' || sectionTitle === 'appendix')) {
          inMainContent = false;
          break;
        }
        
        if (inMainContent) {
          // Skip empty sections or headers/footers
          if (!section.trim() || (section.length < 100 && /^[A-Z\d\s.-]+$/.test(section))) {
            continue;
          }
          
          // Clean up the section
          let cleanSection = section
            .replace(/^\s*[A-Z][A-Za-z\s]*\n/, (match) => `\n${match.trim()}\n\n`) // Format section headers
            .replace(/\s+/g, ' ')
            .trim();
          
          processedSections.push(cleanSection);
        }
      }
      
      // If no sections were detected, use the whole text
      text = processedSections.length > 0 ? processedSections.join('\n\n') : text;
      
      // Ensure we have meaningful content
      if (text.length < 100) {
        throw new Error('Could not extract meaningful content from the PDF');
      }

      logDebug('Extracted text length:', { length: text.length });
      
      // Force using LED-BASE-16384 for research papers with enhanced parameters
      const modelConfig = MODEL_CONFIGS['LED-BASE-16384'];
      
      // Enhanced research paper prompt
      const prompt = `Generate a comprehensive and detailed summary of this research paper. The summary must include:

1. Research Problem & Objectives:
   - Main research questions and objectives
   - Context and significance of the research
   - Key hypotheses or assumptions

2. Methodology:
   - Research design and approach
   - Data collection methods
   - Analysis techniques
   - Experimental procedures

3. Key Findings:
   - Primary results and discoveries
   - Statistical significance and measurements
   - Important observations
   - Data interpretations

4. Conclusions & Implications:
   - Main conclusions drawn
   - Theoretical and practical implications
   - Limitations and future work
   - Contributions to the field

Maintain academic rigor and preserve all technical details, metrics, and measurements. Ensure the summary is well-structured and follows the logical flow of the paper.

Text to summarize: ${text}`;

      const response = await axios.post(
        modelConfig.url,
        {
          inputs: prompt,
          parameters: {
            max_length: Math.min(2000, Math.floor(text.length * 0.4)),
            min_length: Math.max(500, Math.floor(text.length * 0.15)),
            temperature: 0.3,
            num_beams: 4,
            length_penalty: 2.0,
            repetition_penalty: 1.5,
            do_sample: true,
            early_stopping: true,
            no_repeat_ngram_size: 3,
            top_p: 0.95
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
      
      // Save to database
      const newSummary = new Summary({
        userId: req.user._id,
        originalContent: text,
        summary,
        modelUsed: 'LED-BASE-16384',
        type: 'file',
        filename: req.file.originalname
      });

      await newSummary.save();

      // Clean up the uploaded file
      await fs.unlink(filePath);

      return res.status(200).json({
        summary,
        model_used: 'LED-BASE-16384',
        id: newSummary._id,
        filename: req.file.originalname
      });
    } else {
      // Process text file
      text = await fs.readFile(filePath, 'utf8');

      // Validate text content
      if (!text.trim()) {
        throw new Error('No readable text content found in file');
      }

      let summary: string;
      let modelUsed: string;

      // Check if it's a research paper
      const analysis = analyzeDocument(text);
      if (analysis.type === 'research') {
        const modelConfig = MODEL_CONFIGS['LED-BASE-16384'];
        
        // Enhanced research paper prompt
        const prompt = `Generate a comprehensive and detailed summary of this research paper. The summary must include:

1. Research Problem & Objectives:
   - Main research questions and objectives
   - Context and significance of the research
   - Key hypotheses or assumptions

2. Methodology:
   - Research design and approach
   - Data collection methods
   - Analysis techniques
   - Experimental procedures

3. Key Findings:
   - Primary results and discoveries
   - Statistical significance and measurements
   - Important observations
   - Data interpretations

4. Conclusions & Implications:
   - Main conclusions drawn
   - Theoretical and practical implications
   - Limitations and future work
   - Contributions to the field

Maintain academic rigor and preserve all technical details, metrics, and measurements. Ensure the summary is well-structured and follows the logical flow of the paper.

Text to summarize: ${text}`;

        const response = await axios.post(
          modelConfig.url,
          {
            inputs: prompt,
            parameters: {
              max_length: Math.min(2000, Math.floor(text.length * 0.4)),
              min_length: Math.max(500, Math.floor(text.length * 0.15)),
              temperature: 0.3,
              num_beams: 4,
              length_penalty: 2.0,
              repetition_penalty: 1.5,
              do_sample: true,
              early_stopping: true,
              no_repeat_ngram_size: 3,
              top_p: 0.95
            }
          },
          {
            headers: {
              'Authorization': `Bearer ${process.env.HUGGING_FACE_API_KEY}`,
              'Content-Type': 'application/json'
            }
          }
        );

        summary = Array.isArray(response.data) ? response.data[0].summary_text : response.data.summary_text;
        modelUsed = 'LED-BASE-16384';
      } else {
        // Use standard summary generation for non-research papers
        const result = await generateEnhancedSummary(text, 'file');
        summary = result.summary;
        modelUsed = result.modelUsed;
      }

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

      // Clean up the uploaded file
      await fs.unlink(filePath);

      return res.status(200).json({
        summary,
        model_used: modelUsed,
        id: newSummary._id,
        filename: req.file.originalname
      });
    }

  } catch (error: any) {
    // Clean up file if it exists
    if (filePath) {
      try {
        await fs.unlink(filePath);
      } catch (unlinkError) {
        console.error('Error deleting temporary file:', unlinkError);
      }
    }

    console.error('File processing error:', error);
    return res.status(500).json({
      error: 'Error processing file',
      details: error.message,
      filename: req.file?.originalname
    });
  }
});

export default router; 