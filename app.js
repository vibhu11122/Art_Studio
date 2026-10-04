/**
 * Vishal Trivedi Studio — public gallery
 * Loads the collection (Google Sheet → artworks.json fallback), hangs it in a
 * vertical, spotlit collection, builds the catalogue, and runs the viewing room.
 */
(function () {
    'use strict';

    const CFG = Object.assign({
        spreadsheetUrl: '',
        whatsappNumber: '',
        fallbackDatabasePath: 'artworks.json',
        currencySymbol: '₹',
        artistName: 'The Artist',
        studioName: 'Studio',
        tagline: 'Original sketches & paintings',
        instagramUrl: '',
        portfolioUrl: ''
    }, typeof CONFIG !== 'undefined' ? CONFIG : {});   // config.js declares a top-level const

    const $ = (sel, root = document) => root.querySelector(sel);
    const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const finePointer = window.matchMedia('(pointer: fine)').matches;

    let collection = [];   // everything loaded
    let shown = [];        // after the room filter
    let usingSamples = false;

    /* ------------------------------------------------------------------
       Helpers
       ------------------------------------------------------------------ */
    function el(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined && text !== null) node.textContent = text;
        return node;
    }

    function formatPrice(price) {
        const raw = String(price || '').replace(/[,\s]/g, '');
        if (raw && !isNaN(raw)) {
            const locale = CFG.currencySymbol === '₹' ? 'en-IN' : undefined;
            return CFG.currencySymbol + Number(raw).toLocaleString(locale);
        }
        return price || 'Price on request';
    }

    const isSold = art => String(art.status || '').trim().toLowerCase() === 'sold';
    const isSketch = art => String(art.category || '').toLowerCase().startsWith('sketch');
    const pad2 = n => String(n).padStart(2, '0');

    function frameStyle(art, i) {
        if (isSketch(art)) return 'noir';
        return i % 2 === 0 ? 'gilt' : 'oak';
    }

    function waLink(text) {
        return `https://wa.me/${CFG.whatsappNumber}?text=${encodeURIComponent(text)}`;
    }

    function buyMessage(art) {
        return `Hello ${CFG.artistName.split(' ')[0]}! I'd love to acquire "${art.title}" (${art.medium}, ${art.dimensions}) listed at ${formatPrice(art.price)}. Is it still available?`;
    }

    function fallbackImage(title) {
        const initial = (title || 'A').trim().charAt(0).toUpperCase();
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500"><rect width="400" height="500" fill="#ece5d6"/><text x="200" y="290" font-family="Georgia,serif" font-style="italic" font-size="140" fill="#b9ab92" text-anchor="middle">${initial}</text></svg>`;
        return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
    }

    function makeImg(art, cls) {
        const img = el('img', cls);
        img.alt = `${art.title} — ${art.medium}`;
        img.decoding = 'async';
        img.addEventListener('error', () => { img.src = fallbackImage(art.title); }, { once: true });
        img.src = art.imageUrl;
        return img;
    }

    function makeFrame(art, i) {
        const frame = el('div', `frame ${frameStyle(art, i)}`);
        const mat = el('div', 'mat');
        mat.appendChild(makeImg(art));
        frame.appendChild(mat);
        if (isSold(art)) frame.appendChild(el('span', 'sold-sticker'));
        return frame;
    }

    /* ------------------------------------------------------------------
       Identity: fill name, tagline, links from config
       ------------------------------------------------------------------ */
    function bindIdentity() {
        const [first, ...rest] = CFG.artistName.split(' ');
        const values = {
            artistName: CFG.artistName,
            studioName: CFG.studioName,
            tagline: CFG.tagline,
            firstName: first,
            lastName: rest.join(' ') || '',
            monogram: CFG.artistName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
        };
        $$('[data-bind]').forEach(node => {
            const v = values[node.dataset.bind];
            if (v !== undefined) node.textContent = v;
        });
        document.title = `${CFG.studioName} | ${CFG.tagline}`;
        $('#year').textContent = new Date().getFullYear();

        const portfolio = $('#portfolioLink');
        if (CFG.portfolioUrl) portfolio.href = CFG.portfolioUrl; else portfolio.hidden = true;
        const insta = $('#instagramLink');
        if (CFG.instagramUrl) { insta.href = CFG.instagramUrl; insta.hidden = false; }

        const first2 = CFG.artistName.split(' ')[0];
        const messages = {
            general: `Hi ${first2}! I've been walking through your online gallery and would love to talk about your work.`,
            commission: `Hi ${first2}! I'd like to discuss commissioning an original piece.`
        };
        $$('[data-whatsapp]').forEach(a => {
            a.href = waLink(messages[a.dataset.whatsapp] || messages.general);
            a.target = '_blank';
            a.rel = 'noopener';
        });
    }

    /* ------------------------------------------------------------------
       Data loading (Google Sheet CSV → local JSON fallback)
       ------------------------------------------------------------------ */
    function splitCsvLine(line) {
        const out = [];
        let field = '', quoted = false;
        for (let i = 0; i < line.length; i++) {
            const c = line[i];
            if (c === '"' && line[i + 1] === '"') { field += '"'; i++; }
            else if (c === '"') quoted = !quoted;
            else if (c === ',' && !quoted) { out.push(field.trim()); field = ''; }
            else field += c;
        }
        out.push(field.trim());
        return out;
    }

    function parseCsv(text) {
        const lines = text.split(/\r?\n/).filter(l => l.trim());
        if (lines.length < 2) return [];
        const headers = splitCsvLine(lines[0]).map(h => h.trim().toLowerCase());
        const pick = (row, keys) => {
            for (const k of keys) if (row[k]) return row[k];
            return '';
        };
        return lines.slice(1).map((line, i) => {
            const fields = splitCsvLine(line);
            const row = {};
            headers.forEach((h, idx) => { row[h] = fields[idx] || ''; });
            return {
                id: pick(row, ['id']) || String(i + 1),
                title: pick(row, ['title']) || 'Untitled',
                category: pick(row, ['category']) || 'Paintings',
                price: pick(row, ['price']),
                dimensions: pick(row, ['dimensions', 'dimension', 'size']) || 'Dimensions on request',
                medium: pick(row, ['medium', 'meduim']) || 'Original work',
                description: pick(row, ['description', 'desc']),
                imageUrl: pick(row, ['imageurl', 'image url', 'image']),
                status: pick(row, ['status']) || 'Available'
            };
        }).filter(a => a.imageUrl);
    }

    async function loadCollection() {
        if (CFG.spreadsheetUrl) {
            try {
                const res = await fetch(CFG.spreadsheetUrl, { cache: 'no-store' });
                if (res.ok) {
                    const rows = parseCsv(await res.text());
                    if (rows.length) return rows;
                }
            } catch (e) { /* fall through to the local file */ }
        }
        try {
            const res = await fetch(CFG.fallbackDatabasePath, { cache: 'no-store' });
            const rows = await res.json();
            usingSamples = rows.some(r => r.sample);
            return rows;
        } catch (e) {
            return [];
        }
    }

    /* ------------------------------------------------------------------
       Entrance
       ------------------------------------------------------------------ */
    function renderEntrance() {
        const featured = collection.find(a => !isSold(a)) || collection[0];
        $('#factCount').textContent = collection.length || '—';
        $('#factAvailable').textContent = collection.filter(a => !isSold(a)).length;
        if (!featured) return;
        const img = $('#featuredImg');
        img.alt = `${featured.title} — ${featured.medium}`;
        img.addEventListener('error', () => { img.src = fallbackImage(featured.title); }, { once: true });
        img.src = featured.imageUrl;
        $('#featuredTitle').textContent = featured.title;
        const piece = $('#featured');
        piece.style.cursor = 'pointer';
        piece.dataset.cursor = 'view';
        piece.onclick = () => openViewer(collection.indexOf(featured), collection);

        // a soft light that follows the cursor across the entrance hall
        if (finePointer && !reduceMotion) {
            const hall = $('#entrance');
            hall.addEventListener('pointermove', e => {
                const r = hall.getBoundingClientRect();
                hall.style.setProperty('--lx', `${((e.clientX - r.left) / r.width) * 100}%`);
                hall.style.setProperty('--ly', `${((e.clientY - r.top) / r.height) * 100}%`);
            });
        }
    }

    /* ------------------------------------------------------------------
       The collection: one spotlit bay per work, alternating sides
       ------------------------------------------------------------------ */
    const hall = $('#hall');
    let bayObserver = null;

    function renderCollection() {
        hall.textContent = '';

        shown.forEach((art, i) => {
            const bay = el('article', `bay${isSketch(art) ? ' sketch' : ''}${isSold(art) ? ' is-sold' : ''}${i % 2 ? ' flip' : ''}`);

            const hang = el('div', 'art-hang');
            hang.dataset.cursor = 'view';
            hang.setAttribute('role', 'button');
            hang.tabIndex = 0;
            hang.setAttribute('aria-label', `View ${art.title}`);
            hang.appendChild(el('div', 'spot-cone'));
            hang.appendChild(makeFrame(art, i));
            hang.addEventListener('click', () => openViewer(i, shown));
            hang.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openViewer(i, shown); } });

            const plaque = el('div', 'plaque');
            plaque.appendChild(el('span', 'plaque-no', `No. ${pad2(i + 1)} · ${art.category}`));
            plaque.appendChild(el('h3', null, art.title));
            plaque.appendChild(el('p', 'plaque-artist', CFG.artistName));
            if (art.description) plaque.appendChild(el('p', 'plaque-desc', art.description));
            const meta = el('p', 'plaque-meta');
            meta.append(art.medium, el('br'), art.dimensions);
            plaque.appendChild(meta);
            const foot = el('div', 'plaque-foot');
            foot.appendChild(el('span', 'plaque-price', isSold(art) ? 'Sold' : formatPrice(art.price)));
            foot.appendChild(el('span', `status-dot${isSold(art) ? ' sold' : ''}`, isSold(art) ? 'Collected' : 'Available'));
            plaque.appendChild(foot);
            const actions = el('div', 'plaque-actions');
            const view = el('button', null, 'View closer');
            view.type = 'button';
            view.addEventListener('click', () => openViewer(i, shown));
            const acq = el('a', `acq${isSold(art) ? ' disabled' : ''}`, isSold(art) ? 'Sold' : 'Acquire');
            acq.href = isSold(art) ? '#' : waLink(buyMessage(art));
            acq.target = '_blank';
            acq.rel = 'noopener';
            actions.append(view, acq);
            plaque.appendChild(actions);

            bay.append(hang, plaque);
            hall.appendChild(bay);
        });

        if (!shown.length) hall.appendChild(el('p', 'hall-empty', 'New works are being framed — check back soon.'));

        // fade each bay in as it reaches the viewer
        if (bayObserver) bayObserver.disconnect();
        const bays = $$('.bay', hall);
        if (!('IntersectionObserver' in window) || reduceMotion) { bays.forEach(b => b.classList.add('in')); return; }
        bayObserver = new IntersectionObserver(entries => entries.forEach(e => {
            if (e.isIntersecting) { e.target.classList.add('in'); bayObserver.unobserve(e.target); }
        }), { threshold: 0.2 });
        bays.forEach(b => bayObserver.observe(b));
    }

    function onScroll() {
        $('#siteHeader').classList.toggle('scrolled', window.scrollY > 40);
    }

    function setupFilter() {
        $$('.room-filter button').forEach(btn => btn.addEventListener('click', () => {
            $$('.room-filter button').forEach(b => {
                b.classList.toggle('active', b === btn);
                b.setAttribute('aria-selected', String(b === btn));
            });
            const f = btn.dataset.filter;
            shown = f === 'all' ? collection.slice() : collection.filter(a => a.category.toLowerCase() === f.toLowerCase());
            renderCollection();
            // bring the top of the collection back into view so the filtered works are seen from the start
            const top = $('#corridor').getBoundingClientRect().top + window.scrollY;
            if (window.scrollY > top) window.scrollTo({ top, behavior: reduceMotion ? 'auto' : 'smooth' });
        }));
    }

    /* ------------------------------------------------------------------
       Catalogue
       ------------------------------------------------------------------ */
    function renderCatalogue() {
        const rows = $('#catalogueRows');
        rows.textContent = '';
        const preview = $('#catPreview');
        const pimg = preview.querySelector('img');

        collection.forEach((art, i) => {
            const row = el('div', 'cat-row');
            row.setAttribute('role', 'row');
            row.tabIndex = 0;
            row.dataset.cursor = 'view';
            row.appendChild(el('span', 'cat-no', pad2(i + 1)));
            const title = el('span', 'cat-title', art.title);
            title.appendChild(el('small', null, art.category));
            row.appendChild(title);
            row.appendChild(el('span', 'hide-sm', art.medium));
            row.appendChild(el('span', 'hide-sm', art.dimensions));
            row.appendChild(el('span', `cat-price${isSold(art) ? ' sold' : ''}`, isSold(art) ? 'Sold' : formatPrice(art.price)));
            row.addEventListener('click', () => openViewer(i, collection));
            row.addEventListener('keydown', e => { if (e.key === 'Enter') openViewer(i, collection); });

            if (finePointer) {
                row.addEventListener('pointerenter', () => { pimg.src = art.imageUrl; preview.classList.add('show'); });
                row.addEventListener('pointerleave', () => preview.classList.remove('show'));
                row.addEventListener('pointermove', e => {
                    preview.style.left = `${e.clientX + 30}px`;
                    preview.style.top = `${e.clientY - 120}px`;
                });
            }
            rows.appendChild(row);
        });
    }

    /* ------------------------------------------------------------------
       Viewing room
       ------------------------------------------------------------------ */
    const viewer = $('#viewer');
    let vList = [], vIndex = 0, lastFocus = null;

    function fillViewer() {
        const art = vList[vIndex];
        const frame = $('#viewerFrame');
        frame.className = `frame ${frameStyle(art, collection.indexOf(art))}`;
        const img = $('#viewerImg');
        img.onerror = () => { img.src = fallbackImage(art.title); };
        img.src = art.imageUrl;
        img.alt = `${art.title} — ${art.medium}`;
        $('#viewerCategory').textContent = art.category;
        $('#viewerTitle').textContent = art.title;
        $('#viewerMedium').textContent = art.medium;
        $('#viewerSize').textContent = art.dimensions;
        $('#viewerStatus').textContent = isSold(art) ? 'In a private collection' : 'Available';
        $('#viewerDesc').textContent = art.description || '';
        $('#viewerPrice').textContent = isSold(art) ? 'Sold' : formatPrice(art.price);
        const buy = $('#viewerBuy');
        if (isSold(art)) {
            buy.classList.add('disabled');
            buy.removeAttribute('href');
            buy.innerHTML = 'This work has been collected';
        } else {
            buy.classList.remove('disabled');
            buy.href = waLink(buyMessage(art));
            buy.innerHTML = '<i class="fa-brands fa-whatsapp"></i> Acquire via WhatsApp';
        }
        $('#viewerIndex').textContent = `${pad2(vIndex + 1)} / ${pad2(vList.length)}`;
        const many = vList.length > 1;
        $('#viewerPrev').hidden = !many;
        $('#viewerNext').hidden = !many;
    }

    function openViewer(i, list) {
        if (!list.length) return;
        vList = list; vIndex = i;
        lastFocus = document.activeElement;
        fillViewer();
        viewer.hidden = false;
        document.body.style.overflow = 'hidden';
        requestAnimationFrame(() => requestAnimationFrame(() => viewer.classList.add('open')));
        $('.viewer-close', viewer).focus({ preventScroll: true });
    }

    function closeViewer() {
        viewer.classList.remove('open');
        document.body.style.overflow = '';
        $('#loupe').classList.remove('on');
        setTimeout(() => { viewer.hidden = true; }, reduceMotion ? 0 : 450);
        if (lastFocus) lastFocus.focus({ preventScroll: true });
    }

    function step(d) {
        vIndex = (vIndex + d + vList.length) % vList.length;
        fillViewer();
    }

    function setupViewer() {
        $$('[data-close]', viewer).forEach(n => n.addEventListener('click', closeViewer));
        $('#viewerPrev').addEventListener('click', () => step(-1));
        $('#viewerNext').addEventListener('click', () => step(1));
        document.addEventListener('keydown', e => {
            if (viewer.hidden) return;
            if (e.key === 'Escape') closeViewer();
            if (e.key === 'ArrowLeft') step(-1);
            if (e.key === 'ArrowRight') step(1);
        });

        // Magnifying loupe over the artwork
        const img = $('#viewerImg');
        const loupe = $('#loupe');
        const ZOOM = 2.6;
        if (finePointer) {
            img.addEventListener('pointerenter', () => {
                loupe.style.backgroundImage = `url("${img.currentSrc || img.src}")`;
                loupe.classList.add('on');
            });
            img.addEventListener('pointerleave', () => loupe.classList.remove('on'));
            img.addEventListener('pointermove', e => {
                const r = img.getBoundingClientRect();
                const x = e.clientX - r.left, y = e.clientY - r.top;
                loupe.style.left = `${e.clientX}px`;
                loupe.style.top = `${e.clientY}px`;
                loupe.style.backgroundSize = `${r.width * ZOOM}px ${r.height * ZOOM}px`;
                loupe.style.backgroundPosition = `${-(x * ZOOM - 95)}px ${-(y * ZOOM - 95)}px`;
            });
        }
    }

    /* ------------------------------------------------------------------
       Cursor, reveal, nav, curtain
       ------------------------------------------------------------------ */
    function setupCursor() {
        if (!finePointer || reduceMotion) return;
        const c = $('.cursor');
        let x = innerWidth / 2, y = innerHeight / 2, cx = x, cy = y;
        document.addEventListener('pointermove', e => {
            x = e.clientX; y = e.clientY;
            document.body.classList.add('has-cursor');
            const t = e.target.closest('[data-cursor="view"], .cat-row:not(.cat-head)');
            const link = !t && e.target.closest('a, button');
            c.classList.toggle('is-view', !!t && viewer.hidden);
            c.classList.toggle('is-link', !!link);
        });
        document.addEventListener('pointerleave', () => document.body.classList.remove('has-cursor'));
        (function follow() {
            cx += (x - cx) * 0.2; cy += (y - cy) * 0.2;
            c.style.transform = `translate3d(${cx}px, ${cy}px, 0)`;
            requestAnimationFrame(follow);
        })();
    }

    function setupReveal() {
        const items = $$('.reveal');
        if (!('IntersectionObserver' in window) || reduceMotion) { items.forEach(n => n.classList.add('in')); return; }
        const io = new IntersectionObserver(entries => entries.forEach(e => {
            if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
        }), { threshold: 0.15 });
        items.forEach(n => io.observe(n));
    }

    function setupNavSpy() {
        const links = $$('.site-nav a');
        const io = new IntersectionObserver(entries => entries.forEach(e => {
            if (!e.isIntersecting) return;
            links.forEach(l => l.classList.toggle('active', l.getAttribute('href') === '#' + e.target.id));
        }), { rootMargin: '-45% 0px -45% 0px' });
        ['corridor', 'catalogue', 'artist', 'acquire'].forEach(id => io.observe(document.getElementById(id)));
    }

    function openCurtain() {
        document.body.classList.add('opened');
        setTimeout(() => document.body.classList.remove('is-loading'), reduceMotion ? 0 : 1200);
    }

    /* ------------------------------------------------------------------
       Boot
       ------------------------------------------------------------------ */
    async function init() {
        bindIdentity();
        setupCursor();
        setupViewer();
        setupFilter();
        setupReveal();
        setupNavSpy();
        window.addEventListener('scroll', onScroll, { passive: true });

        // never keep visitors behind the curtain for long, even on a slow sheet
        const started = Date.now();
        const safety = setTimeout(openCurtain, 3500);

        collection = await loadCollection();
        shown = collection.slice();
        $('#previewRibbon').hidden = !usingSamples;

        renderEntrance();
        renderCollection();
        renderCatalogue();
        onScroll();

        const wait = reduceMotion ? 0 : Math.max(0, 1100 - (Date.now() - started));
        setTimeout(() => { clearTimeout(safety); openCurtain(); }, wait);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
