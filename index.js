import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: ['http://localhost:5173', 'https://linkedin-ui-ux.vercel.app'],
  credentials: true
}));
app.use(express.json());

// Serve static files (PDFs) from applications folder
app.use('/applications', express.static(path.join(__dirname, 'applications')));

// Mongoose Schema
const commentSchema = new mongoose.Schema({
  person: String,
  text: String,
  date: String
}, { _id: false });

const applicantSchema = new mongoose.Schema({
  id: { type: Number, required: true, unique: true },
  fullName: String,
  linkedinUrl: String,
  expectedSalary: String,
  notes: String,
  resumeName: String,
  resumePath: String,
  dateAdded: String,
  comments: [commentSchema]
});

const Applicant = mongoose.model('Applicant', applicantSchema);

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

// Get all applicants
app.get('/api/applicants', async (req, res) => {
  try {
    const applicants = await Applicant.find({}).lean();
    res.json(applicants);
  } catch (error) {
    console.error('Error fetching applicants:', error);
    res.status(500).json({ error: 'Failed to fetch applicants' });
  }
});

// Add new applicant
app.post('/api/applicants', async (req, res) => {
  try {
    const newApplicant = new Applicant({
      ...req.body,
      id: Date.now(),
      dateAdded: new Date().toLocaleDateString()
    });

    await newApplicant.save();
    res.json({ success: true, applicant: newApplicant.toObject() });
  } catch (error) {
    console.error('Error adding applicant:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update applicant
app.put('/api/applicants/:id', async (req, res) => {
  try {
    const applicantId = parseInt(req.params.id);
    const updatedApplicant = await Applicant.findOneAndUpdate(
      { id: applicantId },
      { $set: req.body },
      { new: true, lean: true }
    );

    if (updatedApplicant) {
      res.json({ success: true, applicant: updatedApplicant });
    } else {
      res.status(404).json({ success: false, error: 'Applicant not found' });
    }
  } catch (error) {
    console.error('Error updating applicant:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete applicant
app.delete('/api/applicants/:id', async (req, res) => {
  try {
    const applicantId = parseInt(req.params.id);
    const result = await Applicant.deleteOne({ id: applicantId });

    if (result.deletedCount > 0) {
      res.json({ success: true });
    } else {
      res.status(404).json({ success: false, error: 'Applicant not found' });
    }
  } catch (error) {
    console.error('Error deleting applicant:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Add comment to applicant
app.post('/api/applicants/:id/comments', async (req, res) => {
  try {
    const applicantId = parseInt(req.params.id);

    // First remove any existing comment from the same person
    await Applicant.updateOne(
      { id: applicantId },
      { $pull: { comments: { person: req.body.person } } }
    );

    // Then add the new comment
    const updatedApplicant = await Applicant.findOneAndUpdate(
      { id: applicantId },
      { $push: { comments: req.body } },
      { new: true, lean: true }
    );

    if (updatedApplicant) {
      res.json({ success: true, comment: req.body });
    } else {
      res.status(404).json({ success: false, error: 'Applicant not found' });
    }
  } catch (error) {
    console.error('Error adding comment:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Clear all applicants
app.delete('/api/clear-all', async (req, res) => {
  try {
    await Applicant.deleteMany({});
    res.json({ success: true });
  } catch (error) {
    console.error('Error clearing applicants:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
