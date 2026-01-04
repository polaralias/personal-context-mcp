document.addEventListener('DOMContentLoaded', () => {
    const app = {
        init() {
            this.cacheDOM();
            this.bindEvents();
            this.checkConfigStatus();
            this.loadConnections();
            this.handleNavigation();
        },

        cacheDOM() {
            this.statusBanner = document.getElementById('status-banner');
            this.statusText = document.getElementById('status-text');
            this.connectionsList = document.getElementById('connections-list');
            this.connectionForm = document.getElementById('connection-form');
            this.viewDashboard = document.getElementById('view-dashboard');
            this.viewCreate = document.getElementById('view-create');
            this.viewDetail = document.getElementById('view-detail');
            this.detailContent = document.getElementById('detail-content');
            this.btnCreate = document.getElementById('btn-create');
            this.btnBack = document.querySelectorAll('.btn-back');
        },

        bindEvents() {
            this.btnCreate.addEventListener('click', () => this.showView('create'));
            this.btnBack.forEach(btn => btn.addEventListener('click', () => this.showView('dashboard')));
            this.connectionForm.addEventListener('submit', (e) => this.handleCreateConnection(e));
        },

        async checkConfigStatus() {
            try {
                const res = await fetch('/api/config-status');
                const data = await res.json();
                if (data.status === 'missing') {
                    this.statusBanner.classList.remove('hidden');
                    this.statusBanner.classList.add('bg-red-500');
                    this.statusText.textContent = 'MASTER_KEY is missing. Connection creation is disabled.';
                } else {
                    this.statusBanner.classList.add('hidden');
                }
            } catch (err) {
                console.error('Failed to fetch config status', err);
            }
        },

        async loadConnections() {
            try {
                const res = await fetch('/api/connections');
                const connections = await res.json();
                this.renderConnections(connections);
            } catch (err) {
                console.error('Failed to load connections', err);
            }
        },

        renderConnections(connections) {
            this.connectionsList.innerHTML = '';
            if (connections.length === 0) {
                this.connectionsList.innerHTML = '<p class="text-gray-500 italic">No connections found.</p>';
                return;
            }

            connections.forEach(conn => {
                const card = document.createElement('div');
                card.className = 'bg-white p-4 rounded-lg shadow border border-gray-200 hover:border-blue-400 transition cursor-pointer';
                card.innerHTML = `
                    <div class="flex justify-between items-center">
                        <div>
                            <h3 class="font-bold text-lg text-gray-800">${conn.displayName || 'Unnamed Connection'}</h3>
                            <p class="text-xs text-gray-500 font-mono">${conn.id}</p>
                        </div>
                        <span class="px-2 py-1 text-xs rounded bg-blue-100 text-blue-800">Active</span>
                    </div>
                `;
                card.addEventListener('click', () => this.showDetail(conn));
                this.connectionsList.appendChild(card);
            });
        },

        async handleCreateConnection(e) {
            e.preventDefault();
            const formData = new FormData(this.connectionForm);
            const data = {
                displayName: formData.get('displayName'),
                config: JSON.parse(formData.get('config') || '{}')
            };

            try {
                const res = await fetch('/api/connections', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });

                if (!res.ok) {
                    const error = await res.json();
                    alert('Error: ' + (error.error || 'Failed to create connection'));
                    return;
                }

                this.connectionForm.reset();
                this.showView('dashboard');
                this.loadConnections();
            } catch (err) {
                alert('Connection error');
            }
        },

        showDetail(conn) {
            this.detailContent.innerHTML = `
                <div class="space-y-4">
                    <div>
                        <label class="block text-sm font-semibold text-gray-600">ID</label>
                        <p class="font-mono bg-gray-50 p-2 rounded border text-sm">${conn.id}</p>
                    </div>
                    <div>
                        <label class="block text-sm font-semibold text-gray-600">Display Name</label>
                        <p class="text-gray-800">${conn.displayName || 'N/A'}</p>
                    </div>
                    <div>
                        <label class="block text-sm font-semibold text-gray-600">Configuration (Encrypted)</label>
                        <p class="text-xs text-gray-500 italic">Configuration details are stored securely and not displayed here.</p>
                    </div>
                </div>
            `;
            this.showView('detail');
        },

        showView(view) {
            this.viewDashboard.classList.add('hidden');
            this.viewCreate.classList.add('hidden');
            this.viewDetail.classList.add('hidden');

            if (view === 'dashboard') this.viewDashboard.classList.remove('hidden');
            if (view === 'create') this.viewCreate.classList.remove('hidden');
            if (view === 'detail') this.viewDetail.classList.remove('hidden');
        },

        handleNavigation() {
            const params = new URLSearchParams(window.location.search);
            if (params.has('redirect_uri') && params.has('state')) {
                // If OAuth params are present, we might want to redirect to the connect page
                // OR render the connect UI here. The prompt says "render the existing connect/authorisation UI".
                // We'll handle this in the server by sending a different HTML if these params are present, 
                // OR we can handle it here by redirecting. 
                // However, the server-side implementation is cleaner for "rendering the existing UI".
            }
        }
    };

    app.init();
});
