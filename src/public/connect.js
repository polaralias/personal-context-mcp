document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    const fields = ['client_id', 'redirect_uri', 'state', 'code_challenge', 'code_challenge_method'];
    const err = document.getElementById('error-msg');
    const schemaStatus = document.getElementById('schema-status');

    const required = ['client_id', 'redirect_uri', 'code_challenge', 'code_challenge_method'];
    const missing = required.filter(f => !params.get(f));

    if (missing.length > 0) {
        err.innerText = `Missing required parameters: ${missing.join(', ')}`;
        err.classList.remove('hidden');
        document.getElementById('submit-btn').disabled = true;
    }

    fields.forEach(f => {
        const el = document.getElementById(f);
        if (el) el.value = params.get(f) || '';
    });

    let schema = null;
    try {
        schemaStatus.innerText = 'Loading fields...';
        schema = await fetchSchema(['/api/connect-schema', '/api/config-schema']);
        if (schema && Array.isArray(schema.fields)) {
            renderFields(schema.fields, document.getElementById('connection-fields-container'));
            schemaStatus.innerText = '';
        } else {
            schemaStatus.innerText = 'No schema provided';
        }
    } catch (e) {
        schemaStatus.innerText = 'Failed to load fields';
    }

    document.getElementById('connect-form').addEventListener('submit', async (e) => {
        e.preventDefault();

        const btn = document.getElementById('submit-btn');
        const originalText = btn.innerText;
        btn.innerText = 'Connecting...';
        btn.disabled = true;
        err.classList.add('hidden');
        err.innerText = '';

        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData.entries());

        const config = {};
        const container = document.getElementById('connection-fields-container');
        const inputs = container.querySelectorAll('input, select, textarea');

        inputs.forEach(el => {
            const name = el.name || el.id;
            if (!name) return;

            if (el.type === 'checkbox') {
                config[name] = el.checked;
                return;
            }

            if (el.dataset && el.dataset.format === 'csv') {
                config[name] = String(el.value || '').split(',').map(s => s.trim()).filter(Boolean);
                return;
            }

            if (el.dataset && el.dataset.format === 'json') {
                const raw = String(el.value || '').trim();
                config[name] = raw ? JSON.parse(raw) : null;
                return;
            }

            config[name] = el.value;
        });

        const payload = {
            client_id: data.client_id,
            redirect_uri: data.redirect_uri,
            state: data.state,
            code_challenge: data.code_challenge,
            code_challenge_method: data.code_challenge_method,
            csrf_token: data.csrf_token,
            name: data.name,
            config
        };

        try {
            const res = await fetch('/oauth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const out = await res.json();
            if (!res.ok) {
                throw new Error(out.error || 'Connection failed');
            }

            if (out.redirectUrl) {
                window.location.href = out.redirectUrl;
                return;
            }

            throw new Error('No redirect URL returned');
        } catch (ex) {
            err.innerText = ex.message;
            err.classList.remove('hidden');
        } finally {
            btn.innerText = originalText;
            btn.disabled = false;
        }
    });
});

async function fetchSchema(paths) {
    for (const p of paths) {
        const res = await fetch(p);
        if (res.ok) return await res.json();
    }
    return null;
}

function renderFields(fields, container) {
    container.innerHTML = '';

    fields.forEach(field => {
        const wrapper = document.createElement('div');
        wrapper.className = 'space-y-2';

        const label = document.createElement('label');
        label.className = 'block text-sm font-bold text-slate-300 uppercase tracking-wider ml-1';
        label.innerText = field.label || field.name;
        wrapper.appendChild(label);

        let input;
        const commonClasses = 'w-full h-12 bg-black/40 border border-white/10 rounded-xl px-4 text-white focus:outline-none focus:border-brand-500 transition-all placeholder:text-slate-600';

        if (field.type === 'select') {
            input = document.createElement('select');
            input.className = commonClasses;
            (field.options || []).forEach(opt => {
                const option = document.createElement('option');
                option.style.backgroundColor = '#1e1b4b'; // Matches indigo-950
                option.value = opt.value;
                option.innerText = opt.label;
                input.appendChild(option);
            });
        } else if (field.type === 'checkbox') {
            const checkboxWrapper = document.createElement('div');
            checkboxWrapper.className = 'flex items-center bg-black/30 border border-white/10 rounded-xl p-4 group hover:bg-black/50 transition-colors';

            input = document.createElement('input');
            input.type = 'checkbox';
            input.id = field.name;
            input.name = field.name;
            input.className = 'w-5 h-5 rounded border-white/20 bg-black/40 text-brand-500 focus:ring-brand-500 focus:ring-offset-black';

            const cbLabel = document.createElement('span');
            cbLabel.className = 'ml-3 text-sm text-slate-300 font-medium';
            cbLabel.innerText = field.description || '';

            checkboxWrapper.appendChild(input);
            checkboxWrapper.appendChild(cbLabel);
            wrapper.appendChild(checkboxWrapper);

            if (field.required) input.required = true;
            container.appendChild(wrapper);
            return;
        } else if (field.type === 'textarea') {
            input = document.createElement('textarea');
            input.className = commonClasses.replace('h-12', 'h-32') + ' py-3';
            input.rows = field.rows || 4;
            input.placeholder = field.placeholder || '';
        } else {
            input = document.createElement('input');
            input.type = field.type === 'password' ? 'password' : 'text';
            input.className = commonClasses;
            input.placeholder = field.placeholder || '';
        }

        input.id = field.name;
        input.name = field.name;
        if (field.required) input.required = true;
        if (field.format) input.dataset.format = field.format;

        wrapper.appendChild(input);

        if (field.description && field.type !== 'checkbox') {
            const hint = document.createElement('p');
            hint.className = 'text-[10px] text-slate-500 mt-1 ml-1 italic';
            hint.innerText = field.description;
            wrapper.appendChild(hint);
        }

        container.appendChild(wrapper);
    });
}
