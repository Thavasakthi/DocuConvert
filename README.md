# DocuConvert - Professional Word to PDF Converter

DocuConvert is a full-stack web application designed for converting Microsoft Word documents (`.docx`, `.doc`) into PDF files with high fidelity. The system leverages **React.js** and **Vite** on the frontend, an **Express.js** REST API backend, and **LibreOffice in headless mode** as the core document conversion engine.

Unlike naive converters that simply rename or manipulate text files, DocuConvert performs real document rendering, preserving intricate layouts, tables, embedded images, typography, and page formatting.

---

## Architecture Overview

```text
+-------------------------------------------------------+
|                   React.js Frontend                   |
|  - Drag & Drop UI (10 MB Limit & Type Validation)     |
|  - Real-Time Backend & Engine Health Monitoring       |
|  - Automated Download Trigger via Blob URLs           |
+---------------------------+---------------------------+
                            |
           HTTP POST (multipart/form-data)
                            v
+-------------------------------------------------------+
|                  Express.js Backend                   |
|  - Multer Ingestion with 10 MB File Limit Guard       |
|  - Isolated Job Workspace Creation (UUID)             |
|  - Cross-Platform LibreOffice Binary Locator          |
+---------------------------+---------------------------+
                            |
       child_process.execFile (soffice --headless)
                            v
+-------------------------------------------------------+
|             LibreOffice Headless Engine               |
|  - Full-fidelity Word-to-PDF Document Rendering       |
|  - Layout, Fonts, Vector Graphics & Table Retention   |
+---------------------------+---------------------------+
                            |
           Generated PDF binary stream piped back
                            v
+-------------------------------------------------------+
|             Automated Cleanup & Response              |
|  - Response headers: application/pdf                  |
|  - Temporary files & job directory deleted safely     |
+-------------------------------------------------------+
```

---

## Key Features

1. **True High-Fidelity Document Rendering**: Uses the LibreOffice rendering engine to convert `.docx` files to `.pdf`, ensuring tables, multi-column layouts, headers/footers, and embedded graphics remain intact.
2. **Modern Purple-Accented UI**: Built with responsive vanilla CSS, featuring glassmorphism, micro-animations, accessible buttons, and a clean light theme.
3. **Drag-and-Drop File Ingestion**: Intuitive upload zone with drag-over indicators, file type checks, and formatted size indicators.
4. **Strict Security & Size Validation**: Client-side and server-side validation enforcing a strict **10 MB limit** and Word file extension restrictions (`.docx`, `.doc`).
5. **Zero Data Retention / Privacy First**: Every conversion runs in an isolated directory generated via `crypto.randomUUID()`. Both input and output files are deleted immediately after the response finishes or if an error occurs.
6. **Automated & Instant Download**: Converted PDF files automatically trigger browser downloads preserving the original document name (e.g., `Report.docx` $\rightarrow$ `Report.pdf`).
7. **Engine Health Check**: Features a dedicated `GET /api/health` endpoint that checks the availability and exact version of LibreOffice on server launch.

---

## Project Structure

```text
word-to-pdf-converter/
├── client/                     # Frontend Application
│   ├── index.html              # HTML5 entry with Google Fonts
│   ├── package.json            # React & Vite configuration
│   ├── vite.config.js          # Vite config with dev proxy to :5000
│   └── src/
│       ├── App.jsx             # Main React application logic
│       ├── App.css             # Design system & responsive styles
│       └── main.jsx            # React root DOM mount point
├── server/                     # Backend Application
│   ├── package.json            # Node.js ES Module server configuration
│   └── server.js               # Express API, Multer upload & LibreOffice exec
├── sample-documents/           # Sample files for immediate testing
│   └── Sample_Report.docx      # Ready-to-test Word document
├── .gitignore                  # Git exclusions for node_modules and temp files
└── README.md                   # Comprehensive documentation
```

---

## Prerequisites & Installation

### 1. Install Node.js
Ensure Node.js (version 18 or later) is installed on your computer.
- Download from [nodejs.org](https://nodejs.org/).
- Verify installation:
  ```bash
  node -v
  npm -v
  ```

### 2. Install LibreOffice
LibreOffice is the engine that executes the headless conversion.

- **Windows**:
  - Download and install the LibreOffice installer from [libreoffice.org/download](https://www.libreoffice.org/download/download-libreoffice/).
  - Default installation path is `C:\Program Files\LibreOffice\program\soffice.com`.
  - The backend server auto-detects this default path.
- **macOS**:
  ```bash
  brew install --cask libreoffice
  ```
- **Ubuntu / Debian**:
  ```bash
  sudo apt update
  sudo apt install -y libreoffice
  ```
- **Red Hat / CentOS / Fedora**:
  ```bash
  sudo dnf install libreoffice
  ```

---

## Quick Start Guide

### Step 1: Install Backend Dependencies
Open a terminal in the project directory:
```bash
cd server
npm install
```

### Step 2: Install Frontend Dependencies
Open a second terminal window:
```bash
cd client
npm install
```

### Step 3: Run the Backend Server
In the `server` terminal:
```bash
npm start
```
*The server will start at `http://localhost:5000` and automatically verify your LibreOffice path.*

### Step 4: Run the Frontend Development Server
In the `client` terminal:
```bash
npm run dev
```
*The React application will open at `http://localhost:5173`.*

---

## API Specification

### 1. Health Check
- **Endpoint**: `GET /api/health`
- **Response**:
```json
{
  "status": "UP",
  "timestamp": "2026-10-10T03:38:38.897Z",
  "libreOffice": {
    "configuredPath": "C:\\Program Files\\LibreOffice\\program\\soffice.com",
    "available": true,
    "version": "LibreOffice 26.2.2.2",
    "error": null
  }
}
```

### 2. Document Conversion
- **Endpoint**: `POST /api/convert`
- **Content-Type**: `multipart/form-data`
- **Body Field**: `file` (File binary, `.docx` or `.doc`, $\le$ 10 MB)
- **Successful Response (200 OK)**:
  - `Content-Type`: `application/pdf`
  - `Content-Disposition`: `attachment; filename="filename.pdf"`
  - Response Body: Binary PDF stream
- **Error Response (400 / 500)**:
```json
{
  "success": false,
  "error": "File size exceeds 10 MB limit. Please upload a smaller document."
}
```

---

## Testing the Application

### Method A: Browser UI
1. Navigate to `http://localhost:5173`.
2. Notice the green **"LibreOffice Ready"** badge in the top right.
3. Drag and drop any `.docx` file (or use `sample-documents/Sample_Report.docx`).
4. Click **Convert to PDF**.
5. The PDF will convert in 1-3 seconds and trigger an automatic download.

### Method B: Command Line (cURL)
You can test the conversion API directly from your terminal:
```bash
curl -X POST -F "file=@sample-documents/Sample_Report.docx" http://localhost:5000/api/convert --output output.pdf
```

---

## Troubleshooting Guide

| Issue | Cause | Solution |
| :--- | :--- | :--- |
| **"Server Offline"** in header | Backend server is not running on port 5000. | Run `npm start` inside the `server/` directory. |
| **"LibreOffice not detected"** | LibreOffice is not installed in the default directory or in system PATH. | Set `LIBREOFFICE_PATH` in environment variables or install LibreOffice. |
| **"File size exceeds 10 MB limit"** | Document exceeds the 10 MB limit. | Compress images inside the Word document before uploading. |
| **Windows process freeze with soffice.exe** | On Windows, calling `soffice.exe` without console wrapper can detach without notifying. | The server uses `soffice.com` (console wrapper) which attaches to stdout and waits for process completion. |
| **Port 5000 already in use** | Another service is using port 5000. | Set `PORT=5001` in `server/.env` and adjust the API URL or proxy. |

---

## Production Deployment

### Frontend Deployment (Netlify)
1. In your Netlify dashboard, connect your GitHub repository `Thavasakthi/DocuConvert`.
2. Netlify automatically detects the provided `netlify.toml` file:
   - **Base directory**: `client`
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
3. Add the `VITE_API_URL` environment variable pointing to your backend server URL.

### Backend Deployment (Linux VPS / Cloud Server)
Deploy the Node.js backend to any Linux server (e.g. AWS EC2, DigitalOcean Droplet, Linode, Ubuntu/Debian VPS) where LibreOffice can be installed natively:

1. Install Node.js, LibreOffice, and PM2 on the server:
   ```bash
   sudo apt update
   sudo apt install -y libreoffice libreoffice-writer fonts-dejavu fonts-liberation
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt install -y nodejs
   sudo npm install -g pm2
   ```

2. Clone repository & install backend dependencies:
   ```bash
   git clone https://github.com/Thavasakthi/DocuConvert.git
   cd DocuConvert/server
   npm install --production
   ```

3. Start backend service with PM2:
   ```bash
   pm2 start server.js --name "docuconvert"
   pm2 save
   pm2 startup
   ```

---

## Computer Science Portfolio Highlights

- **Concurreny & Isolation**: Employs UUID-partitioned isolated temporary folders to prevent concurrent conversion jobs from colliding.
- **Resource Cleanup Guarantee**: Implements strict `res.on('finish')` and `res.on('close')` event listeners coupled with `finally` guards to prevent disk leaks.
- **Fault-Tolerant Child Process Execution**: Uses Node.js `child_process.execFile` with defined timeouts (60s) to prevent zombie processes.
- **Responsive Accessible Frontend**: Semantic HTML5, ARIA roles, modern CSS custom properties, and keyboard-accessible dropzone interactions.
