const WEBHOOK_URL = 'https://hook.us2.make.com/rcachgdwllagyl783kcbavrhf4a1hnrf';
const CACHE_KEY = 'hilex_cache';

// Supabase Live Feed
const SUPABASE_URL = 'https://ussceuooawbprpmxcmxg.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVzc2NldW9vYXdicHJwbXhjbXhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMzA5NjQsImV4cCI6MjA4OTYwNjk2NH0.mpoWD_X6rc71X_9p3q8P00JUYXOC9XyUF4T7HfGeaWw';
const supabase = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;
let livePriceMap = {};

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

    // Top 10 Table (Simplified: Rank, Pair, Quoted, Consistency, Signal, Routes)
    const top10 = (data.top_discrepancies || []).slice(0, 10);
    top10Body.innerHTML = top10.map((item, index) => {
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

// --- LIVE PRICES LOGIC ---
async function fetchInitialLivePrices() {
    const livePricesBody = document.getElementById('live-prices-body');
    if (!livePricesBody || !supabase) return;

    const { data, error } = await supabase
        .from('live_prices')
        .select('currency_pair, forward_price')
        .order('currency_pair', { ascending: true });

    if (error) {
        console.error('Error fetching live prices:', error);
        livePricesBody.innerHTML = '<tr><td colspan="2" class="empty-state" style="color: var(--danger)">Connection to feed failed.</td></tr>';
        return;
    }

    if (!data || data.length === 0) {
        livePricesBody.innerHTML = '<tr><td colspan="2" class="empty-state">No live prices available.</td></tr>';
        return;
    }

    livePricesBody.innerHTML = data.map(item => {
        livePriceMap[item.currency_pair] = item.forward_price;
        return `
            <tr data-pair="${item.currency_pair}" class="clickable-row">
                <td>
                    <span class="pair-link">${item.currency_pair}</span>
                </td>
                <td class="price-cell live-forward-cell" style="text-align: right;" data-val="${item.forward_price}">
                    ${Number(item.forward_price).toFixed(4)}
                </td>
            </tr>
        `;
    }).join('');

    setupLivePriceSubscription();
}

function setupLivePriceSubscription() {
    if (!supabase) return;
    supabase.channel('public:live_prices')
        .on('postgres_changes', { 
            event: 'UPDATE', 
            schema: 'public', 
            table: 'live_prices' 
        }, (payload) => {
            const { currency_pair, forward_price } = payload.new;
            updateLivePriceInUI(currency_pair, forward_price);
        })
        .subscribe();
}

function updateLivePriceInUI(pair, newPrice) {
    const oldPrice = livePriceMap[pair] || 0;
    livePriceMap[pair] = newPrice;

    const row = document.querySelector(`#live-prices-body tr[data-pair="${pair}"]`);
    if (!row) return;

    const cell = row.querySelector('.live-forward-cell');
    if (cell) {
        cell.textContent = Number(newPrice).toFixed(4);
        cell.setAttribute('data-val', newPrice);
        
        // Remove old classes so we can restart the animation
        cell.classList.remove('price-up', 'price-down');
        
        // Force reflow
        void cell.offsetWidth; 
        
        if (newPrice >= oldPrice) {
            cell.classList.add('price-up');
        } else {
            cell.classList.add('price-down');
        }
    }
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

    // Start Live Feed
    fetchInitialLivePrices();
}

init();
