import express from 'express';
import { auth } from '../middleware/auth';
import { Summary } from '../models/Summary';

const router = express.Router();

// Get user's summarization history
router.get('/', auth, async (req: any, res) => {
  try {
    const summaries = await Summary.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50);

    res.json(summaries);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching history' });
  }
});

// Get a specific summary
router.get('/:id', auth, async (req: any, res) => {
  try {
    const summary = await Summary.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!summary) {
      return res.status(404).json({ error: 'Summary not found' });
    }

    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching summary' });
  }
});

// Delete a summary
router.delete('/:id', auth, async (req: any, res) => {
  try {
    const summary = await Summary.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!summary) {
      return res.status(404).json({ error: 'Summary not found' });
    }

    res.json({ message: 'Summary deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Error deleting summary' });
  }
});

export default router; 