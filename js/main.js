// DOM Elements
const textInput = document.getElementById('textInput');
const fileInput = document.getElementById('fileInput');
const analyzeBtn = document.getElementById('analyzeBtn');
const btnText = document.querySelector('.btn-text');
const loader = document.querySelector('.loader');
const resultsSection = document.getElementById('results');
const highlightedText = document.getElementById('highlightedText');
const downloadBtn = document.getElementById('downloadBtn');
const themeToggle = document.getElementById('themeToggle');
const getStartedBtn = document.getElementById('getStartedBtn');
const landingPage = document.getElementById('landingPage');
const analysisPage = document.getElementById('analysisPage');
const fileInfo = document.getElementById('fileInfo');
const fileName = document.getElementById('fileName');
const removeFile = document.getElementById('removeFile');
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');
const fileUploadContainer = document.querySelector('.file-upload-container');
const filePreview = document.getElementById('filePreview');
const previewText = document.getElementById('previewText');
const editText = document.getElementById('editText');
const revertText = document.getElementById('revertText');

// Constants
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
let originalText = '';

// Entity patterns
const entityPatterns = {
    PERSON: {
        pattern: /\b[A-Z][a-z]+(?:\s+(?:van|de|der|den|von|le|la|dos?|das|del))?\s+[A-Z][a-z]+\b/g,
        color: '#4a90e2' // Blue
    },
    ORGANIZATION: {
        pattern: /\b(?:[A-Z][a-z]*\s+)*(?:Inc\.|Ltd\.|Corp\.|Corporation|Company|Bank|University|Institute|Group|Technologies|Systems)\b|\b(?:Microsoft|Apple|Google|Amazon|Facebook|Tesla|IBM)\b/g,
        color: '#2ecc71' // Green
    },
    LOCATION: {
        pattern: /\b(?:(?:North|South|East|West|New)\s+)?[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*(?:\s+(?:City|State|County|Country|Island|Mountain|Ocean|Sea|Gulf|River|Lake|Desert|Forest|Street|Road|Avenue|Boulevard|Park))?\b|\b(?:USA|UK|EU|UAE|US|NY|LA|SF|DC)\b/g,
        color: '#e74c3c' // Red
    },
    DATE: {
        pattern: /\b(?:\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2}|(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4})\b/gi,
        color: '#f39c12' // Orange
    }
};

// Event Listeners
fileInput.addEventListener('change', handleFileSelect);
removeFile.addEventListener('click', removeSelectedFile);
editText.addEventListener('click', toggleEditMode);
revertText.addEventListener('click', revertChanges);

// File drag and drop
fileUploadContainer.addEventListener('dragover', (e) => {
    e.preventDefault();
    fileUploadContainer.classList.add('drag-over');
});

fileUploadContainer.addEventListener('dragleave', () => {
    fileUploadContainer.classList.remove('drag-over');
});

fileUploadContainer.addEventListener('drop', (e) => {
    e.preventDefault();
    fileUploadContainer.classList.remove('drag-over');
    handleFileUpload(e.dataTransfer.files[0]);
});

// 1️⃣ Input Handling
async function handleFileUpload(file) {
    if (!file) return;

    // Validate file type
    if (!file.type.match('text/plain|application/pdf')) {
        alert('Please upload only .txt or .pdf files');
        return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
        alert('File size must be less than 5MB');
        return;
    }

    fileInput.files = new DataTransfer().files;
    await processFile(file);
}

async function handleFileSelect(event) {
    await handleFileUpload(event.target.files[0]);
}

// 2️⃣ Text Extraction from File
async function processFile(file) {
    // Show loading state
    document.querySelector('.upload-progress-ring').classList.remove('hidden');
    
    try {
        // Update file info
        const fileIcon = file.type === 'application/pdf' ? '📄' : '📝';
        fileName.textContent = file.name;
        document.querySelector('.file-icon').textContent = fileIcon;
        document.querySelector('.file-size').textContent = formatFileSize(file.size);
        fileInfo.classList.remove('hidden');

        // Extract text
        const text = await extractTextFromFile(file);
        originalText = text;
        previewText.value = text;
        filePreview.classList.remove('hidden');
        
    } catch (error) {
        alert('Error reading file: ' + error.message);
        removeSelectedFile();
    } finally {
        document.querySelector('.upload-progress-ring').classList.add('hidden');
    }
}

async function extractTextFromFile(file) {
    if (file.type === 'text/plain') {
        return await file.text();
    } else if (file.type === 'application/pdf') {
        // Load PDF.js if needed
        if (!window.pdfjsLib) {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
            document.head.appendChild(script);
            await new Promise(resolve => script.onload = resolve);
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        }

        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let text = '';
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            text += content.items.map(item => item.str).join(' ') + '\n';
        }
        return text;
    }
    throw new Error('Unsupported file type');
}

// 3️⃣ Preprocessing the Text
function preprocessText(text) {
    return text
        .replace(/\s+/g, ' ') // Remove extra spaces and newlines
        .replace(/[^\w\s.,]/g, '') // Remove special characters except periods and commas
        .trim();
}

// 4️⃣ & 5️⃣ Named Entity Recognition and Post-Processing
function findEntities(text) {
    const entities = [];
    const processedRanges = new Set();

    // Process each entity type
    for (const [type, config] of Object.entries(entityPatterns)) {
        const matches = [...text.matchAll(config.pattern)];
        
        for (const match of matches) {
            const start = match.index;
            const end = start + match[0].length;
            const matchText = match[0];

            // Check for overlaps with existing entities
            const overlaps = Array.from(processedRanges).some(range => {
                const [rangeStart, rangeEnd] = range.split('-').map(Number);
                return (start >= rangeStart && start < rangeEnd) || 
                       (end > rangeStart && end <= rangeEnd);
            });

            if (!overlaps && validateEntity(type, matchText)) {
                entities.push({
                    text: matchText,
                    type: type,
                    start: start,
                    end: end,
                    color: config.color
                });
                processedRanges.add(`${start}-${end}`);
            }
        }
    }

    return entities.sort((a, b) => a.start - b.start);
}

function validateEntity(type, text) {
    // Filter out common false positives
    const commonWords = new Set(['The', 'A', 'An', 'This', 'That', 'It', 'If', 'In', 'On', 'At', 'To', 'For']);
    
    if (commonWords.has(text)) return false;
    
    switch (type) {
        case 'PERSON':
            return text.split(/\s+/).length >= 2; // Must be at least two words
        case 'ORGANIZATION':
            return text.length > 2; // Must be longer than 2 characters
        case 'LOCATION':
            return !text.match(/^(North|South|East|West)$/); // Exclude standalone directions
        case 'DATE':
            return true; // Already validated by regex
    }
    return false;
}

// 6️⃣ Display Results
function highlightEntities(text, entities) {
    let result = text;
    let offset = 0;

    for (const entity of entities) {
        const start = entity.start + offset;
        const end = entity.end + offset;
        const highlightedText = `<span class="entity" style="background-color: ${entity.color}80; border-bottom: 2px solid ${entity.color}" title="${entity.type}">${result.slice(start, end)}</span>`;
        
        result = result.slice(0, start) + highlightedText + result.slice(end);
        offset += highlightedText.length - (end - start);
    }

    return result;
}

// Utility Functions
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function removeSelectedFile() {
    fileInput.value = '';
    fileInfo.classList.add('hidden');
    filePreview.classList.add('hidden');
    previewText.value = '';
    originalText = '';
    previewText.setAttribute('readonly', '');
    editText.classList.remove('hidden');
    revertText.classList.add('hidden');
}

function toggleEditMode() {
    if (previewText.hasAttribute('readonly')) {
        previewText.removeAttribute('readonly');
        editText.classList.add('hidden');
        revertText.classList.remove('hidden');
        previewText.focus();
    }
}

function revertChanges() {
    previewText.value = originalText;
    previewText.setAttribute('readonly', '');
    editText.classList.remove('hidden');
    revertText.classList.add('hidden');
}

// Handle text analysis
analyzeBtn.addEventListener('click', async () => {
    let text;
    const activeTab = document.querySelector('.tab-btn.active').dataset.tab;
    
    if (activeTab === 'text') {
        text = textInput.value.trim();
    } else {
        text = previewText.value.trim();
    }
    
    if (!text) {
        alert('Please enter or upload some text to analyze');
        return;
    }
    
    // Show loading state
    btnText.textContent = 'Analyzing...';
    loader.classList.remove('hidden');
    analyzeBtn.disabled = true;
    
    try {
        // Preprocess text
        const processedText = preprocessText(text);
        
        // Find entities
        const entities = findEntities(processedText);
        
        // Highlight and display results
        const highlightedContent = highlightEntities(text, entities);
        highlightedText.innerHTML = highlightedContent;
        resultsSection.classList.remove('hidden');
    } catch (error) {
        alert('Error analyzing text. Please try again.');
        console.error('Analysis error:', error);
    } finally {
        // Reset button state
        btnText.textContent = 'Analyze Text';
        loader.classList.add('hidden');
        analyzeBtn.disabled = false;
    }
});

// Download results
downloadBtn.addEventListener('click', () => {
    const text = highlightedText.textContent;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'analyzed_text.txt';
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
    document.body.removeChild(a);
});

// Theme toggle
themeToggle.addEventListener('click', () => {
    const currentTheme = document.body.classList.contains('dark-theme') ? 'dark' : 'light';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.body.classList.toggle('dark-theme');
    localStorage.setItem('theme', newTheme);
});

// Page navigation
getStartedBtn.addEventListener('click', () => {
    landingPage.style.opacity = '0';
    setTimeout(() => {
        landingPage.classList.add('hidden');
        analysisPage.classList.remove('hidden');
        analysisPage.style.opacity = '1';
    }, 500);
});

// Tab switching
tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));
        
        btn.classList.add('active');
        document.getElementById(btn.dataset.tab + 'Tab').classList.add('active');
    });
});

// Initialize theme
const theme = localStorage.getItem('theme') || 'light';
if (theme === 'dark') {
    document.body.classList.add('dark-theme');
}
