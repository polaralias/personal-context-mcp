const API_BASE = '/api';

let currentConnectionId = null;

document.addEventListener('DOMContentLoaded', () => {
    fetchConfigStatus();
    loadConnections();
});

// 1. Check if MASTER_KEY is configured on the server
async function fetchConfigStatus() {
    const banner = document.getElementById('config-status-banner');
    const title = document.getElementById('status-title');
    const message = document.getElementById('status-message');
    const guidance = document.getElementById('status-guidance');

    try {
        const res = await fetch(`${API_BASE}/config-status`);
        const data = await res.json();

        banner.classList.remove('hidden');

        if (data.status === 'present') {
            banner.className = 'mb-8 p-6 rounded-xl border-l-4 shadow-sm bg-green-50 border-green-500 text-green-900';
            title.innerText = 'Server Securely Configured';
            message.innerText = 'The system is ready. Your keys are encrypted with the Master Key.';
            guidance.classList.add('hidden');
        } else {
            banner.className = 'mb-8 p-6 rounded-xl border-l-4 shadow-sm bg-red-50 border-red-500 text-red-900';
            title.innerText = 'Configuration Required';
            message.innerText = 'The MASTER_KEY environment variable is missing. Setup cannot proceed.';
            guidance.classList.remove('hidden');
        }
    } catch (e) {
        console.error('Config fetch error', e);
    }
}

// 2. Navigation
function showCreate() {
    document.getElementById('view-dashboard').classList.add('hidden');
    document.getElementById('view-create').classList.remove('hidden');
}

function hideCreate() {
    document.getElementById('view-create').classList.add('hidden');
    document.getElementById('view-dashboard').classList.remove('hidden');
}

function hideDetail() {
    document.getElementById('view-detail').classList.add('hidden');
    document.getElementById('view-dashboard').classList.remove('hidden');
    currentConnectionId = null;
    document.getElementById('session-output').classList.add('hidden');
}

// 3. Load Connections from Backend
async function loadConnections() {
    const container = document.getElementById('list-container');
    try {
        const res = await fetch(`${API_BASE}/connections`);
        const data = await res.json();

        if (data.length === 0) {
            container.innerHTML = '<div class="text-center py-12 text-gray-500 italic">No active connections found.</div>';
            return;
        }

        container.innerHTML = data.map(conn => `
            <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center transition hover:shadow-md">
                <div>
                    <h3 class="font-bold text-lg">${conn.displayName || conn.name || 'Unnamed Connection'}</h3>
                    <span class="text-xs font-mono text-gray-400 uppercase tracking-widest">${conn.id.substring(0, 8)}</span>
                </div>
                <button onclick="viewConnection('${conn.id}')" class="text-indigo-600 font-bold hover:underline">Manage</button>
            </div>
        `).join('');
    } catch (e) {
        container.innerHTML = '<p class="text-red-500">Failed to load connection data.</p>';
    }
}

// View Connection Detail (Missing in prompt but required for UI)
async function viewConnection(id) {
    currentConnectionId = id;
    const detailView = document.getElementById('view-detail');
    const dashboardView = document.getElementById('view-dashboard');
    const detailContent = document.getElementById('detail-content');

    dashboardView.classList.add('hidden');
    detailView.classList.remove('hidden');

    try {
        const res = await fetch(`${API_BASE}/connections/${id}`);
        const data = await res.json();

        document.getElementById('detail-title').innerText = data.displayName || data.name || 'Connection Details';

        // Render details
        detailContent.innerHTML = Object.entries(data)
            .filter(([k]) => k !== 'configEncrypted' && k !== 'config')
            .map(([k, v]) => `
                <div class="mb-2">
                    <span class="font-semibold text-gray-500 block uppercase text-xs tracking-wider">${k}</span>
                    <span class="font-mono text-gray-800 break-all">${v}</span>
                </div>
            `).join('');

    } catch (e) {
        detailContent.innerHTML = '<p class="text-red-500">Failed to load details</p>';
    }
}


// 4. Save New Connection
async function handleSave(event) {
    event.preventDefault();
    const btn = document.getElementById('save-btn');
    btn.disabled = true;
    btn.innerText = 'Securing...';

    const payload = {
        displayName: document.getElementById('conn-name').value, // Matches backend expectation
        config: { apiKey: document.getElementById('conn-apiKey').value }
    };

    try {
        const res = await fetch(`${API_BASE}/connections`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (data.error) throw new Error(data.error);

        hideCreate();
        loadConnections();
    } catch (e) {
        alert("Error: " + e.message);
    } finally {
        btn.disabled = false;
        btn.innerText = 'Authorize Connection';
    }
}

// 5. Generate Session Token
async function createSession() {
    if (!currentConnectionId) return;

    try {
        const res = await fetch(`${API_BASE}/sessions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ connectionId: currentConnectionId })
        });

        const data = await res.json();

        if (data.error) {
            alert("Error: " + (data.message || data.error));
            return;
        }

        document.getElementById('session-output').classList.remove('hidden');
        document.getElementById('token-display').innerText = data.accessToken;
    } catch (e) {
        alert("Failed to generate token");
    }
}

// Helper: Copy to Clipboard
function copyToken() {
    const text = document.getElementById('token-display').innerText;
    navigator.clipboard.writeText(text).then(() => alert('Copied!'));
}
