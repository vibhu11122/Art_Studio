/**
 * Studio Gallery - Main Application Script
 */

// Configuration is loaded globally from config.js
// If config.js is missing, this script will run with fallback default values.
if (typeof CONFIG === 'undefined') {
    window.CONFIG = {
        spreadsheetUrl: '',
        appsScriptUrl: '',
        adminPin: '1234',
        whatsappNumber: '919876543210',
        fallbackDatabasePath: 'artworks.json',
        currencySymbol: '$'
    };
}

// Application State
let artworksData = [];
let activeFilter = 'all';

// DOM Elements
const artworkGrid = document.getElementById('artwork-grid');
const filterButtons = document.querySelectorAll('.filter-btn');
const modal = document.getElementById('artwork-modal');
const modalCloseBtn = document.querySelector('.modal-close-btn');
const header = document.querySelector('.header');

// Elements inside Modal
const modalImg = document.getElementById('modal-art-image');
const modalMedium = document.getElementById('modal-art-medium');
const modalTitle = document.getElementById('modal-art-title');
const modalStatus = document.getElementById('modal-art-status');
const modalDimensions = document.getElementById('modal-art-dimensions');
const modalPrice = document.getElementById('modal-art-price');
const modalDescription = document.getElementById('modal-art-description');
const modalWhatsappBtn = document.getElementById('modal-whatsapp-btn');

// Hero Carousel Elements
const carouselViewport = document.getElementById('carousel-viewport');
const carouselRing = document.getElementById('carousel-ring');
const carouselGlowA = document.getElementById('carousel-glow-a');
const carouselGlowB = document.getElementById('carousel-glow-b');
const nowViewingTitle = document.getElementById('now-viewing-title');
const nowViewingMedium = document.getElementById('now-viewing-medium');

/* ==========================================================================
   Shared Utilities
   ========================================================================== */

function reducedMotionPreferred() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function isCoarsePointer() {
    return window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
}

function debounce(fn, wait) {
    let timeoutId;
    return function debounced(...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn.apply(this, args), wait);
    };
}

// Generates a soft branded placeholder (as a data URI) for artworks whose
// image fails to load, so a broken-image icon never appears on the site.
function buildImageFallback(title) {
    const initial = (title || 'A').trim().charAt(0).toUpperCase() || 'A';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500" viewBox="0 0 400 500">
        <rect width="400" height="500" fill="#F1EEE8"/>
        <rect x="1" y="1" width="398" height="498" fill="none" stroke="#DCD0C4" stroke-width="1"/>
        <text x="200" y="272" font-family="Georgia, serif" font-size="120" fill="#C3B5A7" text-anchor="middle" opacity="0.55">${initial}</text>
    </svg>`;
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

function attachImageFallback(imgEl, title) {
    imgEl.addEventListener('error', () => {
        imgEl.src = buildImageFallback(title);
    }, { once: true });
}

/* ==========================================================================
   Initialization & Data Loading
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

async function initApp() {
    setupHeaderScroll();
    setupFilters();
    setupModalEvents();
    setupAboutWhatsApp();
    setupScrollReveal();
    setupNavScrollSpy();
    setupMagneticButtons();
    setupHeroSpotlight();
    
    // Load Artworks
    await loadArtworks();
}

// Adjust Header styling on Scroll
function setupHeaderScroll() {
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    });
}

// Setup About section general inquiry button
function setupAboutWhatsApp() {
    const aboutWa = document.getElementById('about-whatsapp');
    if (aboutWa) {
        const text = encodeURIComponent("Hi! I'm visiting your website and would love to chat about your sketches and paintings.");
        aboutWa.href = `https://wa.me/${CONFIG.whatsappNumber}?text=${text}`;
    }
}

// Fetch and load data
async function loadArtworks() {
    try {
        if (CONFIG.spreadsheetUrl) {
            console.log("Attempting to fetch data from Google Sheets...");
            const response = await fetch(CONFIG.spreadsheetUrl);
            if (!response.ok) throw new Error("Google Sheets fetch failed");
            const csvText = await response.text();
            artworksData = parseCsv(csvText);
            console.log("Successfully loaded data from Google Sheets:", artworksData);
        } else {
            throw new Error("No spreadsheet URL configured. Using local database.");
        }
    } catch (error) {
        console.warn(error.message);
        console.log("Loading fallback local data...");
        try {
            const response = await fetch(CONFIG.fallbackDatabasePath);
            if (!response.ok) throw new Error("Fallback fetch failed");
            artworksData = await response.json();
            console.log("Successfully loaded fallback data:", artworksData);
        } catch (fallbackError) {
            console.error("Critical: Could not load local fallback data.", fallbackError);
            showErrorMessage();
            initHeroCarousel([]);
            return;
        }
    }
    
    renderGallery();
    initHeroCarousel(artworksData);
}

/* ==========================================================================
   CSV Parser Engine (For Google Sheets integration)
   ========================================================================== */

function parseCsv(csvText) {
    const artworks = [];
    // Split lines by newline, avoiding empty lines
    const rawLines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (rawLines.length === 0) return [];
    
    // Helper to split a CSV line into fields, handling quotes
    function splitCsvLine(line) {
        const fields = [];
        let field = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"' && line[i+1] === '"') {
                field += '"';
                i++; // Skip the next quote
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
    
    // Parse Headers
    const headers = splitCsvLine(rawLines[0]).map(h => h.trim().toLowerCase());
    
    // Parse Rows
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
        
        // Normalize keys and structure
        artworks.push({
            id: getVal(row, ['id']) || i.toString(),
            title: getVal(row, ['title']) || 'Untitled Artwork',
            category: getVal(row, ['category']) || 'Paintings',
            price: getVal(row, ['price']) || 'Inquire',
            dimensions: getVal(row, ['dimensions', 'dimensions ', 'dimension']) || 'Dimensions on request',
            medium: getVal(row, ['medium', 'meduim']) || 'Original painting',
            description: getVal(row, ['description', 'desc']) || 'No description provided.',
            imageUrl: getVal(row, ['imageurl', 'image url', 'image']) || 'assets/placeholder.jpg',
            status: getVal(row, ['status']) || 'Available'
        });
    }
    
    return artworks;
}

/* ==========================================================================
   Gallery Rendering & Filter Logic
   ========================================================================== */

function renderGallery() {
    artworkGrid.innerHTML = '';
    
    if (artworksData.length === 0) {
        artworkGrid.innerHTML = '<div class="loader-container"><p>No artworks found in database.</p></div>';
        return;
    }
    
    artworksData.forEach((art, index) => {
        const card = document.createElement('div');
        card.className = 'artwork-card';
        card.dataset.category = art.category;
        
        // Add dynamic stagger animation delay
        card.style.animationDelay = `${index * 0.1}s`;
        
        const isAvailable = art.status.toLowerCase() === 'available';
        const statusClass = isAvailable ? 'available' : 'sold';
        const statusText = isAvailable ? 'Available' : 'Sold';
        
        // Format price
        let displayPrice = art.price;
        if (!isNaN(art.price) && art.price.trim() !== '') {
            displayPrice = `${CONFIG.currencySymbol}${parseFloat(art.price).toLocaleString()}`;
        }
        
        card.innerHTML = `
            <div class="image-frame">
                <img src="${art.imageUrl}" alt="${art.title}" loading="lazy">
                <div class="card-overlay"></div>
                <div class="status-indicator ${statusClass}">${statusText}</div>
                <div class="view-label"><span>View Details</span><i class="fa-solid fa-arrow-up-right"></i></div>
            </div>
            <div class="art-info">
                <span class="art-category">${art.category}</span>
                <div class="art-title-row">
                    <h3 class="art-title-name">${art.title}</h3>
                    <span class="art-price-tag">${displayPrice}</span>
                </div>
                <p class="art-medium-details">${art.medium}</p>
            </div>
        `;
        
        // Fall back to a branded placeholder if the image URL is broken
        attachImageFallback(card.querySelector('img'), art.title);
        
        // Subtle cursor-following tilt on the frame, like tipping a canvas toward the light
        const frame = card.querySelector('.image-frame');
        if (!isCoarsePointer() && !reducedMotionPreferred()) {
            frame.addEventListener('mousemove', (e) => {
                const rect = frame.getBoundingClientRect();
                const px = (e.clientX - rect.left) / rect.width - 0.5;
                const py = (e.clientY - rect.top) / rect.height - 0.5;
                frame.style.transition = 'transform 0.1s ease-out';
                frame.style.transform = `rotateX(${(-py * 7).toFixed(2)}deg) rotateY(${(px * 7).toFixed(2)}deg)`;
            });
            frame.addEventListener('mouseleave', () => {
                frame.style.transition = 'transform 0.5s var(--ease-cinematic)';
                frame.style.transform = '';
            });
        }
        
        // Click to view modal details
        card.addEventListener('click', () => openModal(art));
        
        artworkGrid.appendChild(card);
    });
    
    filterGallery(activeFilter);
}

function setupFilters() {
    filterButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            filterButtons.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            activeFilter = e.target.dataset.filter;
            filterGallery(activeFilter);
        });
    });
}

function filterGallery(category) {
    const cards = document.querySelectorAll('.artwork-card');
    cards.forEach(card => {
        const cardCategory = card.dataset.category;
        if (category === 'all' || cardCategory.toLowerCase() === category.toLowerCase()) {
            card.classList.remove('hidden');
        } else {
            card.classList.add('hidden');
        }
    });
}

function showErrorMessage() {
    artworkGrid.innerHTML = `
        <div class="loader-container">
            <i class="fa-solid fa-triangle-exclamation" style="font-size: 2rem; color: var(--accent-bronze);"></i>
            <p>Unable to load art collection. Please try again later.</p>
        </div>
    `;
}

/* ==========================================================================
   Details Modal & WhatsApp Integration
   ========================================================================== */

function openModal(art) {
    modalImg.onerror = () => { modalImg.src = buildImageFallback(art.title); };
    modalImg.src = art.imageUrl;
    modalImg.alt = art.title;
    modalTitle.textContent = art.title;
    modalMedium.textContent = art.medium;
    modalDimensions.textContent = art.dimensions;
    modalDescription.textContent = art.description;
    
    // Status Badge
    const isAvailable = art.status.toLowerCase() === 'available';
    modalStatus.textContent = isAvailable ? 'Available' : 'Sold';
    modalStatus.className = `status-badge ${isAvailable ? 'available' : 'sold'}`;
    
    // Format Price for Modal
    let displayPrice = art.price;
    if (!isNaN(art.price) && art.price.trim() !== '') {
        displayPrice = `${CONFIG.currencySymbol}${parseFloat(art.price).toLocaleString()}`;
    }
    modalPrice.textContent = displayPrice;
    
    // WhatsApp Buy Button Logic
    if (isAvailable) {
        modalWhatsappBtn.classList.remove('disabled');
        modalWhatsappBtn.innerHTML = '<i class="fa-brands fa-whatsapp"></i> Purchase via WhatsApp';
        
        // Construct the custom message
        const messageText = `Hello Elena! I am interested in purchasing your original artwork "${art.title}" (${art.medium}, ${art.dimensions}) listed for ${displayPrice}. Is it still available?`;
        modalWhatsappBtn.href = `https://wa.me/${CONFIG.whatsappNumber}?text=${encodeURIComponent(messageText)}`;
    } else {
        modalWhatsappBtn.classList.add('disabled');
        modalWhatsappBtn.innerHTML = 'Sold / Collection Only';
        modalWhatsappBtn.href = '#';
    }
    
    // Display Modal
    modal.classList.add('active');
    document.body.style.overflow = 'hidden'; // Stop background scrolling
}

function closeModal() {
    modal.classList.remove('active');
    document.body.style.overflow = ''; // Restore background scrolling
    
    // Clear image src so it doesn't flash when opened next time
    setTimeout(() => {
        modalImg.src = '';
    }, 400);
}

function setupModalEvents() {
    modalCloseBtn.addEventListener('click', closeModal);
    
    // Close modal when clicking outside content
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });
    
    // Close modal with ESC key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('active')) {
            closeModal();
        }
    });
}

/* ==========================================================================
   Hero Carousel — Revolving Gallery
   A ring of artworks suspended in 3D space, auto-rotating like a rotunda,
   draggable, keyboard-navigable, and tied to the real inventory data.
   ========================================================================== */

let carouselItems = [];
let carouselAngle = 0;
let carouselSegment = 60;
let carouselRadius = 220;
let carouselPaused = false;
let carouselDragging = false;
let carouselDidDrag = false;
let carouselLastFrameTime = null;
let carouselActiveIndex = -1;
let carouselGlowToggle = false;
let carouselRafId = null;
const CAROUSEL_DEGREES_PER_SECOND = 6;

function initHeroCarousel(data) {
    if (!carouselViewport || !carouselRing) return;
    
    // Build a working set of items; always keep the ring populated
    let source = (data || []).filter(a => a && a.imageUrl);
    if (source.length === 0) source = data || [];
    
    // Sample evenly if there are many pieces, so the ring stays legible
    if (source.length > 8) {
        const step = source.length / 8;
        const sampled = [];
        for (let i = 0; i < 8; i++) sampled.push(source[Math.floor(i * step)]);
        source = sampled;
    }
    // Duplicate small collections so the ring never looks sparse
    while (source.length > 0 && source.length < 3) {
        source = source.concat(source);
    }
    
    carouselRing.innerHTML = '';
    carouselItems = source;
    carouselActiveIndex = -1;
    
    if (source.length === 0) {
        carouselRing.innerHTML = '<div class="carousel-empty">New pieces are being framed.<br>Check back soon.</div>';
        return;
    }
    
    const n = source.length;
    carouselSegment = 360 / n;
    
    source.forEach((art, i) => {
        const item = document.createElement('div');
        item.className = 'ring-item';
        item.dataset.index = String(i);
        
        const inner = document.createElement('div');
        inner.className = 'ring-item-inner';
        inner.style.transitionDelay = `${i * 0.08}s`;
        
        const frame = document.createElement('div');
        frame.className = 'canvas-frame';
        
        const img = document.createElement('img');
        img.alt = art.title || 'Original artwork';
        img.loading = 'eager';
        attachImageFallback(img, art.title);
        img.src = art.imageUrl;
        
        frame.appendChild(img);
        inner.appendChild(frame);
        item.appendChild(inner);
        carouselRing.appendChild(item);
        
        // Entrance: pieces settle into formation rather than just appearing
        requestAnimationFrame(() => {
            requestAnimationFrame(() => inner.classList.add('settled'));
        });
        
        item.addEventListener('click', () => {
            if (!carouselDidDrag) openModal(art);
        });
    });
    
    sizeCarouselItems();
    window.addEventListener('resize', debounce(sizeCarouselItems, 200));
    
    setupCarouselInteraction();
    updateNowViewing(true);
    
    if (!carouselRafId) {
        carouselLastFrameTime = null;
        carouselRafId = requestAnimationFrame(carouselTick);
    }
}

function sizeCarouselItems() {
    const items = carouselRing.querySelectorAll('.ring-item');
    if (items.length === 0) return;
    const n = items.length;
    const viewportRect = carouselViewport.getBoundingClientRect();
    const itemW = Math.max(110, Math.min(210, viewportRect.width * 0.44));
    const itemH = itemW * 1.25;
    carouselRadius = Math.round(((itemW * n) / (2 * Math.PI)) * 1.35);
    
    items.forEach((item, i) => {
        item.style.width = `${itemW}px`;
        item.style.height = `${itemH}px`;
        item.style.marginLeft = `-${itemW / 2}px`;
        item.style.marginTop = `-${itemH / 2}px`;
        item.style.transform = `rotateY(${i * carouselSegment}deg) translateZ(${carouselRadius}px)`;
    });
}

function carouselTick(timestamp) {
    if (carouselLastFrameTime === null) carouselLastFrameTime = timestamp;
    const dt = (timestamp - carouselLastFrameTime) / 1000;
    carouselLastFrameTime = timestamp;
    
    if (!carouselPaused && !carouselDragging && !reducedMotionPreferred()) {
        carouselAngle += CAROUSEL_DEGREES_PER_SECOND * dt;
    }
    
    carouselRing.style.transform = `rotateY(${carouselAngle}deg)`;
    updateNowViewing(false);
    
    carouselRafId = requestAnimationFrame(carouselTick);
}

// Determine which ring item currently faces the viewer, and update the
// "Now Viewing" plaque plus the ambient background glow to match.
function updateNowViewing(force) {
    if (carouselItems.length === 0) return;
    const n = carouselItems.length;
    let bestIndex = 0;
    let bestDelta = Infinity;
    
    for (let i = 0; i < n; i++) {
        let facing = (carouselAngle + i * carouselSegment) % 360;
        if (facing > 180) facing -= 360;
        if (facing < -180) facing += 360;
        const delta = Math.abs(facing);
        if (delta < bestDelta) {
            bestDelta = delta;
            bestIndex = i;
        }
    }
    
    if (bestIndex !== carouselActiveIndex || force) {
        carouselActiveIndex = bestIndex;
        const art = carouselItems[bestIndex];
        if (nowViewingTitle) nowViewingTitle.textContent = art.title || 'Untitled Artwork';
        if (nowViewingMedium) nowViewingMedium.textContent = art.medium || '';
        swapCarouselGlow(art.imageUrl);
    }
}

// Crossfades the ambient background glow between two stacked layers
function swapCarouselGlow(imageUrl) {
    if (!carouselGlowA || !carouselGlowB || !imageUrl) return;
    const showA = carouselGlowToggle;
    carouselGlowToggle = !carouselGlowToggle;
    const front = showA ? carouselGlowA : carouselGlowB;
    const back = showA ? carouselGlowB : carouselGlowA;
    front.style.backgroundImage = `url("${imageUrl}")`;
    front.style.opacity = '1';
    back.style.opacity = '0';
}

function setupCarouselInteraction() {
    let startX = 0;
    let startAngle = 0;
    let lastX = 0;
    let lastTime = 0;
    let velocity = 0;
    
    const onPointerDown = (e) => {
        carouselDragging = true;
        carouselDidDrag = false;
        carouselViewport.classList.add('grabbing');
        startX = e.clientX;
        lastX = e.clientX;
        startAngle = carouselAngle;
        lastTime = performance.now();
        velocity = 0;
        if (carouselViewport.setPointerCapture) {
            try { carouselViewport.setPointerCapture(e.pointerId); } catch (err) { /* no-op */ }
        }
    };
    
    const onPointerMove = (e) => {
        if (!carouselDragging) return;
        const dx = e.clientX - startX;
        if (Math.abs(dx) > 4) carouselDidDrag = true;
        carouselAngle = startAngle - dx * 0.35;
        
        const now = performance.now();
        const dt = now - lastTime;
        if (dt > 0) velocity = ((e.clientX - lastX) / dt) * -0.35;
        lastX = e.clientX;
        lastTime = now;
    };
    
    const onPointerUp = () => {
        if (!carouselDragging) return;
        carouselDragging = false;
        carouselViewport.classList.remove('grabbing');
        applyCarouselMomentum(velocity * 16);
    };
    
    carouselViewport.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    
    carouselViewport.addEventListener('mouseenter', () => { carouselPaused = true; });
    carouselViewport.addEventListener('mouseleave', () => { carouselPaused = false; });
    
    carouselViewport.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') {
            carouselAngle -= carouselSegment;
            carouselPaused = true;
        } else if (e.key === 'ArrowRight') {
            carouselAngle += carouselSegment;
            carouselPaused = true;
        }
    });
}

function applyCarouselMomentum(initialVelocity) {
    let v = initialVelocity;
    const friction = 0.94;
    function step() {
        if (Math.abs(v) < 0.02) return;
        carouselAngle += v;
        v *= friction;
        requestAnimationFrame(step);
    }
    if (Math.abs(v) > 0.02) step();
}

/* ==========================================================================
   Hero Spotlight — cursor-tracked gallery lighting
   ========================================================================== */

function setupHeroSpotlight() {
    const hero = document.querySelector('.hero');
    if (!hero || isCoarsePointer() || reducedMotionPreferred()) return;
    
    hero.addEventListener('mousemove', (e) => {
        const rect = hero.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        hero.style.setProperty('--mx', `${x}%`);
        hero.style.setProperty('--my', `${y}%`);
    });
}

/* ==========================================================================
   Scroll Reveal — fades sections in as they enter the viewport
   ========================================================================== */

function setupScrollReveal() {
    const revealEls = document.querySelectorAll('[data-reveal]');
    if (revealEls.length === 0) return;
    
    if (!('IntersectionObserver' in window) || reducedMotionPreferred()) {
        revealEls.forEach(el => el.classList.add('revealed'));
        return;
    }
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('revealed');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.15, rootMargin: '0px 0px -80px 0px' });
    
    revealEls.forEach(el => observer.observe(el));
}

/* ==========================================================================
   Nav Scrollspy — highlights the section currently in view
   ========================================================================== */

function setupNavScrollSpy() {
    const navLinks = document.querySelectorAll('.nav-link[href^="#"]');
    if (navLinks.length === 0 || !('IntersectionObserver' in window)) return;
    
    const linkMap = {};
    navLinks.forEach(link => {
        const id = link.getAttribute('href').replace('#', '');
        if (id) linkMap[id] = link;
    });
    
    const targets = Object.keys(linkMap)
        .map(id => document.getElementById(id))
        .filter(Boolean);
    if (targets.length === 0) return;
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            const link = linkMap[entry.target.id];
            if (!link) return;
            if (entry.isIntersecting) {
                navLinks.forEach(l => l.classList.remove('active'));
                link.classList.add('active');
            }
        });
    }, { rootMargin: '-45% 0px -45% 0px', threshold: 0 });
    
    targets.forEach(t => observer.observe(t));
}

/* ==========================================================================
   Magnetic Buttons — subtle cursor-follow on primary calls to action
   ========================================================================== */

function setupMagneticButtons() {
    if (isCoarsePointer() || reducedMotionPreferred()) return;
    const targets = document.querySelectorAll('.hero-btn, .general-inquiry-btn');
    
    targets.forEach(btn => {
        btn.addEventListener('mousemove', (e) => {
            const rect = btn.getBoundingClientRect();
            const x = e.clientX - rect.left - rect.width / 2;
            const y = e.clientY - rect.top - rect.height / 2;
            btn.style.transform = `translate(${(x * 0.18).toFixed(1)}px, ${(y * 0.35).toFixed(1)}px)`;
        });
        btn.addEventListener('mouseleave', () => {
            btn.style.transform = '';
        });
    });
}
