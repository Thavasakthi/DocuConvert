import React, { useState, useRef, useEffect } from 'react';
import './App.css';

// API base URL - uses relative URL when Vite proxy is active, falls back to direct port 5000
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * Format bytes into human-readable size string (KB / MB)
 */
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default function App() {
  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [conversionStatus, setConversionStatus] = useState('idle'); // 'idle' | 'uploading' | 'converting' | 'success' | 'error'
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [convertedPdfUrl, setConvertedPdfUrl] = useState(null);
  const [convertedPdfName, setConvertedPdfName] = useState('');
  const [serverHealth, setServerHealth] = useState({ online: false, libreOffice: false, version: '' });

  const fileInputRef = useRef(null);

  // Check backend server & LibreOffice health on initial render
  useEffect(() => {
    checkServerHealth();
  }, []);

  const checkServerHealth = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/health`, { method: 'GET' });
      if (response.ok) {
        const data = await response.json();
        setServerHealth({
          online: true,
          libreOffice: data.libreOffice?.available || false,
          version: data.libreOffice?.version || 'Detected'
        });
      } else {
        setServerHealth({ online: false, libreOffice: false, version: '' });
      }
    } catch {
      // Backend not running yet or unreachable
      setServerHealth({ online: false, libreOffice: false, version: '' });
    }
  };

  /**
   * Validate and process selected file
   */
  const processSelectedFile = (selectedFile) => {
    if (!selectedFile) return;

    // Reset previous conversion and error states
    setErrorMessage('');
    setConversionStatus('idle');
    if (convertedPdfUrl) {
      window.URL.revokeObjectURL(convertedPdfUrl);
      setConvertedPdfUrl(null);
    }

    // Validate file extension
    const fileName = selectedFile.name.toLowerCase();
    const isDocx = fileName.endsWith('.docx');
    const isDoc = fileName.endsWith('.doc');

    if (!isDocx && !isDoc) {
      setErrorMessage('Unsupported file format. Please upload a Microsoft Word document (.docx or .doc).');
      return;
    }

    // Validate file size (10 MB maximum)
    if (selectedFile.size > MAX_FILE_SIZE_BYTES) {
      setErrorMessage(`File is too large (${formatFileSize(selectedFile.size)}). Maximum allowed size is 10 MB.`);
      return;
    }

    setFile(selectedFile);
  };

  /**
   * File input change handler
   */
  const handleFileInputChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      processSelectedFile(selectedFile);
    }
  };

  /**
   * Drag and drop event handlers
   */
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processSelectedFile(e.dataTransfer.files[0]);
    }
  };

  /**
   * Remove current file selection
   */
  const handleRemoveFile = () => {
    setFile(null);
    setConversionStatus('idle');
    setErrorMessage('');
    setStatusMessage('');
    if (convertedPdfUrl) {
      window.URL.revokeObjectURL(convertedPdfUrl);
      setConvertedPdfUrl(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  /**
   * Send file to backend for LibreOffice conversion
   */
  const handleConvert = async () => {
    if (!file) return;

    setConversionStatus('converting');
    setStatusMessage('Uploading and converting document with LibreOffice engine...');
    setErrorMessage('');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${API_BASE_URL}/api/convert`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        // Attempt to parse JSON error message from server
        let errorDetail = 'Conversion failed.';
        try {
          const errorJson = await response.json();
          errorDetail = errorJson.error || errorJson.details || errorDetail;
        } catch {
          errorDetail = `Server returned HTTP ${response.status}: ${response.statusText}`;
        }
        throw new Error(errorDetail);
      }

      // Read binary PDF blob
      const pdfBlob = await response.blob();
      const blobUrl = window.URL.createObjectURL(pdfBlob);

      // Determine downloaded PDF filename
      const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
      const pdfFileName = `${baseName}.pdf`;

      setConvertedPdfUrl(blobUrl);
      setConvertedPdfName(pdfFileName);
      setConversionStatus('success');
      setStatusMessage('Conversion completed successfully! Your download has started.');

      // Automatically trigger browser download
      triggerDownload(blobUrl, pdfFileName);
    } catch (err) {
      console.error('Conversion request error:', err);
      setConversionStatus('error');
      setErrorMessage(err.message || 'An unexpected error occurred during conversion.');
    }
  };

  /**
   * Helper function to trigger browser file download
   */
  const triggerDownload = (url, filename) => {
    const downloadLink = document.createElement('a');
    downloadLink.href = url;
    downloadLink.download = filename;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  };

  return (
    <div className="app-container">
      {/* Top Navigation Bar */}
      <header className="app-header">
        <div className="header-content">
          <div className="logo-wrapper">
            <div className="logo-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
              </svg>
            </div>
            <span className="brand-name">DocuConvert</span>
          </div>

          <div className="header-badges">
            <span className={`status-pill ${serverHealth.online ? 'online' : 'offline'}`} title="Backend service status">
              <span className="status-dot"></span>
              {serverHealth.online
                ? (serverHealth.libreOffice ? 'LibreOffice Ready' : 'Server Online (No LibreOffice)')
                : 'Server Offline'}
            </span>
            <span className="badge-pill">v1.0</span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="main-content">
        <div className="hero-section">
          <h1 className="hero-title">Word to PDF Converter</h1>
          <p className="hero-subtitle">
            Convert Microsoft Word documents (<span className="format-highlight">.docx</span>) into professional, high-fidelity PDFs with formatting, tables, and images preserved.
          </p>
        </div>

        {/* Converter Card */}
        <div className="converter-card">
          {/* File Upload Zone (shown when no file is selected) */}
          {!file && (
            <div
              className={`dropzone ${isDragging ? 'dropzone-active' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  fileInputRef.current?.click();
                }
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".docx,.doc,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword"
                onChange={handleFileInputChange}
                className="hidden-file-input"
              />

              <div className="dropzone-icon-circle">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="17 8 12 3 7 8"></polyline>
                  <line x1="12" y1="3" x2="12" y2="15"></line>
                </svg>
              </div>

              <div className="dropzone-text">
                <span className="dropzone-title">
                  <strong>Click to upload</strong> or drag and drop
                </span>
                <span className="dropzone-hint">
                  Supports Microsoft Word (.docx, .doc) up to 10 MB
                </span>
              </div>

              <div className="dropzone-browse-button">
                Browse Files
              </div>
            </div>
          )}

          {/* Selected File Card (shown when a file is selected) */}
          {file && (
            <div className="file-preview-card">
              <div className="file-info-group">
                <div className="doc-type-icon">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                    <line x1="10" y1="9" x2="8" y2="9"></line>
                  </svg>
                </div>
                <div className="file-details">
                  <div className="file-name" title={file.name}>{file.name}</div>
                  <div className="file-meta">
                    <span className="file-size">{formatFileSize(file.size)}</span>
                    <span className="meta-separator">•</span>
                    <span className="ready-badge">Ready to convert</span>
                  </div>
                </div>
              </div>

              {conversionStatus !== 'converting' && (
                <button
                  type="button"
                  className="remove-file-button"
                  onClick={handleRemoveFile}
                  title="Remove this document and choose another"
                  aria-label="Remove document"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                  <span>Remove</span>
                </button>
              )}
            </div>
          )}

          {/* Error Message Alert */}
          {errorMessage && (
            <div className="alert alert-error" role="alert">
              <div className="alert-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
              </div>
              <div className="alert-content">
                <strong>Conversion Error:</strong>
                <p>{errorMessage}</p>
              </div>
              <button
                type="button"
                className="alert-close-btn"
                onClick={() => setErrorMessage('')}
                aria-label="Dismiss error"
              >
                ✕
              </button>
            </div>
          )}

          {/* Loading Indicator State */}
          {conversionStatus === 'converting' && (
            <div className="converting-indicator">
              <div className="spinner-container">
                <div className="spinner"></div>
              </div>
              <div className="converting-text">
                <h3>Converting Document...</h3>
                <p>{statusMessage}</p>
                <div className="progress-bar-indeterminate">
                  <div className="progress-bar-fill"></div>
                </div>
              </div>
            </div>
          )}

          {/* Success Result State */}
          {conversionStatus === 'success' && (
            <div className="alert alert-success" role="status">
              <div className="alert-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                  <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
              </div>
              <div className="alert-content">
                <strong>Conversion Successful!</strong>
                <p>{statusMessage}</p>
                <div className="success-actions">
                  <button
                    type="button"
                    className="btn btn-secondary-download"
                    onClick={() => triggerDownload(convertedPdfUrl, convertedPdfName)}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                      <polyline points="7 10 12 15 17 10"></polyline>
                      <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                    Download Again ({convertedPdfName})
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={handleRemoveFile}
                  >
                    Convert Another Document
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Primary Action Button */}
          {file && conversionStatus !== 'converting' && conversionStatus !== 'success' && (
            <div className="action-button-wrapper">
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleConvert}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <path d="M12 18v-6"></path>
                  <path d="M9 15l3 3 3-3"></path>
                </svg>
                <span>Convert to PDF</span>
              </button>
            </div>
          )}
        </div>

        {/* Feature Highlights Grid */}
        <section className="features-grid">
          <div className="feature-card">
            <div className="feature-icon-wrapper">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="3" y1="9" x2="21" y2="9"></line>
                <line x1="9" y1="21" x2="9" y2="9"></line>
              </svg>
            </div>
            <h3>High Fidelity Output</h3>
            <p>Preserves complex layouts, custom fonts, embedded tables, and image resolutions accurately using the LibreOffice engine.</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon-wrapper">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
              </svg>
            </div>
            <h3>Secure &amp; Private</h3>
            <p>Files are converted in isolated temporary directories and automatically deleted immediately after conversion completes.</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon-wrapper">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
            </div>
            <h3>Instant &amp; Automated</h3>
            <p>Fast headless conversion pipeline with automatic browser download trigger and zero third-party cloud subscription fees.</p>
          </div>
        </section>
      </main>

      {/* Application Footer */}
      <footer className="app-footer">
        <div className="footer-content">
          <p className="footer-copyright">
            © {new Date().getFullYear()} <strong>DocuConvert</strong> • Built with React, Vite, Express, and LibreOffice Headless.
          </p>
          <div className="footer-links">
            <span className="footer-tag">10 MB Limit</span>
            <span className="footer-divider">•</span>
            <span className="footer-tag">Cross-Platform</span>
            <span className="footer-divider">•</span>
            <span className="footer-tag">REST API Ready</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
