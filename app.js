const WEBHOOK_URL = 'https://hook.us2.make.com/rcachgdwllagyl783kcbavrhf4a1hnrf';
const CACHE_KEY = 'hilex_cache';

// Elements
const refreshBtn = document.getElementById('refresh-btn');
const btnText = document.getElementById('btn-text');
const spinner = document.getElementById('spinner');
const lastRefreshEl = document.getElementById('last-refresh');
const totalComparisonsEl = document.getElementById('total-comparisons');
const top10Body = document.getElementById('top-10-body');
const errorToast = document.getElementById('error-toast');

// Market Alert & Modal Elements
const alertContainer = document.getElementById('market-alert-container');
const alertCard = document.getElementById('market-alert-card');
const alertAsset = document.getElementById('alert-asset');
const modalOverlay = document.getElementById('modal-overlay');
const modalTitle = document.getElementById('modal-title');
const modalContent = document.getElementById('modal-content');
const closeModal = document.getElementById('close-modal');

// State Management
let currentData = null;

async function fetchData() {
    setLoading(true);
    try {
        const response = await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) throw new Error('Refresh failed');

        const data = await response.json();
        processData(data);
    } catch (err) {
        showError(err.message);
    } finally {
        setLoading(false);
    }
}

function processData(data) {
    currentData = data;
    localStorage.setItem(CACHE_KEY, JSON.stringify({
        data,
        timestamp: new Date().toISOString()
    }));
    renderUI(data);
}

function renderUI(data) {
    if (!data) return;

    // Update Header
    const cache = localStorage.getItem(CACHE_KEY);
    if (cache) {
        const { timestamp } = JSON.parse(cache);
        lastRefreshEl.textContent = new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
    
    // run_meta extraction
    if (data.run_meta) {
        totalComparisonsEl.textContent = data.run_meta.unique_pairs || 0;
    }

    // Market Alert
    if (data.market_alert) {
        alertContainer.classList.remove('hidden');
        alertAsset.textContent = data.market_alert.pair;
        alertCard.onclick = () => openModal('Market Analysis: ' + data.market_alert.pair, data.market_alert.message);
    } else {
        alertContainer.classList.add('hidden');
    }

    // Top 20 Table (Simplified: Rank, Pair, Quoted, Consistency, Signal, Routes)
    const top20 = (data.top_discrepancies || []).slice(0, 20);
    top10Body.innerHTML = top20.map((item, index) => {
        const consistency = item.consistency_score ? Number(item.consistency_score).toFixed(2) : '0.00';
        const signalClass = item.signal ? (item.signal.toLowerCase() === 'buy' ? 'signal-buy' : 'signal-sell') : '';
        return `
            <tr class="clickable-row">
                <td>${item.rank || index + 1}</td>
                <td>
                    <a href="details.html?pair=${encodeURIComponent(item.pair)}" target="_blank" class="pair-link">
                        ${item.pair}
                    </a>
                </td>
                <td class="price-cell">${item.quoted_price}</td>
                <td class="price-cell">${consistency}</td>
                <td>
                    <span class="signal-label ${signalClass}">${item.signal || ''}</span>
                </td>
                <td>${item.route_count || 0}</td>
            </tr>
        `;
    }).join('') || '<tr><td colspan="6" class="empty-state">No discrepancies found.</td></tr>';


}

function openModal(title, content) {
    modalTitle.textContent = title;
    modalContent.innerHTML = `<p>${content}</p>`;
    modalOverlay.classList.remove('hidden');
}

function closePopup() {
    modalOverlay.classList.add('hidden');
}

function setLoading(isLoading) {
    refreshBtn.disabled = isLoading;
    if (isLoading) {
        btnText.textContent = 'Refreshing...';
        spinner.classList.remove('hidden');
    } else {
        btnText.textContent = 'Refresh Data';
        spinner.classList.add('hidden');
    }
}

function showError(msg) {
    errorToast.textContent = msg;
    errorToast.classList.remove('hidden');
    setTimeout(() => {
        errorToast.classList.add('hidden');
    }, 3000);
}

// Initial Load
function init() {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
        const { data } = JSON.parse(cached);
        processData(data);
    }
    
    refreshBtn.addEventListener('click', fetchData);
    closeModal.addEventListener('click', closePopup);
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) closePopup();
    });
}

init();

/** 
 * --- ISOLATED LIVE MATRIX FEED ---
 * This block is completely independent of the webhook discrepancy logic.
 */
(function() {
    const MATRIX_SUPABASE_URL = 'https://ussceuooawbprpmxcmxg.supabase.co';
    const MATRIX_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVzc2NldW9vYXdicHJwbXhjbXhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMzA5NjQsImV4cCI6MjA4OTYwNjk2NH0.mpoWD_X6rc71X_9p3q8P00JUYXOC9XyUF4T7HfGeaWw';
    let matrixClient = null;
    let matrixPriceMap = {};

    async function startMatrixStream() {
        const gridContainer = document.getElementById('live-matrix-grid');
        if (!gridContainer || !window.supabase) return;

        // 1. Initialize Client
        matrixClient = window.supabase.createClient(MATRIX_SUPABASE_URL, MATRIX_SUPABASE_KEY);

        // 2. Initial Data Fetch
        const { data, error } = await matrixClient
            .from('live_prices')
            .select('currency_pair, forward_price')
            .order('currency_pair', { ascending: true });

        if (error) {
            gridContainer.innerHTML = `<div class="empty-state" style="color: var(--danger)">Connection to matrix feed failed.</div>`;
            return;
        }

        // 3. Render Initial Grid
        gridContainer.innerHTML = data.map(item => {
            matrixPriceMap[item.currency_pair] = Number(item.forward_price);
            return `
                <div id="matrix-card-${item.currency_pair.replace('/', '-')}" class="matrix-card">
                    <span class="matrix-card-pair">${item.currency_pair}</span>
                    <span class="matrix-card-price" data-pair="${item.currency_pair}">
                        ${Number(item.forward_price).toFixed(4)}
                    </span>
                </div>
            `;
        }).join('');

        // 4. Setup Real-time Channel
        matrixClient.channel('matrix-live-updates')
            .on('postgres_changes', { 
                event: 'UPDATE', 
                schema: 'public', 
                table: 'live_prices' 
            }, (payload) => {
                const { currency_pair, forward_price } = payload.new;
                const oldPrice = matrixPriceMap[currency_pair] || 0;
                const newPrice = Number(forward_price);
                matrixPriceMap[currency_pair] = newPrice;

                // Update UI visually
                const card = document.getElementById(`matrix-card-${currency_pair.replace('/', '-')}`);
                const priceSpan = card ? card.querySelector('.matrix-card-price') : null;
                
                if (priceSpan && card) {
                    priceSpan.textContent = newPrice.toFixed(4);
                    
                    // Directional Animation on the CARD background
                    card.classList.remove('matrix-flash-up', 'matrix-flash-down');
                    void card.offsetWidth; // Trigger reflow
                    card.classList.add(newPrice >= oldPrice ? 'matrix-flash-up' : 'matrix-flash-down');
                }
            })
            .subscribe();
    }

    // Wait for DOM and potentially CDN delay
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startMatrixStream);
    } else {
        // If DOM already loaded (common in some envs), small delay to ensure CDN is parsed
        setTimeout(startMatrixStream, 100);
    }
})();
