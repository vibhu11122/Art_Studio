/**
 * Studio Gallery - Admin Dashboard Script
 */

// Application State
let artworksData = [];
let isEditing = false;

// DOM Elements
const loginOverlay = document.getElementById('login-overlay');
const loginForm = document.getElementById('login-form');
const securityPinInput = document.getElementById('security-pin');
const loginError = document.getElementById('login-error');
const dashboardContent = document.getElementById('dashboard-content');
const logoutBtn = document.getElementById('logout-btn');

const inventoryRows = document.getElementById('inventory-rows');
const addArtworkBtn = document.getElementById('add-artwork-btn');
const alertBanner = document.getElementById('alert-banner');

// Drawer Elements
const drawerOverlay = document.getElementById('drawer-overlay');
const drawerCloseBtn = document.getElementById('drawer-close-btn');
const drawerCancelBtn = document.getElementById('drawer-cancel-btn');
const drawerTitle = document.getElementById('drawer-title');
const artworkForm = document.getElementById('artwork-form');
const drawerSubmitBtn = document.getElementById('drawer-submit-btn');

// Form Input Elements
const artIdInput = document.getElementById('art-id');
const artTitleInput = document.getElementById('art-title');
const artCategorySelect = document.getElementById('art-category');
const artStatusSelect = document.getElementById('art-status');
const artPriceInput = document.getElementById('art-price');
const artDimensionsInput = document.getElementById('art-dimensions');
const artMediumInput = document.getElementById('art-medium');
const artImageUrlInput = document.getElementById('art-image-url');
const artDescriptionInput = document.getElementById('art-description');

/* ==========================================================================
   Authentication & Authorization
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    initAdmin();
});

function initAdmin() {
    // Check if session is already authenticated
    const isAuthenticated = sessionStorage.getItem('studio_console_auth') === 'true';
    
    if (isAuthenticated) {
        showDashboard();
    } else {
        setupLoginEvent();
    }
    
    setupDrawerEvents();
}

function setupLoginEvent() {
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const pinValue = securityPinInput.value.trim();
        
        if (pinValue === CONFIG.adminPin) {
            sessionStorage.setItem('studio_console_auth', 'true');
            loginError.style.display = 'none';
            showDashboard();
        } else {
            loginError.style.display = 'block';
            securityPinInput.value = '';
            securityPinInput.focus();
        }
    });
}

function showDashboard() {
    loginOverlay.classList.add('hidden');
    dashboardContent.style.display = 'block';
    
    // Setup Logout Event
    logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        sessionStorage.removeItem('studio_console_auth');
        window.location.reload();
    });
    
    // Load Inventory Data
    loadCatalog();
}

/* ==========================================================================
   Data Load & Render
   ========================================================================== */

async function loadCatalog() {
    inventoryRows.innerHTML = `
        <div class="loader-container">
            <div class="loader"></div>
            <p>Loading database catalog...</p>
        </div>
    `;
    
    try {
        if (CONFIG.spreadsheetUrl) {
            console.log("Admin: Fetching Google Sheet data...");
            const response = await fetch(CONFIG.spreadsheetUrl);
            if (!response.ok) throw new Error("Spreadsheet fetch failed");
            const csvText = await response.text();
            artworksData = parseCsv(csvText);
        } else {
            throw new Error("No live spreadsheet configured. Reading local database.");
        }
    } catch (err) {
        console.warn(err.message);
        try {
            const response = await fetch(CONFIG.fallbackDatabasePath);
            if (!response.ok) throw new Error("Local fallback fetch failed");
            artworksData = await response.json();
        } catch (localErr) {
            console.error("Critical: Could not load local artwork database.", localErr);
            inventoryRows.innerHTML = '<div class="loader-container"><p style="color: #e05e5e;">Critical Database Load Error.</p></div>';
            return;
        }
    }
    
    renderInventory();
}

// Simple CSV parser matching the one in app.js
function parseCsv(csvText) {
    const artworks = [];
    const rawLines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (rawLines.length === 0) return [];
    
    function splitCsvLine(line) {
        const fields = [];
        let field = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"' && line[i+1] === '"') {
                field += '"';
                i++;
            } else if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                fields.push(field.trim());
                field = '';
            } else {
                field += char;
            }
        }
        fields.push(field.trim());
        return fields;
    }
    
    const headers = splitCsvLine(rawLines[0]).map(h => h.trim().toLowerCase());
    
    for (let i = 1; i < rawLines.length; i++) {
        const fields = splitCsvLine(rawLines[i]);
        if (fields.length < headers.length) continue;
        
        const row = {};
        headers.forEach((header, index) => {
            row[header.trim()] = fields[index] || '';
        });
        
        // Helper to match column headers tolerantly (ignoring case, spaces, and minor typos)
        const getVal = (rowObj, possibleKeys) => {
            for (let key in rowObj) {
                const normKey = key.toLowerCase().trim();
                if (possibleKeys.includes(normKey)) {
                    return rowObj[key];
                }
            }
            return null;
        };
        
        artworks.push({
            id: getVal(row, ['id']) || i.toString(),
            title: getVal(row, ['title']) || 'Untitled Artwork',
            category: getVal(row, ['category']) || 'Paintings',
            price: getVal(row, ['price']) || 'Inquire',
            dimensions: getVal(row, ['dimensions', 'dimensions ', 'dimension']) || 'Dimensions on request',
            medium: getVal(row, ['medium', 'meduim']) || 'Original painting',
            description: getVal(row, ['description', 'desc']) || '',
            imageUrl: getVal(row, ['imageurl', 'image url', 'image']) || 'assets/placeholder.jpg',
            status: getVal(row, ['status']) || 'Available'
        });
    }
    
    return artworks;
}

function renderInventory() {
    inventoryRows.innerHTML = '';
    
    if (artworksData.length === 0) {
        inventoryRows.innerHTML = '<div style="padding: 3rem; text-align: center; color: var(--text-secondary);">No pieces in inventory.</div>';
        return;
    }
    
    artworksData.forEach(art => {
        const row = document.createElement('div');
        row.className = 'inventory-row';
        
        const isAvailable = art.status.toLowerCase() === 'available';
        const statusClass = isAvailable ? 'available' : 'sold';
        const statusText = isAvailable ? 'Available' : 'Sold';
        
        let displayPrice = art.price;
        if (!isNaN(art.price) && art.price.trim() !== '') {
            displayPrice = `${CONFIG.currencySymbol}${parseFloat(art.price).toLocaleString()}`;
        }
        
        row.innerHTML = `
            <div>
                <img src="${art.imageUrl}" alt="${art.title}" class="inventory-thumb" onerror="this.src='assets/placeholder.jpg';">
            </div>
            <div class="inventory-title-cell">${art.title}</div>
            <div class="inventory-category-cell">${art.category}</div>
            <div><strong>${displayPrice}</strong></div>
            <div class="inventory-dimensions-cell">${art.dimensions}</div>
            <div class="inventory-medium-cell" style="font-style: italic; color: var(--text-secondary);">${art.medium}</div>
            <div class="inventory-action-cell">
                <button class="btn-icon edit-art-btn" title="Edit Artwork" data-id="${art.id}">
                    <i class="fa-solid fa-pen-to-square"></i>
                </button>
            </div>
        `;
        
        // Attach event listener
        row.querySelector('.edit-art-btn').addEventListener('click', (e) => {
            const artId = e.currentTarget.dataset.id;
            const targetArt = artworksData.find(item => item.id.toString() === artId.toString());
            if (targetArt) {
                openEditDrawer(targetArt);
            }
        });
        
        inventoryRows.appendChild(row);
    });
}

/* ==========================================================================
   Add & Edit Form Drawer Controls
   ========================================================================== */

function setupDrawerEvents() {
    addArtworkBtn.addEventListener('click', openAddDrawer);
    drawerCloseBtn.addEventListener('click', closeDrawer);
    drawerCancelBtn.addEventListener('click', closeDrawer);
    
    // Form submission
    artworkForm.addEventListener('submit', handleFormSubmit);
    
    // Close on escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && drawerOverlay.classList.contains('active')) {
            closeDrawer();
        }
    });
}

function openAddDrawer() {
    isEditing = false;
    drawerTitle.textContent = "Add New Artwork";
    artworkForm.reset();
    
    // Auto-generate incremented ID
    const nextId = artworksData.reduce((max, item) => {
        const num = parseInt(item.id);
        return isNaN(num) ? max : Math.max(max, num);
    }, 0) + 1;
    
    artIdInput.value = nextId.toString();
    artStatusSelect.value = "Available";
    
    drawerOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function openEditDrawer(art) {
    isEditing = true;
    drawerTitle.textContent = "Edit Artwork";
    
    // Load values into inputs
    artIdInput.value = art.id;
    artTitleInput.value = art.title;
    artCategorySelect.value = art.category;
    artStatusSelect.value = art.status;
    artPriceInput.value = art.price;
    artDimensionsInput.value = art.dimensions;
    artMediumInput.value = art.medium;
    artImageUrlInput.value = art.imageUrl;
    artDescriptionInput.value = art.description;
    
    drawerOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeDrawer() {
    drawerOverlay.classList.remove('active');
    document.body.style.overflow = '';
}

/* ==========================================================================
   Save / Write Synchronizer Logic
   ========================================================================== */

async function handleFormSubmit(e) {
    e.preventDefault();
    
    const artwork = {
        id: artIdInput.value,
        title: artTitleInput.value.trim(),
        category: artCategorySelect.value,
        status: artStatusSelect.value,
        price: artPriceInput.value.trim(),
        dimensions: artDimensionsInput.value.trim(),
        medium: artMediumInput.value.trim(),
        imageUrl: artImageUrlInput.value.trim(),
        description: artDescriptionInput.value.trim()
    };
    
    // If Google Sheets Apps Script URL is empty, run mock local editing
    if (!CONFIG.appsScriptUrl) {
        const idx = artworksData.findIndex(item => item.id.toString() === artwork.id.toString());
        if (idx !== -1) {
            artworksData[idx] = artwork;
        } else {
            artworksData.push(artwork);
        }
        renderInventory();
        showAlert('Simulated success! Catalog updated locally. (Link Google Sheets Apps Script URL in config.js for permanent saves)', 'success');
        closeDrawer();
        return;
    }
    
    // Save to Google Sheet via Google Apps Script Web App (JSONP or CORS POST)
    drawerSubmitBtn.disabled = true;
    drawerSubmitBtn.innerText = 'Saving to Sheet...';
    
    const payload = {
        action: 'update',
        pin: CONFIG.adminPin,
        artwork: artwork
    };
    
    try {
        // Send updates using POST
        const response = await fetch(CONFIG.appsScriptUrl, {
            method: 'POST',
            mode: 'cors',
            headers: {
                'Content-Type': 'text/plain' // Avoids preflight CORS issues in Apps Script Web Apps
            },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) throw new Error("Network connection error to Google Script.");
        const result = await response.json();
        
        if (result.status === 'success') {
            showAlert(`Catalog updated: "${artwork.title}" saved successfully!`, 'success');
            closeDrawer();
            // Reload from Sheet to ensure integrity
            await loadCatalog();
        } else {
            throw new Error(result.message || "Failed to update cell rows.");
        }
        
    } catch (err) {
        console.error("Dashboard Sync Error:", err);
        showAlert(`Sync Error: ${err.message}. Changes saved locally.`, 'error');
        
        // Backup locally inside runtime state
        const idx = artworksData.findIndex(item => item.id.toString() === artwork.id.toString());
        if (idx !== -1) {
            artworksData[idx] = artwork;
        } else {
            artworksData.push(artwork);
        }
        renderInventory();
        closeDrawer();
    } finally {
        drawerSubmitBtn.disabled = false;
        drawerSubmitBtn.innerText = isEditing ? 'Save Changes' : 'Add Artwork';
    }
}

/* ==========================================================================
   User Interface Banners
   ========================================================================== */

function showAlert(message, type) {
    alertBanner.textContent = message;
    alertBanner.className = `alert-banner ${type}`;
    
    // Scroll to top to see alert
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    // Auto hide after 8 seconds
    setTimeout(() => {
        alertBanner.className = 'alert-banner';
        alertBanner.textContent = '';
    }, 8000);
}
