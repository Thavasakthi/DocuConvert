import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { promises as fsPromises } from 'fs';
import os from 'os';
import crypto from 'crypto';
import { execFile } from 'child_process';
import { fileURLToPath } from 'url';

// Environment & Directory setup
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 5000;

// Base temporary directory for conversion jobs
const BASE_TEMP_DIR = path.join(__dirname, 'temp_uploads');
if (!fs.existsSync(BASE_TEMP_DIR)) {
  fs.mkdirSync(BASE_TEMP_DIR, { recursive: true });
}

/**
 * Automatically locate the LibreOffice executable across Windows, macOS, and Linux.
 * Can be explicitly overridden with the LIBREOFFICE_PATH environment variable.
 */
function getLibreOfficeExecutable() {
  if (process.env.LIBREOFFICE_PATH && fs.existsSync(process.env.LIBREOFFICE_PATH)) {
    return process.env.LIBREOFFICE_PATH;
  }

  const platform = os.platform();

  if (platform === 'win32') {
    const windowsCandidates = [
      // soffice.com is preferred on Windows as the console wrapper for headless operations
      'C:\\Program Files\\LibreOffice\\program\\soffice.com',
      'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
      'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.com',
      'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe'
    ];

    for (const candidate of windowsCandidates) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
    // Fallback to command name if added to PATH
    return 'soffice.com';
  } else if (platform === 'darwin') {
    const macCandidates = [
      '/Applications/LibreOffice.app/Contents/MacOS/soffice',
      '/usr/local/bin/soffice',
      '/usr/local/bin/libreoffice'
    ];
    for (const candidate of macCandidates) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
    return 'soffice';
  } else {
    // Linux and other Unix systems
    const linuxCandidates = [
      '/usr/bin/libreoffice',
      '/usr/bin/soffice',
      '/usr/local/bin/libreoffice',
      '/usr/local/bin/soffice'
    ];
    for (const candidate of linuxCandidates) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
    return 'soffice';
  }
}

const libreOfficePath = getLibreOfficeExecutable();
console.log(`[INFO] LibreOffice executable detected: ${libreOfficePath}`);

// Initialize Express App
const app = express();

// Security and CORS configuration
app.use(cors({
  origin: '*', // Can be restricted to specific origin like 'http://localhost:5173'
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
  exposedHeaders: ['Content-Disposition']
}));

// Express built-in middleware for JSON
app.use(express.json());

// Set up Multer for handling file uploads (stored in memory or unique temporary job folder)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Create an isolated directory for each conversion job
    const jobId = crypto.randomUUID();
    const jobDir = path.join(BASE_TEMP_DIR, `job-${jobId}`);
    fs.mkdirSync(jobDir, { recursive: true });
    req.jobDir = jobDir;
    req.jobId = jobId;
    cb(null, jobDir);
  },
  filename: (req, file, cb) => {
    // Preserve sanitized original filename or clean safe name
    const ext = path.extname(file.originalname).toLowerCase();
    const safeName = `document${ext}`;
    cb(null, safeName);
  }
});

// File filter: only allow .docx and .doc files
const fileFilter = (req, file, cb) => {
  const allowedExtensions = ['.docx', '.doc'];
  const ext = path.extname(file.originalname).toLowerCase();

  const allowedMimeTypes = [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'application/octet-stream' // Some browsers send octet-stream for docx
  ];

  if (!allowedExtensions.includes(ext)) {
    return cb(new Error('Invalid file type. Only Word documents (.docx, .doc) are supported.'), false);
  }

  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10 MB maximum upload limit
  }
});

/**
 * Helper to safely delete a job directory and its contents
 */
async function cleanJobDirectory(jobDir) {
  if (jobDir && fs.existsSync(jobDir)) {
    try {
      await fsPromises.rm(jobDir, { recursive: true, force: true });
      // console.log(`[CLEANUP] Deleted temporary directory: ${jobDir}`);
    } catch (err) {
      console.error(`[WARN] Cleanup failed for ${jobDir}:`, err.message);
    }
  }
}

/**
 * Health check endpoint
 * Validates backend is operational and verifies LibreOffice binary availability
 */
app.get('/api/health', (req, res) => {
  execFile(libreOfficePath, ['--version'], { timeout: 5000 }, (err, stdout, stderr) => {
    const isAvailable = !err;
    const versionOutput = stdout ? stdout.trim() : (stderr ? stderr.trim() : 'Unknown');

    res.json({
      status: 'UP',
      timestamp: new Date().toISOString(),
      libreOffice: {
        configuredPath: libreOfficePath,
        available: isAvailable,
        version: isAvailable ? versionOutput : null,
        error: err ? err.message : null
      }
    });
  });
});

/**
 * Main Conversion Endpoint
 * POST /api/convert
 * Expects multipart/form-data with field name 'file'
 */
app.post('/api/convert', (req, res) => {
  upload.single('file')(req, res, async (uploadErr) => {
    // Handle Multer upload errors (size limit, file filter, etc.)
    if (uploadErr) {
      if (req.jobDir) {
        await cleanJobDirectory(req.jobDir);
      }
      if (uploadErr.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          error: 'File size exceeds 10 MB limit. Please upload a smaller document.'
        });
      }
      return res.status(400).json({
        success: false,
        error: uploadErr.message || 'File upload error.'
      });
    }

    // Check if file was provided
    if (!req.file) {
      if (req.jobDir) {
        await cleanJobDirectory(req.jobDir);
      }
      return res.status(400).json({
        success: false,
        error: 'No file uploaded. Please select a Word document (.docx).'
      });
    }

    const { jobDir, jobId } = req;
    const uploadedFilePath = req.file.path;
    const originalName = req.file.originalname;
    const parsedOriginal = path.parse(originalName);
    const outputPdfName = `${parsedOriginal.name}.pdf`;

    console.log(`[JOB ${jobId}] Starting conversion for: "${originalName}" (${(req.file.size / 1024).toFixed(1)} KB)`);

    // Prepare arguments for LibreOffice headless conversion
    // --headless: runs without GUI
    // --convert-to pdf: target conversion format
    // --outdir: directory to write the converted PDF
    const libreOfficeArgs = [
      '--headless',
      '--convert-to',
      'pdf',
      '--outdir',
      jobDir,
      uploadedFilePath
    ];

    // Conversion timeout set to 60 seconds
    const CONVERSION_TIMEOUT = 60000;

    execFile(libreOfficePath, libreOfficeArgs, { timeout: CONVERSION_TIMEOUT }, async (execErr, stdout, stderr) => {
      if (execErr) {
        console.error(`[JOB ${jobId}] Conversion error:`, execErr);
        await cleanJobDirectory(jobDir);

        if (execErr.killed || execErr.signal === 'SIGTERM') {
          return res.status(504).json({
            success: false,
            error: 'Conversion timed out. The document might be too complex or corrupted.'
          });
        }

        return res.status(500).json({
          success: false,
          error: 'Failed to convert document with LibreOffice. Please ensure the document is valid.',
          details: execErr.message
        });
      }

      // Expected output PDF filename generated by LibreOffice is based on input filename
      const uploadedBasename = path.parse(req.file.filename).name;
      const generatedPdfPath = path.join(jobDir, `${uploadedBasename}.pdf`);

      // Verify that the PDF actually exists and is non-empty
      if (!fs.existsSync(generatedPdfPath)) {
        console.error(`[JOB ${jobId}] Converted PDF was not found at ${generatedPdfPath}`);
        await cleanJobDirectory(jobDir);
        return res.status(500).json({
          success: false,
          error: 'Conversion completed but output PDF was not generated. Please check document contents.'
        });
      }

      try {
        const stats = await fsPromises.stat(generatedPdfPath);
        console.log(`[JOB ${jobId}] Converted successfully! PDF size: ${(stats.size / 1024).toFixed(1)} KB`);

        // Encode filename safely for Content-Disposition header
        const encodedFilename = encodeURIComponent(outputPdfName);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Length', stats.size);
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="${outputPdfName}"; filename*=UTF-8''${encodedFilename}`
        );

        const readStream = fs.createReadStream(generatedPdfPath);

        // Ensure temp directory is always deleted once transmission completes or aborts
        let cleaned = false;
        const cleanupOnce = async () => {
          if (!cleaned) {
            cleaned = true;
            await cleanJobDirectory(jobDir);
          }
        };

        readStream.on('error', async (streamErr) => {
          console.error(`[JOB ${jobId}] Stream read error:`, streamErr);
          await cleanupOnce();
          if (!res.headersSent) {
            res.status(500).json({ success: false, error: 'Error streaming converted PDF.' });
          }
        });

        res.on('finish', cleanupOnce);
        res.on('close', cleanupOnce);

        readStream.pipe(res);
      } catch (streamPrepErr) {
        console.error(`[JOB ${jobId}] Error preparing response:`, streamPrepErr);
        await cleanJobDirectory(jobDir);
        return res.status(500).json({
          success: false,
          error: 'Internal server error while preparing the converted document.'
        });
      }
    });
  });
});

// Serve production static build of React client if present
const clientDistPath = path.join(__dirname, '../client/dist');
if (fs.existsSync(clientDistPath)) {
  console.log(`[INFO] Serving React frontend build from: ${clientDistPath}`);
  app.use(express.static(clientDistPath));

  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

// Global 404 handler for unknown API routes
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found.' });
});

// Start Express server
app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(` DocuConvert Backend Server`);
  console.log(` Running on: http://localhost:${PORT}`);
  console.log(` Health check: http://localhost:${PORT}/api/health`);
  console.log(` LibreOffice Path: ${libreOfficePath}`);
  console.log(` Max File Size: 10 MB`);
  console.log(`====================================================`);
});
