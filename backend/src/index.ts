import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import helmet from 'helmet';
import morgan from 'morgan';
import authRoutes from './routes/auth';
import summarizeRoutes from './routes/summarize';
import historyRoutes from './routes/history';
import path from 'path';
import fs from 'fs';

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 5001;

// Security middleware
app.use(helmet());

// CORS configuration
const corsOptions = {
  origin: process.env.NODE_ENV === 'production'
    ? process.env.FRONTEND_URL
    : ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('dev')); // Request logging

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/summarize', summarizeRoutes);
app.use('/api/history', historyRoutes);

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handling middleware
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Global error:', err);
  
  // Handle different types of errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation Error',
      details: err.message
    });
  }

  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({
      error: 'Unauthorized',
      details: 'Invalid token or no token provided'
    });
  }

  // Default error response
  res.status(err.status || 500).json({
    error: 'Internal Server Error',
    details: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// MongoDB connection with retry logic
const connectWithRetry = async (retryCount = 1, maxRetries = 5) => {
  try {
    const options = {
      serverSelectionTimeoutMS: 5000,
      maxPoolSize: 10
    };

    await mongoose.connect(process.env.MONGODB_URI as string, options);
    console.log('MongoDB connected successfully');
    
    // Start server only after successful database connection
    app.listen(port, () => {
      console.log(`Server is running on port ${port}`);
      console.log(`Environment: ${process.env.NODE_ENV}`);
      if (process.env.NODE_ENV === 'development') {
        console.log('CORS enabled for:', corsOptions.origin);
      }
    });

  } catch (error) {
    console.error(`MongoDB connection attempt ${retryCount} failed:`, error);
    
    if (retryCount < maxRetries) {
      console.log(`Retrying in 5 seconds... (Attempt ${retryCount + 1}/${maxRetries})`);
      setTimeout(() => {
        connectWithRetry(retryCount + 1, maxRetries);
      }, 5000);
    } else {
      console.error('Failed to connect to MongoDB after maximum retries');
      process.exit(1);
    }
  }
};

// Initialize connection
connectWithRetry(); 