const API_BASE = '/api';
let currentConnectionId = null;

// Initialization
document.addEventListener('DOMContentLoaded', async () => {
    // Try to load user-bound config schema first
    try {
        const res = await fetch(`${API_BASE}/api-keys/schema`);
        if (res.ok) {
            const schema = await res.json();
            renderConfigForm(schema);
            document.getElementById('view-dashboard').classList.add('hidden');
            document.getElementById('view-config-entry').classList.remove('hidden');
            await fetchConfigStatus();
            return;
        }
    } catch (e) {
        console.log("Not in user-bound mode or failed to fetch schema", e);
    }

    // Fallback to existing dashboard logic
    await fetchConfigStatus();
    loadConnections();
});

async function fetchConfigStatus() {
    const banner = document.getElementById('config-status-banner');
    const icon = document.getElementById('status-icon');
    const title = document.getElementById('status-title');
    const message = document.getElementById('status-message');
    const guidance = document.getElementById('status-guidance');

    try {
        // Prefer /api/config-status
        const res = await fetch(`${API_BASE}/config-status`);
        const data = await res.json();

        banner.classList.remove('hidden');
        if (data.status === 'present') {
            banner.className = 'mb-6 p-4 rounded-lg border bg-green-50 border-green-200 text-green-800';
            icon.innerHTML = '✅';
            title.innerText = 'Configured';
            // Don't show format/isFallback if not present
            const details = data.format ? ` (${data.format}${data.isFallback ? ', using fallback' : ''})` : '';
            message.innerText = `Master key is present${details}`;
            guidance.classList.add('hidden');
        } else {
            banner.className = 'mb-6 p-4 rounded-lg border bg-red-50 border-red-200 text-red-800';
            icon.innerHTML = '❌';
            title.innerText = 'Server not configured: MASTER_KEY missing';
            message.innerText = 'Please set the MASTER_KEY environment variable.';
            guidance.classList.remove('hidden');
        }
    } catch (e) {
        // Fallback to /api/master-key-status
        try {
            const res = await fetch(`${API_BASE}/master-key-status`);
            const data = await res.json();
            
            banner.classList.remove('hidden');
            if (data.configured) {
                banner.className = 'mb-6 p-4 rounded-lg border bg-green-50 border-green-200 text-green-800';
                icon.innerHTML = '✅';
                title.innerText = 'Configured';
                message.innerText = 'Master key is present';
                guidance.classList.add('hidden');
            } else {
                banner.className = 'mb-6 p-4 rounded-lg border bg-red-50 border-red-200 text-red-800';
                icon.innerHTML = '❌';
                title.innerText = 'Server not configured: MASTER_KEY missing';
                message.innerText = 'Please set the MASTER_KEY environment variable.';
                guidance.classList.remove('hidden');
            }
        } catch (e2) {
            console.error('Failed to fetch config status', e2);
        }
    }
}

function showCreate() {
    document.getElementById('view-dashboard').classList.add('hidden');
    document.getElementById('view-detail').classList.add('hidden');
    document.getElementById('view-create').classList.remove('hidden');
    
    // Load config schema to render fields
    fetch(`${API_BASE}/config-schema`)
        .then(res => res.json())
        .then(schema => {
            renderCreateForm(schema);
        })
        .catch(e => {
            console.error('Failed to load config schema', e);
        });
}

function hideCreate() {
    document.getElementById('view-create').classList.add('hidden');
    document.getElementById('view-dashboard').classList.remove('hidden');
    document.getElementById('config-form').reset();
}

function hideDetail() {
    document.getElementById('view-detail').classList.add('hidden');
    document.getElementById('view-dashboard').classList.remove('hidden');
    currentConnectionId = null;
}

async function loadConnections() {
    try {
        const res = await fetch(`${API_BASE}/connections`);
        const banner = document.getElementById('config-status-banner');
        const isUnconfigured = banner && !banner.classList.contains('hidden') && banner.classList.contains('bg-red-50');

        if (res.status === 500) {
            const data = await res.json();

            // If the banner already shows the server is not configured, don't repeat the error in the list
            if (isUnconfigured && data.error && data.error.includes('MASTER_KEY')) {
                document.getElementById('list-container').innerHTML = '';
                return;
            }

            document.getElementById('list-container').innerHTML = `<p class="text-red-600">Error: ${data.error}</p>`;
            return;
        }
        const data = await res.json();
        const container = document.getElementById('list-container');

        if (data.length === 0) {
            container.innerHTML = '<p class="text-gray-500 text-center">No connections found.</p>';
            return;
        }

        container.innerHTML = data.map(conn => {
            const displayName = conn.displayName || conn.name;
            return `
            <div class="bg-white border rounded p-4 flex justify-between items-center hover:bg-gray-50 transition">
                <div>
                    <h3 class="font-medium text-gray-800">${displayName}</h3>
                    <p class="text-xs text-gray-500">ID: ${conn.id}</p>
                </div>
                <div class="space-x-2">
                    <button onclick="viewConnection('${conn.id}')" class="text-blue-600 hover:text-blue-800 text-sm font-medium">Manage</button>
                </div>
            </div>
        `;
        }).join('');
    } catch (e) {
        console.error(e);
        document.getElementById('list-container').innerHTML = '<p class="text-red-600">Failed to load connections.</p>';
    }
}

function renderCreateForm(schema) {
    const container = document.getElementById('config-fields-form');
    const fields = schema.fields || [];
    
    container.innerHTML = fields.map(field => {
        const requiredMark = field.required ? '<span class="text-red-500">*</span>' : '';
        const helpText = field.helpText ? `<p class="text-xs text-gray-500 mt-1">${field.helpText}</p>` : '';

        let inputHtml = '';
        if (field.type === 'json') {
            // Render JSON as textarea
            inputHtml = `<textarea name="${field.name}" ${field.required ? 'required' : ''} rows="3" class="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm" placeholder="${field.helpText || ''}">${field.default || ''}</textarea>`;
        } else if (field.type === 'password') {
            inputHtml = `<input type="password" name="${field.name}" ${field.required ? 'required' : ''} class="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none" placeholder="${field.helpText || ''}">`;
        } else {
            inputHtml = `<input type="text" name="${field.name}" ${field.required ? 'required' : ''} class="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none" placeholder="${field.helpText || ''}">`;
        }

        return `
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">${field.label || field.name} ${requiredMark}</label>
                ${inputHtml}
                ${helpText}
            </div>
        `;
    }).join('');
}

async function handleSave(event) {
    event.preventDefault();
    const btn = document.getElementById('save-btn');
    const originalText = btn.innerText;
    btn.disabled = true;
    btn.innerText = 'Saving...';

    const name = document.getElementById('conn-name').value || 'New Connection';
    const displayName = name;
    
    // Extract config from form
    const config = {};
    const form = document.getElementById('config-form');
    const inputs = form.querySelectorAll('#config-fields-form input, #config-fields-form textarea');
    inputs.forEach(input => {
        if (!input.name) return;
        let value = input.value;
        // Try to parse JSON fields
        if (input.tagName === 'TEXTAREA' && value) {
            try {
                value = JSON.parse(value);
            } catch (e) {
                // Keep as string if not valid JSON
            }
        }
        config[input.name] = value;
    });

    try {
        // Create Connection - send both name and displayName
        const res = await fetch(`${API_BASE}/connections`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, displayName, config })
        });
        const connData = await res.json();

        if (connData.error) throw new Error(connData.error);

        // Dashboard Mode: Return to list
        hideCreate();
        loadConnections();
    } catch (e) {
        alert(e.message);
    } finally {
        btn.disabled = false;
        btn.innerText = originalText;
    }
}

async function viewConnection(id) {
    currentConnectionId = id;
    try {
        const res = await fetch(`${API_BASE}/connections/${id}`);
        const data = await res.json();

        document.getElementById('view-dashboard').classList.add('hidden');
        document.getElementById('view-detail').classList.remove('hidden');
        document.getElementById('session-output').classList.add('hidden');

        const displayName = data.displayName || data.name;
        const createdAt = data.createdAt ? new Date(data.createdAt).toLocaleString() : 'N/A';
        const updatedAt = data.updatedAt ? new Date(data.updatedAt).toLocaleString() : 'N/A';
        
        document.getElementById('detail-content').innerHTML = `
            <div class="grid grid-cols-2 gap-x-4 gap-y-2">
                <span class="font-medium text-gray-600">Name:</span> <span class="text-gray-900">${displayName}</span>
                <span class="font-medium text-gray-600">ID:</span> <span class="text-gray-900 text-xs font-mono">${data.id}</span>
                <span class="font-medium text-gray-600">Created:</span> <span class="text-gray-900 text-xs">${createdAt}</span>
                ${data.updatedAt ? `<span class="font-medium text-gray-600">Updated:</span> <span class="text-gray-900 text-xs">${updatedAt}</span>` : ''}
            </div>
        `;
    } catch (e) {
        console.error(e);
        alert('Failed to load connection details');
    }
}

async function createSession() {
    if (!currentConnectionId) return;

    try {
        const res = await fetch(`${API_BASE}/sessions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ connectionId: currentConnectionId })
        });
        const data = await res.json();

        if (data.error) throw new Error(data.error);

        document.getElementById('session-output').classList.remove('hidden');
        document.getElementById('token-display').innerText = data.accessToken;
    } catch (e) {
        alert(e.message);
    }
}

function copyToken() {
    const text = document.getElementById('token-display').innerText;
    navigator.clipboard.writeText(text).then(() => {
        alert('Copied to clipboard!');
    });
}

// --- User Bound API Key Flow ---

function renderConfigForm(schema) {
    const container = document.getElementById('config-fields-container');
    container.innerHTML = schema.map(field => {
        const requiredMark = field.required ? '<span class="text-red-500">*</span>' : '';
        const helpText = field.helpText ? `<p class="text-xs text-gray-500 mt-1">${field.helpText}</p>` : '';

        let inputHtml = '';
        if (field.type === 'json') {
            // Render JSON as textarea with monospace font
            inputHtml = `<textarea name="${field.name}" ${field.required ? 'required' : ''} rows="3" class="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm" placeholder="${field.helpText || ''}">${field.default || ''}</textarea>`;
        } else if (field.type === 'password') {
            inputHtml = `<input type="password" name="${field.name}" ${field.required ? 'required' : ''} class="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none" placeholder="${field.helpText || ''}">`;
        } else {
            inputHtml = `<input type="text" name="${field.name}" ${field.required ? 'required' : ''} class="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none" placeholder="${field.helpText || ''}">`;
        }

        return `
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">${field.label} ${requiredMark}</label>
                ${inputHtml}
                ${helpText}
            </div>
        `;
    }).join('');
}

async function handleUserBoundSubmit(event) {
    event.preventDefault();
    const btn = document.getElementById('issue-btn');
    const originalText = btn.innerText;
    btn.disabled = true;
    btn.innerText = 'Issuing...';

    const form = event.target;
    // Extract data
    const formData = {};
    // Iterate inputs
    const inputs = form.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
        if (!input.name) return;
        let value = input.value;
        // Try to parse JSON fields
        if (input.tagName === 'TEXTAREA' && value) {
            try {
                value = JSON.parse(value);
            } catch (e) {
                // Keep as string if not valid JSON
            }
        }
        formData[input.name] = value;
    });

    try {
        const res = await fetch(`${API_BASE}/api-keys`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });
        const data = await res.json();

        if (data.error) throw new Error(data.error);

        // Success
        document.getElementById('user-bound-form').classList.add('hidden');
        document.getElementById('api-key-result').classList.remove('hidden');
        document.getElementById('new-api-key-display').innerText = data.apiKey;
    } catch (e) {
        alert(e.message || "Failed to issue key");
    } finally {
        btn.disabled = false;
        btn.innerText = originalText;
    }
}

function copyNewKey() {
    const text = document.getElementById('new-api-key-display').innerText;
    navigator.clipboard.writeText(text).then(() => {
        alert('Copied key to clipboard!');
    });
}

function resetConfigForm() {
    document.getElementById('user-bound-form').reset();
    document.getElementById('user-bound-form').classList.remove('hidden');
    document.getElementById('api-key-result').classList.add('hidden');
}
