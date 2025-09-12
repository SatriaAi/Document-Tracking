/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// --- TYPES ---
type Division = 'HR' | 'Finance' | 'Engineering' | 'Marketing';
type Status = 'Approved' | 'Pending' | 'Rejected';
type ViewMode = 'grid' | 'list';

// Updated AppDocument to reflect data coming from a server API
interface AppDocument {
  id: number;
  name: string;
  division: Division;
  status: Status;
  fileName: string;
  fileUrl: string; // The backend will provide a URL to the file
}

// --- MOCK BACKEND API & PERSISTENCE ---
const DB_KEY = 'docTrackDb';
const mockFileStore = new Map<number, File>(); // In-memory store for uploaded file objects. THIS IS NOT PERSISTED.

// Default data for first-time load is now empty
const initialDatabase: AppDocument[] = [];

let mockDatabase: AppDocument[] = [];
let lastId = 0;

function loadDatabase() {
    try {
        const storedDb = localStorage.getItem(DB_KEY);
        if (storedDb) {
            mockDatabase = JSON.parse(storedDb);
        } else {
            mockDatabase = JSON.parse(JSON.stringify(initialDatabase)); // Deep copy for safety
            localStorage.setItem(DB_KEY, JSON.stringify(mockDatabase));
        }
        lastId = mockDatabase.reduce((max, doc) => Math.max(max, doc.id), 0);
    } catch (error) {
        console.error("Failed to load or parse database from localStorage:", error);
        mockDatabase = JSON.parse(JSON.stringify(initialDatabase));
    }
}

function saveDatabase() {
    try {
        localStorage.setItem(DB_KEY, JSON.stringify(mockDatabase));
    } catch (error) {
        console.error("Failed to save database to localStorage:", error);
    }
}


const MOCK_API_DELAY = 500; // Simulate network latency

function mockApiFetchDocuments(): Promise<{ ok: boolean; status: number; json: () => Promise<any> }> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(JSON.parse(JSON.stringify(mockDatabase))), // Return a deep copy
      });
    }, MOCK_API_DELAY);
  });
}

function mockApiCreateDocument(formData: FormData): Promise<{ ok: boolean; status: number; json: () => Promise<any> }> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const file = formData.get('file') as File;
      if (!file || file.size === 0) {
        return resolve({ ok: false, status: 400, json: () => Promise.resolve({ message: 'File is required and cannot be empty.' }) });
      }

      lastId++;
      const newDocument: AppDocument = {
        id: lastId,
        name: formData.get('name') as string,
        division: formData.get('division') as Division,
        status: formData.get('status') as Status,
        fileName: file.name,
        // Simulate a real Vercel Blob URL
        fileUrl: `https://cphjajpsplwz98pq.public.blob.vercel-storage.com/${encodeURIComponent(file.name)}`,
      };
      mockFileStore.set(lastId, file); // Store the actual file object in memory for the current session
      mockDatabase.push(newDocument);
      saveDatabase(); // Persist metadata to localStorage

      resolve({
        ok: true,
        status: 201,
        json: () => Promise.resolve(newDocument),
      });
    }, MOCK_API_DELAY);
  });
}

function mockApiDeleteDocument(docId: number): Promise<{ ok: boolean; status: number; json: () => Promise<any> }> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const index = mockDatabase.findIndex(doc => doc.id === docId);
      if (index !== -1) {
        mockDatabase.splice(index, 1);
        mockFileStore.delete(docId); // Clean up the in-memory file store
        saveDatabase(); // Persist the deletion
        resolve({
          ok: true,
          status: 204, // No Content
          json: () => Promise.resolve({}),
        });
      } else {
        resolve({
          ok: false,
          status: 404,
          json: () => Promise.resolve({ message: 'Document not found' }),
        });
      }
    }, MOCK_API_DELAY);
  });
}


// --- CONSTANTS & STATE ---
const divisions: Division[] = ['HR', 'Finance', 'Engineering', 'Marketing'];
const statuses: Status[] = ['Approved', 'Pending', 'Rejected'];

// App state
let documents: AppDocument[] = [];
let currentView: ViewMode = 'grid';
let filters = {
  division: 'all',
  status: 'all',
  search: ''
};
let showUploadModal = false;
let documentToDelete: AppDocument | null = null;
let isLoading = true;
let errorMessage: string | null = null;
let isSubmitting = false;

// --- DOM ELEMENTS ---
const root = document.getElementById('root')!;

// --- ICONS (as functions returning SVG strings) ---
const icons = {
  search: () => `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`,
  grid: () => `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>`,
  list: () => `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>`,
  file: () => `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>`,
  image: () => `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>`,
  pdf: () => `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2v4a2 2 0 0 0 2 2h4"></path><path d="M10.3 12.3a1 1 0 0 0-1.6 1.4"></path><path d="M14.3 11.7a1 1 0 0 1-1.6 1.4"></path><path d="M4 22V4a2 2 0 0 1 2-2h8l6 6v12a2 2 0 0 1-2 2z"></path><path d="M4.6 12.3a1 1 0 0 1 1.6-1.4"></path><path d="M8.6 11.7a1 1 0 0 0 1.6-1.4"></path></svg>`,
  text: () => `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><line x1="10" y1="9" x2="8" y2="9"></line></svg>`,
  trash: () => `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>`,
  download: () => `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`,
};

// --- RENDER FUNCTIONS ---
function render() {
  const appHTML = `
    ${renderSidebar()}
    <main class="main-content">
      ${renderHeader()}
      <div class="documents-container">
        ${renderMainContent()}
      </div>
    </main>
    ${showUploadModal ? renderUploadModal() : ''}
    ${documentToDelete ? renderDeleteConfirmationModal() : ''}
  `;
  root.innerHTML = appHTML;
  addEventListeners();
  if (!isLoading) {
    updateDocumentsView();
  }
}

function renderMainContent() {
    if (isLoading) {
        return `<div class="message-container"><div class="loading-spinner"></div><p>Loading documents...</p></div>`;
    }
    if (errorMessage) {
        return `<div class="message-container"><div class="error-message"><h4>Failed to load documents</h4><p>${errorMessage}</p><p>Please try again later.</p></div></div>`;
    }
    return ''; // Documents rendered by updateDocumentsView
}

function renderSidebar() {
  return `
    <aside class="sidebar">
      <div>
        <h1 class="sidebar-header">PT JGSM</h1>
        <div class="sidebar-section">
          <h3>Filters</h3>
          <label for="division-filter">Filter by Division</label>
          <select id="division-filter" ${isLoading ? 'disabled' : ''}>
            <option value="all">All Divisions</option>
            ${divisions.map(d => `<option value="${d}" ${filters.division === d ? 'selected' : ''}>${d}</option>`).join('')}
          </select>
        </div>
        <div class="sidebar-section">
          <label for="status-filter">Filter by Status</label>
          <select id="status-filter" ${isLoading ? 'disabled' : ''}>
            <option value="all">All Statuses</option>
            ${statuses.map(s => `<option value="${s}" ${filters.status === s ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="sidebar-section external-links">
        <h3>External Links</h3>
        <a href="https://drive.google.com/drive/folders/1cKDwgey0_jt8YpDT5XsTk0uN974e25Db">Drive</a><a href="#">HR </a><a href="#">IT</a>
      </div>
    </aside>
  `;
}

function renderHeader() {
  return `
    <header class="main-header">
      <div class="search-bar">
        ${icons.search()}
        <input type="search" id="search-input" placeholder="Search documents..." value="${filters.search}" ${isLoading ? 'disabled' : ''}>
      </div>
      <div class="header-actions">
        <div class="view-toggle">
          <button id="grid-view-btn" class="${currentView === 'grid' ? 'active' : ''}" aria-label="Grid View" ${isLoading ? 'disabled' : ''}>${icons.grid()}</button>
          <button id="list-view-btn" class="${currentView === 'list' ? 'active' : ''}" aria-label="List View" ${isLoading ? 'disabled' : ''}>${icons.list()}</button>
        </div>
        <button id="upload-btn" class="btn btn-primary" ${isLoading ? 'disabled' : ''}>Upload Document</button>
      </div>
    </header>
  `;
}

function renderDocumentsHTML(docs: AppDocument[]) {
    if (docs.length === 0) {
        return '<div class="message-container"><p class="no-documents-message">No documents found. Try uploading one!</p></div>';
    }
    const containerClass = currentView === 'grid' ? 'documents-grid' : 'documents-list';
    return `<div class="${containerClass}">${docs.map(doc => currentView === 'grid' ? renderDocumentCard(doc) : renderDocumentListItem(doc)).join('')}</div>`;
}

function getFileIcon(fileName: string) {
    const extension = fileName.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(extension!)) return icons.image();
    if (extension === 'pdf') return icons.pdf();
    if (['txt', 'md', 'doc', 'docx'].includes(extension!)) return icons.text();
    return icons.file();
}

function renderDocumentCard(doc: AppDocument) {
  const statusClass = `status-${doc.status.toLowerCase()}`;
  return `
    <div class="document-card" data-doc-id="${doc.id}" role="button" tabindex="0" aria-label="Open document ${doc.name}">
      <button class="delete-btn" data-doc-id="${doc.id}" aria-label="Delete document ${doc.name}">${icons.trash()}</button>
      <div class="doc-icon">${getFileIcon(doc.fileName)}</div>
      <h4 class="doc-name">${doc.name}</h4>
      <div class="doc-meta"><span class="doc-division">${doc.division}</span><span class="doc-status ${statusClass}">${doc.status}</span></div>
    </div>
  `;
}

function renderDocumentListItem(doc: AppDocument) {
    const statusClass = `status-${doc.status.toLowerCase()}`;
    return `
      <div class="document-list-item" data-doc-id="${doc.id}" role="button" tabindex="0" aria-label="Open document ${doc.name}">
        <div class="doc-icon">${getFileIcon(doc.fileName)}</div>
        <div class="doc-name-div"><h4 class="doc-name">${doc.name}</h4></div>
        <div class="doc-meta"><span class="doc-division">${doc.division}</span><span class="doc-status ${statusClass}">${doc.status}</span></div>
        <button class="delete-btn" data-doc-id="${doc.id}" aria-label="Delete document ${doc.name}">${icons.trash()}</button>
      </div>
    `;
}

function renderUploadModal() {
    return `
      <div class="modal-overlay visible" id="upload-modal-overlay">
        <div class="modal-content" role="dialog" aria-labelledby="upload-modal-title">
          <div class="modal-header">
            <h2 id="upload-modal-title">Upload New Document</h2>
            <button class="modal-close" id="upload-modal-close" aria-label="Close">&times;</button>
          </div>
          <form id="upload-form">
            <div class="form-group"><label for="doc-name">Document Name</label><input type="text" id="doc-name" name="name" required></div>
            <div class="form-group"><label for="doc-division">Division</label><select id="doc-division" name="division" required>${divisions.map(d => `<option value="${d}">${d}</option>`).join('')}</select></div>
            <div class="form-group"><label for="doc-status">Status</label><select id="doc-status" name="status" required>${statuses.map(s => `<option value="${s}">${s}</option>`).join('')}</select></div>
            <div class="form-group"><label for="doc-file">File</label><input type="file" id="doc-file" name="file" required></div>
            <div class="form-actions">
              <button type="button" class="btn btn-secondary" id="upload-cancel">Cancel</button>
              <button type="submit" class="btn btn-primary" id="upload-submit-btn" ${isSubmitting ? 'disabled' : ''}>${isSubmitting ? 'Uploading...' : 'Upload'}</button>
            </div>
          </form>
        </div>
      </div>
    `;
}

function renderDeleteConfirmationModal() {
    if (!documentToDelete) return '';
    return `
        <div class="modal-overlay visible" id="delete-modal-overlay">
            <div class="modal-content delete-modal-content" role="alertdialog" aria-labelledby="delete-modal-title" aria-describedby="delete-modal-desc">
                <div class="modal-header">
                    <h2 id="delete-modal-title">Confirm Deletion</h2>
                    <button class="modal-close" id="delete-modal-close" aria-label="Close">&times;</button>
                </div>
                <form id="delete-form">
                    <p id="delete-modal-desc" class="delete-warning">Are you sure you want to permanently delete: <strong>"${documentToDelete.name}"</strong>? This action cannot be undone.</p>
                    <div class="form-group confirmation-checkbox-group">
                        <input type="checkbox" id="delete-confirm-checkbox">
                        <label for="delete-confirm-checkbox">I understand and wish to proceed.</label>
                    </div>
                    <div class="form-actions">
                        <button type="button" class="btn btn-secondary" id="delete-cancel-btn">Cancel</button>
                        <button type="submit" class="btn btn-danger" id="delete-confirm-btn" disabled>Delete</button>
                    </div>
                </form>
            </div>
        </div>
    `;
}


// --- API & DATA LOGIC ---
async function fetchDocuments() {
    isLoading = true;
    errorMessage = null;
    render();
    try {
        const response = await mockApiFetchDocuments();
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        documents = await response.json();
    } catch (error: any) {
        console.error("Failed to fetch documents:", error);
        errorMessage = error.message;
        documents = [];
    } finally {
        isLoading = false;
        render();
    }
}

// --- EVENT HANDLERS & LOGIC ---
function addEventListeners() {
  document.getElementById('division-filter')?.addEventListener('change', handleFilterChange);
  document.getElementById('status-filter')?.addEventListener('change', handleFilterChange);
  document.getElementById('search-input')?.addEventListener('input', handleSearch);
  document.getElementById('grid-view-btn')?.addEventListener('click', () => setView('grid'));
  document.getElementById('list-view-btn')?.addEventListener('click', () => setView('list'));
  document.getElementById('upload-btn')?.addEventListener('click', handleUploadModalOpen);
  
  window.removeEventListener('keydown', handleEscKey); // Remove old before adding
  window.addEventListener('keydown', handleEscKey);

  if (showUploadModal) {
    document.getElementById('upload-modal-overlay')?.addEventListener('click', handleModalOverlayClick);
    document.getElementById('upload-modal-close')?.addEventListener('click', handleUploadModalClose);
    document.getElementById('upload-cancel')?.addEventListener('click', handleUploadModalClose);
    document.getElementById('upload-form')?.addEventListener('submit', handleFormSubmit);
  }
  if (documentToDelete) {
    document.getElementById('delete-modal-overlay')?.addEventListener('click', handleModalOverlayClick);
    document.getElementById('delete-modal-close')?.addEventListener('click', handleCloseDeleteModal);
    document.getElementById('delete-cancel-btn')?.addEventListener('click', handleCloseDeleteModal);
    document.getElementById('delete-form')?.addEventListener('submit', handleConfirmDelete);
    document.getElementById('delete-confirm-checkbox')?.addEventListener('change', handleDeleteCheckboxChange);
  }
}

function addDocumentEventListeners() {
    const container = document.querySelector('.documents-container');
    if (!container) return;
    container.addEventListener('click', (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        const deleteButton = target.closest('.delete-btn');
        const docItem = target.closest('[data-doc-id]');

        if (deleteButton) {
            e.stopPropagation();
            const docId = parseInt(deleteButton.getAttribute('data-doc-id')!, 10);
            handleRequestDelete(docId);
        } else if (docItem) {
            handleDocumentOpen(docItem);
        }
    });
    container.addEventListener('keydown', (e: KeyboardEvent) => {
        const target = e.target as HTMLElement;
        if ((e.key === 'Enter' || e.key === ' ') && target.hasAttribute('data-doc-id')) {
            e.preventDefault();
            handleDocumentOpen(target);
        }
    });
}

function updateDocumentsView() {
    const container = document.querySelector('.documents-container');
    if (!container || isLoading || errorMessage) return;
    const filteredDocs = documents.filter(doc => {
        const searchMatch = doc.name.toLowerCase().includes(filters.search.toLowerCase()) || doc.fileName.toLowerCase().includes(filters.search.toLowerCase());
        const divisionMatch = filters.division === 'all' || doc.division === filters.division;
        const statusMatch = filters.status === 'all' || doc.status === filters.status;
        return searchMatch && divisionMatch && statusMatch;
    });
    container.innerHTML = renderDocumentsHTML(filteredDocs);
    addDocumentEventListeners();
}

function handleFilterChange(e: Event) {
  const target = e.target as HTMLSelectElement;
  if (target.id === 'division-filter') filters.division = target.value;
  else if (target.id === 'status-filter') filters.status = target.value;
  updateDocumentsView();
}

function handleSearch(e: Event) {
  filters.search = (e.target as HTMLInputElement).value;
  updateDocumentsView();
}

function setView(view: ViewMode) {
  currentView = view;
  document.getElementById('grid-view-btn')?.classList.toggle('active', view === 'grid');
  document.getElementById('list-view-btn')?.classList.toggle('active', view === 'list');
  updateDocumentsView();
}

function handleUploadModalOpen() {
    showUploadModal = true;
    render();
}

function handleUploadModalClose() {
    showUploadModal = false;
    isSubmitting = false;
    render();
}

function handleRequestDelete(docId: number) {
    documentToDelete = documents.find(d => d.id === docId) || null;
    render();
}

function handleCloseDeleteModal() {
    documentToDelete = null;
    render();
}

function handleDeleteCheckboxChange(e: Event) {
    const checkbox = e.target as HTMLInputElement;
    const deleteButton = document.getElementById('delete-confirm-btn') as HTMLButtonElement;
    if (deleteButton) {
        deleteButton.disabled = !checkbox.checked;
    }
}

async function handleConfirmDelete(e: Event) {
    e.preventDefault();
    if (!documentToDelete) return;
    
    isSubmitting = true;
    const deleteButton = document.getElementById('delete-confirm-btn') as HTMLButtonElement;
    if(deleteButton) deleteButton.disabled = true;

    try {
        const response = await mockApiDeleteDocument(documentToDelete.id);
        if (!response.ok) throw new Error(`Server responded with ${response.status}`);
        handleCloseDeleteModal();
        await fetchDocuments();
    } catch (error) {
        alert(`Deletion failed: ${(error as Error).message}`);
    } finally {
        isSubmitting = false;
    }
}

function handleModalOverlayClick(e: MouseEvent) {
    if ((e.target as HTMLElement).classList.contains('modal-overlay')) {
        if (showUploadModal) handleUploadModalClose();
        if (documentToDelete) handleCloseDeleteModal();
    }
}

async function handleDocumentOpen(docItem: Element) {
    const docId = parseInt(docItem.getAttribute('data-doc-id')!, 10);
    const doc = documents.find(d => d.id === docId);
    if (!doc) return;

    // For files uploaded in the current session, we have the File object for a reliable preview.
    const localFile = mockFileStore.get(doc.id);
    if (localFile) {
        const fileURL = URL.createObjectURL(localFile);
        window.open(fileURL, '_blank');
        // The browser will revoke this URL when the main document is unloaded.
    } else {
        // For files from previous sessions, open the stored "cloud" URL.
        // This simulates accessing a file from Vercel Blob storage.
        window.open(doc.fileUrl, '_blank');
    }
}

function handleEscKey(e: KeyboardEvent) {
    if (e.key === 'Escape') {
        if (showUploadModal) handleUploadModalClose();
        if (documentToDelete) handleCloseDeleteModal();
    }
}

async function handleFormSubmit(e: Event) {
    e.preventDefault();
    if (isSubmitting) return;

    isSubmitting = true;
    const submitButton = document.getElementById('upload-submit-btn') as HTMLButtonElement;
    if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = 'Uploading...';
    }

    try {
        const response = await mockApiCreateDocument(new FormData(e.target as HTMLFormElement));
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'An unknown error occurred' }));
            throw new Error(errorData.message || `Server responded with ${response.status}`);
        }
        handleUploadModalClose();
        await fetchDocuments();
    } catch (error) {
        alert(`Upload failed: ${(error as Error).message}`);
        isSubmitting = false; // re-enable on failure
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = 'Upload';
        }
    }
}

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    loadDatabase();
    fetchDocuments();
});
