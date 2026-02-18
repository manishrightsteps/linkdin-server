import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const applicantsFile = path.join(__dirname, 'data', 'applicants.json');
const applicationsDir = path.join(__dirname, 'public', 'applications');

if (!fs.existsSync(path.dirname(applicantsFile))) {
  fs.mkdirSync(path.dirname(applicantsFile), { recursive: true });
}

if (!fs.existsSync(applicationsDir)) {
  fs.mkdirSync(applicationsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, applicationsDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = req.body.fileName || `${Date.now()}_${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  }
});

function readApplicants() {
  try {
    if (fs.existsSync(applicantsFile)) {
      const data = fs.readFileSync(applicantsFile, 'utf8');
      return JSON.parse(data);
    }
    return [];
  } catch (error) {
    console.error('Error reading applicants file:', error);
    return [];
  }
}

function writeApplicants(applicants) {
  try {
    fs.writeFileSync(applicantsFile, JSON.stringify(applicants, null, 2));
    return true;
  } catch (error) {
    console.error('Error writing applicants file:', error);
    return false;
  }
}

app.get('/api/applicants', (req, res) => {
  const applicants = readApplicants();
  res.json(applicants);
});

app.post('/api/applicants', (req, res) => {
  try {
    const applicants = readApplicants();
    const newApplicant = {
      ...req.body,
      id: Date.now(),
      dateAdded: new Date().toLocaleDateString()
    };
    
    applicants.push(newApplicant);
    
    if (writeApplicants(applicants)) {
      res.json({ success: true, applicant: newApplicant });
    } else {
      res.status(500).json({ success: false, error: 'Failed to save applicant' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/applicants/:id', (req, res) => {
  try {
    const applicants = readApplicants();
    const applicantId = parseInt(req.params.id);
    const index = applicants.findIndex(a => a.id === applicantId);
    
    if (index !== -1) {
      applicants[index] = { ...applicants[index], ...req.body };
      if (writeApplicants(applicants)) {
        res.json({ success: true, applicant: applicants[index] });
      } else {
        res.status(500).json({ success: false, error: 'Failed to update applicant' });
      }
    } else {
      res.status(404).json({ success: false, error: 'Applicant not found' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/applicants/:id', (req, res) => {
  try {
    const applicants = readApplicants();
    const applicantId = parseInt(req.params.id);
    const index = applicants.findIndex(a => a.id === applicantId);
    
    if (index !== -1) {
      const applicant = applicants[index];
      
      if (applicant.resumePath) {
        const resumeFilePath = path.join(__dirname, 'public', applicant.resumePath);
        if (fs.existsSync(resumeFilePath)) {
          fs.unlinkSync(resumeFilePath);
        }
      }
      
      applicants.splice(index, 1);
      
      if (writeApplicants(applicants)) {
        res.json({ success: true });
      } else {
        res.status(500).json({ success: false, error: 'Failed to delete applicant' });
      }
    } else {
      res.status(404).json({ success: false, error: 'Applicant not found' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/upload-resume', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }
    
    const filePath = `applications/${req.file.filename}`;
    res.json({ 
      success: true, 
      filePath: filePath,
      fileName: req.file.filename,
      originalName: req.file.originalname
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/applicants/:id/comments', (req, res) => {
  try {
    const applicants = readApplicants();
    const applicantId = parseInt(req.params.id);
    const index = applicants.findIndex(a => a.id === applicantId);
    
    if (index !== -1) {
      if (!applicants[index].comments) {
        applicants[index].comments = [];
      }
      
      // Remove any existing comment from the same person
      applicants[index].comments = applicants[index].comments.filter(
        comment => comment.person !== req.body.person
      );
      
      // Add the new comment
      applicants[index].comments.push(req.body);
      
      if (writeApplicants(applicants)) {
        res.json({ success: true, comment: req.body });
      } else {
        res.status(500).json({ success: false, error: 'Failed to add comment' });
      }
    } else {
      res.status(404).json({ success: false, error: 'Applicant not found' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/clear-all', (req, res) => {
  try {
    const applicants = readApplicants();
    
    applicants.forEach(applicant => {
      if (applicant.resumePath) {
        const resumeFilePath = path.join(__dirname, 'public', applicant.resumePath);
        if (fs.existsSync(resumeFilePath)) {
          fs.unlinkSync(resumeFilePath);
        }
      }
    });
    
    if (writeApplicants([])) {
      res.json({ success: true });
    } else {
      res.status(500).json({ success: false, error: 'Failed to clear applicants' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});