import mongoose, { Document } from 'mongoose';

export interface ISummary extends Document {
  userId: mongoose.Types.ObjectId;
  originalContent: string;
  summary: string;
  modelUsed: string;
  type: 'text' | 'url' | 'file';
  sourceUrl?: string;
  fileName?: string;
  metadata: {
    title: string;
    authors: string;
    publishDate: string;
    topImage: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const summarySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    originalContent: {
      type: String,
      required: true,
    },
    summary: {
      type: String,
      required: true,
    },
    modelUsed: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ['text', 'url', 'file'],
      required: true,
    },
    sourceUrl: {
      type: String,
    },
    fileName: {
      type: String,
    },
    metadata: {
      title: String,
      authors: String,
      publishDate: String,
      topImage: String
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
summarySchema.index({ userId: 1, createdAt: -1 });

export const Summary = mongoose.model<ISummary>('Summary', summarySchema); 