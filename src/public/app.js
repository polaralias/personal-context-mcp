const API_BASE = '/api';
let masterKey = null;

// Initialization
document.addEventListener('DOMContentLoaded', async () => {
    // Show login view by default
    document.getElementById('view-login').classList.remove('hidden');
    document.getElementById('view-config-entry').classList.add('hidden');
    document.getElementById('view-footer').classList.remove('hidden');
});

async function handleLogin(event) {
    event.preventDefault();
    const input = document.getElementById('master-key-input');
    const key = input.value;
    const errorDiv = document.getElementById('login-error');

    errorDiv.classList.add('hidden');

    try {
        const res = await fetch(`${API_BASE}/verify-master-key`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ masterKey: key })
        });

        if (res.ok) {
            masterKey = key;
            showProvisioning();
        } else {
            errorDiv.innerText = 'Invalid Master Key';
            errorDiv.classList.remove('hidden');
        }
    } catch (e) {
        errorDiv.innerText = 'Login failed. Server might be down.';
        errorDiv.classList.remove('hidden');
    }
}

async function showProvisioning() {
    document.getElementById('view-login').classList.add('hidden');
    document.getElementById('view-config-entry').classList.remove('hidden');

    // Load schema
    try {
        const res = await fetch(`${API_BASE}/api-keys/schema`);
        if (res.ok) {
            const schema = await res.json();
            renderConfigForm(schema);
        }
    } catch (e) {
        console.error("Failed to fetch schema", e);
    }
}

// Connection management functions removed for security.
// Only provisioning flow is supported.

// --- User Bound API Key Flow ---

function renderConfigForm(schema) {
    const container = document.getElementById('config-fields-container');
    container.innerHTML = (schema || []).map(field => {
        const requiredMark = field.required ? '<span class="text-red-500">*</span>' : '';
        const helpText = field.helpText ? `<p class="text-xs text-gray-500 mt-1">${field.helpText}</p>` : '';

        let inputHtml = '';
        if (field.type === 'select') {
            const options = (field.options || []).map(opt => `<option value="${opt.value}">${opt.label}</option>`).join('');
            inputHtml = `<select name="${field.name}" ${field.required ? 'required' : ''} class="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none">${options}</select>`;
        } else if (field.type === 'checkbox') {
            inputHtml = `
                <label class="flex items-center space-x-2 cursor-pointer">
                    <input type="checkbox" name="${field.name}" class="form-checkbox h-4 w-4 text-blue-600">
                    <span class="text-sm text-gray-700">${field.label}</span>
                </label>`;
            return `<div class="p-2 bg-gray-50 rounded">${inputHtml}${helpText}</div>`;
        } else if (field.type === 'json') {
            // Render JSON fields as textarea with monospace font
            inputHtml = `<textarea name="${field.name}" ${field.required ? 'required' : ''} rows="3" class="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm" placeholder="${field.placeholder || '{}'}" data-type="json"></textarea>`;
        } else {
            const type = field.type === 'password' ? 'password' : 'text';
            inputHtml = `<input type="${type}" name="${field.name}" ${field.required ? 'required' : ''} class="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none" placeholder="${field.placeholder || ''}">`;
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
        if (input.type === 'checkbox') {
            formData[input.name] = input.checked;
        } else if (input.dataset.type === 'json') {
            // Parse JSON fields
            try {
                formData[input.name] = input.value ? JSON.parse(input.value) : null;
            } catch {
                formData[input.name] = input.value;
            }
        } else {
            formData[input.name] = input.value;
        }
    });

    try {
        const res = await fetch(`${API_BASE}/api-keys`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Master-Key': masterKey
            },
            body: JSON.stringify(formData)
        });
        const data = await res.json();

        if (data.error) throw new Error(data.error);

        // Success
        document.getElementById('user-bound-form').classList.add('hidden');
        document.getElementById('api-key-result').classList.remove('hidden');
        document.getElementById('new-api-key-display').innerText = data.apiKey;

        // Ensure the key is cleared from the UI after a timeout if the user doesn't copy it
        setTimeout(() => {
            const display = document.getElementById('new-api-key-display');
            if (display && display.innerText !== '(Key cleared for security)') {
                display.innerText = '(Key cleared for security)';
            }
        }, 60000); // 1 minute visibility
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
