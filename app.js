const WEBHOOK_URL = 'https://hook.us2.make.com/rcachgdwllagyl783kcbavrhf4a1hnrf';
const CACHE_KEY = 'hilex_cache';

// Elements
const refreshBtn = document.getElementById('refresh-btn');
const btnText = document.getElementById('btn-text');
const spinner = document.getElementById('spinner');
const lastRefreshEl = document.getElementById('last-refresh');
const totalComparisonsEl = document.getElementById('total-comparisons');
const top10Body = document.getElementById('top-10-body');
const allResultsBody = document.getElementById('all-results-body');
const errorToast = document.getElementById('error-toast');

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
        totalComparisonsEl.textContent = data.run_meta.total_comparisons || 0;
    }

    // Top 10 Table
    const top10 = (data.top_10 || []).slice(0, 10);
    top10Body.innerHTML = top10.map((item, index) => `
        <tr>
            <td>${index + 1}</td>
            <td style="font-weight: 700;">${item.pair}</td>
            <td>
                <span class="signal-label ${item.signal.toLowerCase() === 'buy' ? 'signal-buy' : 'signal-sell'}">
                    ${item.signal}
                </span>
            </td>
            <td class="price-cell">${item.quoted_price}</td>
            <td class="price-cell">${item.synthetic_price}</td>
            <td class="bps-cell" style="color: ${item.bps >= 0 ? 'var(--success)' : 'var(--danger)'}">
                ${item.bps > 0 ? '+' : ''}${item.bps.toFixed(2)} bps
            </td>
            <td class="route-cell">${item.route_calc}</td>
            <td class="observation-cell">${item.observation}</td>
        </tr>
    `).join('') || '<tr><td colspan="8" class="empty-state">No discrepancies found.</td></tr>';

    // All Results Table
    const allResults = data.all_results || [];
    allResultsBody.innerHTML = allResults.map(item => `
        <tr>
            <td>${item.pair}</td>
            <td class="bps-cell">${item.bps.toFixed(2)} bps</td>
            <td>
                <span class="signal-label ${item.signal.toLowerCase() === 'buy' ? 'signal-buy' : 'signal-sell'}">
                    ${item.signal}
                </span>
            </td>
        </tr>
    `).join('');
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
}

init();
