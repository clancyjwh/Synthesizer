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
        totalComparisonsEl.textContent = data.run_meta.total_results_after_dedup || 0;
    }

    // Market Alert
    if (data.market_alert) {
        alertContainer.classList.remove('hidden');
        alertAsset.textContent = data.market_alert.asset;
        alertCard.onclick = () => openModal('Market Analysis: ' + data.market_alert.asset, data.market_alert.message);
    } else {
        alertContainer.classList.add('hidden');
    }

    // Top 10 Table (Simplified: Rank, Pair, Quoted, Synthetic, Observation)
    const top10 = (data.top_discrepancies || []).slice(0, 10);
    top10Body.innerHTML = top10.map((item, index) => `
        <tr class="clickable-row">
            <td>${item.rank || index + 1}</td>
            <td>
                <a href="details.html?pair=${encodeURIComponent(item.pair)}" target="_blank" class="pair-link">
                    ${item.pair}
                </a>
            </td>
            <td class="price-cell">${item.quoted_price}</td>
            <td class="price-cell">${item.synthetic_price}</td>
            <td onclick="openModal('Observation: ${item.pair}', \`${item.observation}\`)">
                <span class="observation-text">${item.observation}</span>
            </td>
        </tr>
    `).join('') || '<tr><td colspan="5" class="empty-state">No discrepancies found.</td></tr>';


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
