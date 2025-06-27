document.addEventListener('DOMContentLoaded', () => {

    const { jsPDF } = window.jspdf;

    let state = {
        currentView: 'dashboard',
        reportPeriod: 'month',
        wallets: [],
        transactions: [],
        budgets: [],
        assets: {
            loans: [],
            investments: []
        },
        settings: {
            currency: 'IDR',
            customExpenseCategories: []
        },
        charts: {}
    };

    const pageDetails = {
        dashboard: { title: "Dashboard", subtitle: "Lacak dan analisis performa keuangan Anda" },
        transactions: { title: "Transaksi", subtitle: "Lihat riwayat lengkap transaksi Anda" },
        report: { title: "Laporan", subtitle: "Analisis tren dan rincian keuangan Anda" },
        budgets: { title: "Anggaran", subtitle: "Kelola alokasi pengeluaran Anda" },
        assets: { title: "Aset", subtitle: "Pantau pinjaman dan investasi Anda" },
        settings: { title: "Pengaturan", subtitle: "Konfigurasikan aplikasi dan data Anda" },
        more: { title: "Lainnya", subtitle: "Pengaturan dan opsi tambahan" }
    };

    const EXPENSE_CATEGORIES = {
        'Makanan & Minuman': 'fa-solid fa-utensils', 'Transportasi': 'fa-solid fa-bus', 'Belanja': 'fa-solid fa-bag-shopping',
        'Tagihan': 'fa-solid fa-file-invoice', 'Hiburan': 'fa-solid fa-film', 'Kesehatan': 'fa-solid fa-heart-pulse',
        'Pendidikan': 'fa-solid fa-user-graduate', 'Hadiah': 'fa-solid fa-gift', 'Ongkos Kirim': 'fa-solid fa-truck-fast', 'Lainnya': 'fa-solid fa-ellipsis'
    };
    const INCOME_CATEGORIES = {'Gaji': 'fa-solid fa-wallet', 'Investasi': 'fa-solid fa-arrow-trend-up', 'Lainnya': 'fa-solid fa-ellipsis'};
    let categoryIcons = {};

    const getAllExpenseCategories = () => {
        const customCats = (state.settings.customExpenseCategories || []).reduce((acc, cat) => {
            acc[cat.name] = cat.icon;
            return acc;
        }, {});
        return { ...EXPENSE_CATEGORIES, ...customCats };
    };

    const updateCategoryIcons = () => { categoryIcons = {...getAllExpenseCategories(), ...INCOME_CATEGORIES}; };
    const getIconForCategory = (category) => categoryIcons[category] || 'fa-solid fa-question-circle';

    const categoryColors = ['#5A54D9', '#4E8DFF', '#2ECC71', '#F39C12', '#E74C3C', '#9B59B6', '#34495E', '#1ABC9C', '#F1C40F'];

    const formatCurrency = (amount, currency = state.settings.currency) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: currency, minimumFractionDigits: 0 }).format(amount);
    const unformatNumber = (value) => {
        if (typeof value !== 'string') return value;
        return Number(value.replace(/\D/g, ''));
    };
    const formatNumberInput = (e) => {
        let input = e.target;
        let value = input.value.replace(/\D/g, '');
        if (value === '') {
            input.value = '';
            return;
        }
        let formattedValue = new Intl.NumberFormat('id-ID').format(value);
        input.value = formattedValue;
    };
    const getWalletNameById = (id) => (state.wallets.find(w => w.id === id) || { name: 'N/A' }).name;

    function init() {
        loadState();
        updateCategoryIcons();
        setupEventListeners();
        setupTheme();
        navigateTo('dashboard', true);
    }

    const saveState = () => {
        const stateToSave = { ...state };
        delete stateToSave.charts;
        localStorage.setItem('dompetkuState', JSON.stringify(stateToSave));
    };

    function loadState() {
        const savedState = localStorage.getItem('dompetkuState');
        if (savedState) {
            Object.assign(state, JSON.parse(savedState), { charts: {} });
            state.assets = state.assets || { loans: [], investments: [] };
            state.settings = state.settings || { currency: 'IDR', customExpenseCategories: [] };
            state.settings.customExpenseCategories = state.settings.customExpenseCategories || [];
        }
    }

    function setupEventListeners() {
        document.body.addEventListener('click', handleBodyClick);
        document.getElementById('db-wallet-filter').addEventListener('change', renderDashboard);
        document.getElementById('search-transactions').addEventListener('input', renderTransactions);
        document.getElementById('transaction-category-filter').addEventListener('change', renderTransactions);
        document.getElementById('transaction-wallet-filter').addEventListener('change', renderTransactions);
        document.getElementById('report-period-filter').addEventListener('click', handleReportPeriodChange);
        document.getElementById('report-start-date').addEventListener('change', renderReport);
        document.getElementById('report-end-date').addEventListener('change', renderReport);
        document.getElementById('add-transaction-form').addEventListener('submit', handleAddTransaction);
        document.getElementById('add-wallet-form').addEventListener('submit', handleAddWallet);
        document.getElementById('add-budget-form').addEventListener('submit', handleAddOrUpdateBudget);
        document.getElementById('add-loan-form').addEventListener('submit', handleAddOrUpdateLoan);
        document.getElementById('add-investment-form').addEventListener('submit', handleAddOrUpdateInvestment);
        document.getElementById('trans-type-selector').addEventListener('change', handleTransactionTypeChange);
        document.getElementById('report-download-csv-btn').addEventListener('click', downloadCSV);
        document.getElementById('report-download-pdf-btn').addEventListener('click', () => downloadPDF('report-card-main', 'laporan_keuangan'));
        document.getElementById('db-download-pdf-btn').addEventListener('click', () => downloadPDF('report-card-dashboard', 'pengeluaran_kategori'));

        document.querySelectorAll('input[inputmode="numeric"]').forEach(input => {
            input.addEventListener('input', formatNumberInput);
            input.addEventListener('focus', (e) => {
                if(unformatNumber(e.target.value) === 0) e.target.value = '';
            });
            input.addEventListener('blur', (e) => {
                if(e.target.value === '') e.target.value = '0';
            });
        });
    }

    function handleReportPeriodChange(e) {
        const btn = e.target.closest('button[data-period]');
        if (!btn) return;
        state.reportPeriod = btn.dataset.period;
        document.querySelectorAll('#report-period-filter .btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('report-custom-date-filter').classList.toggle('hidden', state.reportPeriod !== 'custom');
        if (state.reportPeriod !== 'custom') renderReport();
    }

    function handleBodyClick(e) {
        const navLink = e.target.closest('a[data-view], button[data-view]');
        if (navLink) { e.preventDefault(); navigateTo(navLink.dataset.view); return; }

        const themeBtn = e.target.closest('.theme-btn');
        if (themeBtn) { setTheme(themeBtn.dataset.themeId); return; }

        const modalTrigger = e.target.closest('button[data-modal-id]');
        if (modalTrigger) { openModal(modalTrigger.dataset.modalId); return; }
        
        if (e.target.closest('#add-transaction-btn-global')) { openModal('add-transaction-modal'); return; }
        if (e.target.closest('#add-wallet-btn')) { openModal('add-wallet-modal'); return; }

        const closeBtn = e.target.closest('.close-modal-btn');
        if (closeBtn && closeBtn.dataset.modalId) {
            closeModal(closeBtn.dataset.modalId);
            return;
        }
        
        const modalContainer = e.target.closest('.modal-container');
        if (modalContainer && e.target === modalContainer) { closeModal(modalContainer.id); return; }
        
        const actionBtn = e.target.closest('[data-action]');
        if (actionBtn) {
            const { action, type, id } = actionBtn.dataset;
            switch(action) {
                case 'edit': handleEdit(type, id); break;
                case 'delete': handleDelete(type, id); break;
                case 'pay-loan': handlePayLoan(id); break;
            }
        }
    }
    
    function navigateTo(viewId, isInitialLoad = false) {
        state.currentView = viewId;
        document.querySelector('.main-content').scrollTop = 0;
        document.querySelectorAll('.sidebar-nav li').forEach(li => {
            li.classList.toggle('active', li.querySelector('a')?.dataset.view === viewId);
        });
        document.querySelectorAll('.sidebar-footer > a').forEach(el => el.classList.toggle('active', el.dataset.view === viewId));
        
        const details = pageDetails[viewId] || pageDetails.dashboard;
        document.getElementById('page-title').textContent = details.title;
        document.getElementById('page-subtitle').textContent = details.subtitle;
        
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.getElementById(`${viewId}-view`).classList.add('active');

        renderCurrentView();
        if(!isInitialLoad) saveState();
    }
    
    function renderCurrentView() {
        switch(state.currentView) {
            case 'dashboard': renderDashboard(); break;
            case 'transactions': renderTransactions(); break;
            case 'report': renderReport(); break;
            case 'budgets': renderBudgets(); break;
            case 'assets': renderAssets(); break;
            case 'settings': renderSettings(); break;
            case 'more': renderMoreView(); break;
        }
        updateDynamicSelectors();
    }

    function renderDashboard() {
        const walletFilterId = document.getElementById('db-wallet-filter').value;
        const isFiltered = walletFilterId !== 'all';
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const totalWalletBalance = state.wallets.reduce((sum, w) => sum + w.balance, 0);
        const totalLoanRemaining = state.assets.loans.reduce((sum, l) => sum + (l.total - l.paid), 0);
        const totalInvestmentValue = state.assets.investments.reduce((sum, i) => sum + i.current, 0);
        const netWorth = totalWalletBalance + totalInvestmentValue - totalLoanRemaining;
        
        document.getElementById('db-my-balance').textContent = formatCurrency(netWorth);
        document.getElementById('db-individual-balances').innerHTML = state.wallets.map(w =>
            `<div class="individual-balance-item">
                <span class="name">${w.name}</span>
                <span class="amount">${formatCurrency(w.balance)}</span>
            </div>`
        ).join('');
        
        const transactionsForStats = isFiltered ? state.transactions.filter(t => t.walletId === walletFilterId) : state.transactions;
        const recentTransactionsForStats = transactionsForStats.filter(t => new Date(t.date) >= thirtyDaysAgo);
        const totalIncome = recentTransactionsForStats.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
        const totalExpense = recentTransactionsForStats.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount + (t.adminFee || 0) + (t.deliveryFee || 0), 0);

        document.getElementById('db-total-income').textContent = formatCurrency(totalIncome);
        document.getElementById('db-total-expense').textContent = formatCurrency(totalExpense);

        document.getElementById('db-recent-transactions').innerHTML = [...transactionsForStats]
            .sort((a,b) => new Date(b.date) - new Date(a.date))
            .slice(0, 5)
            .map(t => `<div class="transaction-item"><div class="transaction-info"><div class="transaction-icon ${t.type}"><i class="${getIconForCategory(t.category)}"></i></div><div><strong>${t.description}</strong><p class="text-secondary">${getWalletNameById(t.walletId)}</p></div></div><span class="transaction-amount ${t.type === 'expense' ? 'text-danger' : 'text-success'}">${t.type === 'expense' ? '-' : '+'} ${formatCurrency(t.amount)}</span></div>`)
            .join('') || `<p class="text-secondary" style="padding: 16px 0;">Belum ada transaksi.</p>`;

        renderSpendingChart(transactionsForStats);
        renderBudgetProgress(transactionsForStats);
        renderDashboardAssets();
    }
    
    function renderDashboardAssets() {
        const investmentCard = document.getElementById('dashboard-investments-card');
        if (state.assets.investments.length > 0) {
            const totalInitial = state.assets.investments.reduce((sum, i) => sum + i.initial, 0);
            const totalCurrent = state.assets.investments.reduce((sum, i) => sum + i.current, 0);
            const totalGain = totalCurrent - totalInitial;
            const gainClass = totalGain >= 0 ? 'text-success' : 'text-danger';
            investmentCard.innerHTML = `<div class="card-header"><h4>Ringkasan Investasi</h4><button class="view-all-btn" data-view="assets">Lihat Semua</button></div><div class="balance-details" style="border:none; padding-top:0;"><div class="detail-item"><p>Total Modal</p><h4>${formatCurrency(totalInitial)}</h4></div><div class="detail-item"><p>Total Keuntungan</p><h4 class="${gainClass}">${totalGain >= 0 ? '+' : ''}${formatCurrency(totalGain)}</h4></div></div><div class="detail-item" style="margin-top: 16px;"><p>Nilai Saat Ini</p><h3 style="font-size:24px;">${formatCurrency(totalCurrent)}</h3></div>`;
        } else {
            investmentCard.innerHTML = `<div class="card-header"><h4>Ringkasan Investasi</h4></div><p class="text-secondary">Belum ada data investasi.</p>`;
        }
    
        const loanCard = document.getElementById('dashboard-loans-card');
        if (state.assets.loans.length > 0) {
            const totalLoan = state.assets.loans.reduce((sum, l) => sum + l.total, 0);
            const totalPaid = state.assets.loans.reduce((sum, l) => sum + l.paid, 0);
            const remaining = totalLoan - totalPaid;
            loanCard.innerHTML = `<div class="card-header"><h4>Ringkasan Pinjaman</h4><button class="view-all-btn" data-view="assets">Lihat Semua</button></div><div class="balance-details" style="border:none; padding-top:0;"><div class="detail-item"><p>Sudah Dibayar</p><h4>${formatCurrency(totalPaid)}</h4></div><div class="detail-item"><p>Total Pinjaman</p><h4>${formatCurrency(totalLoan)}</h4></div></div><div class="detail-item" style="margin-top: 16px;"><p>Sisa Pinjaman</p><h3 style="font-size:24px;" class="text-danger">${formatCurrency(remaining)}</h3></div>`;
        } else {
            loanCard.innerHTML = `<div class="card-header"><h4>Ringkasan Pinjaman</h4></div><p class="text-secondary">Belum ada data pinjaman.</p>`;
        }
    }
    
    function handleAddTransaction(e) {
        e.preventDefault();
        const type = document.getElementById('trans-type-selector').value;
        const date = document.getElementById('trans-date').value;

        if (type === 'expense' || type === 'income') {
            const isExpense = type === 'expense';
            const suffix = isExpense ? 'exp' : 'inc';
            const description = document.getElementById(`trans-description-${suffix}`).value.trim();
            const amount = unformatNumber(document.getElementById(`trans-amount-${suffix}`).value);
            const category = isExpense ? document.getElementById('trans-category-exp').value : 'Gaji';
            const walletId = document.getElementById('trans-wallet').value;
            
            if (!walletId || !description || amount <= 0) { alert("Mohon isi deskripsi dan jumlah transaksi lebih dari nol."); return; }

            const adminFee = isExpense ? unformatNumber(document.getElementById('trans-admin-fee').value) : 0;
            const deliveryFee = isExpense ? unformatNumber(document.getElementById('trans-delivery-fee').value) : 0;
            const totalAmount = amount + adminFee + deliveryFee;

            const wallet = state.wallets.find(w => w.id === walletId);
            if (isExpense && wallet.balance < totalAmount) { alert("Saldo dompet tidak mencukupi."); return; }

            state.transactions.push({ id: `tx_${Date.now()}`, description, amount, type, category, date, walletId, adminFee, deliveryFee });
            
            if (isExpense) {
                wallet.balance -= totalAmount;
                if (description.startsWith('Pembayaran ')) {
                    const loanName = description.replace('Pembayaran ', '').trim();
                    const loan = state.assets.loans.find(l => l.name === loanName);
                    if (loan) {
                        loan.paid += totalAmount;
                        if (loan.paid > loan.total) loan.paid = loan.total;
                    }
                }
            } else {
                wallet.balance += amount;
            }
            
        } else if (type === 'transfer') {
            const fromId = document.getElementById('trans-from-wallet').value;
            const toId = document.getElementById('trans-to-wallet').value;
            const amount = unformatNumber(document.getElementById('trans-amount-tf').value);
            const adminFee = unformatNumber(document.getElementById('trans-admin-fee-tf').value) || 0;

            if (!fromId || !toId || amount <= 0) { alert("Mohon pilih dompet dan isi jumlah transfer lebih dari nol."); return; }
            if (fromId === toId) { alert("Tidak bisa transfer ke dompet yang sama."); return; }

            const walletFrom = state.wallets.find(w => w.id === fromId);
            const walletTo = state.wallets.find(w => w.id === toId);
            const totalAmount = amount + adminFee;

            if (walletFrom.balance < totalAmount) { alert("Saldo dompet asal tidak mencukupi."); return; }
            
            state.transactions.push({ id: `tx_${Date.now()}`, description: `Transfer ke ${walletTo.name}`, amount, type: 'expense', category: 'Lainnya', date, walletId: fromId, adminFee, deliveryFee: 0});
            walletFrom.balance -= totalAmount;
            state.transactions.push({ id: `tx_${Date.now()+1}`, description: `Transfer dari ${walletFrom.name}`, amount, type: 'income', category: 'Lainnya', date, walletId: toId, adminFee:0, deliveryFee: 0});
            walletTo.balance += amount;
        }
        closeModal('add-transaction-modal');
        renderCurrentView();
        saveState();
    }
    
    function renderSpendingChart(transactions){
        const expenses = transactions.filter(t => t.type === 'expense');
        const dataByCategory = expenses.reduce((acc, t) => {
            acc[t.category] = (acc[t.category] || 0) + t.amount + (t.adminFee || 0) + (t.deliveryFee || 0);
            return acc;
        }, {});
        const data = Object.entries(dataByCategory).sort(([,a],[,b]) => b - a);

        const labels = data.map(([category]) => category);
        const values = data.map(([, amount]) => amount);
        const total = values.reduce((sum, v) => sum + v, 0);
        
        createOrUpdateChart('db-spending-chart', 'doughnut', {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: categoryColors,
                borderColor: getComputedStyle(document.body).getPropertyValue('--bg-card'),
                borderWidth: 4
            }]
        }, {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '75%',
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${formatCurrency(ctx.raw)}` } }
            }
        });

        document.getElementById('db-spending-legend').innerHTML = data.slice(0, 6).map(([category, amount], i) => 
            `<div class="legend-item"><div class="legend-color" style="background-color:${categoryColors[i % categoryColors.length] || '#ccc'}"></div><span>${category}</span></div>`
        ).join('');
        document.getElementById('db-spending-total').textContent = formatCurrency(total);
    }

    function renderBudgetProgress(transactions){
        if (state.budgets.length === 0) {
            document.getElementById('db-budget-progress').innerHTML = `<p class="text-secondary" style="padding-top:16px;">Belum ada anggaran.</p>`;
            return;
        }
        const today = new Date();
        const budgetHTML = state.budgets.map(b => {
            const spent = transactions
                .filter(t => t.type === 'expense' && t.category === b.category && new Date(t.date).getMonth() === today.getMonth() && new Date(t.date).getFullYear() === today.getFullYear())
                .reduce((s, t) => s + t.amount + (t.adminFee || 0) + (t.deliveryFee || 0), 0);
            const progress = b.amount > 0 ? (spent / b.amount) * 100 : 0;
            const progressClass = progress < 75 ? 'default' : progress < 100 ? 'warning' : 'danger';
            return `<div class="item">
                        <div class="item-header"><span>${b.category}</span> <span>${formatCurrency(spent)}</span></div>
                        <div class="progress-bar">
                            <div class="progress-bar-inner ${progressClass}" style="width:${Math.min(progress,100)}%"></div>
                        </div>
                    </div>`;
        }).join('');
        document.getElementById('db-budget-progress').innerHTML = budgetHTML;
    }

    function renderTransactions() {
        const searchTerm = document.getElementById('search-transactions').value.toLowerCase();
        const categoryFilter = document.getElementById('transaction-category-filter').value;
        const walletFilter = document.getElementById('transaction-wallet-filter').value;
        const container = document.getElementById('transaction-list-container');
        
        let filtered = state.transactions;
        if (searchTerm) filtered = filtered.filter(t => t.description.toLowerCase().includes(searchTerm) || t.category.toLowerCase().includes(searchTerm));
        if (categoryFilter !== 'all') filtered = filtered.filter(t => t.category === categoryFilter);
        if (walletFilter !== 'all') filtered = filtered.filter(t => t.walletId === walletFilter);

        const sorted = [...filtered].sort((a,b) => new Date(b.date) - new Date(a.date));
        
        container.innerHTML = sorted.length ? sorted.map(t => `<div class="transaction-list-item"><div class="description-cell"><div class="transaction-icon ${t.type}"><i class="${getIconForCategory(t.category)}"></i></div><span>${t.description}</span></div><span class="cell-category">${t.category}</span><span class="cell-date">${new Date(t.date).toLocaleDateString('id-ID', {day: 'numeric', month: 'short', year: 'numeric'})}</span><span class="cell-amount ${t.type === 'expense' ? 'text-danger' : 'text-success'}">${t.type === 'expense' ? '-' : '+'} ${formatCurrency(t.amount)}</span><span class="cell-wallet">${getWalletNameById(t.walletId)}</span></div>`).join('')
        : `<p style="padding: 40px; text-align: center;" class="text-secondary">Tidak ada transaksi ditemukan.</p>`;
    }
    
    function renderReport() {
        let transactionsForReport;
        let periodText;
        const now = new Date();
        const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

        if (state.reportPeriod === 'custom') {
            const startVal = document.getElementById('report-start-date').value;
            const endVal = document.getElementById('report-end-date').value;
            if(!startVal || !endVal) return;

            const startDate = new Date(startVal);
            const customEndDate = new Date(endVal);
            customEndDate.setHours(23, 59, 59, 999);
            transactionsForReport = state.transactions.filter(t => new Date(t.date) >= startDate && new Date(t.date) <= customEndDate);
            periodText = `${startDate.toLocaleDateString('id-ID')} - ${customEndDate.toLocaleDateString('id-ID')}`;
        } else {
            let startDate = new Date();
            switch(state.reportPeriod) {
                case 'today':
                    startDate.setHours(0, 0, 0, 0);
                    periodText = 'Hari Ini';
                    break;
                case 'week':
                    const firstDay = now.getDate() - now.getDay();
                    startDate = new Date(now.setDate(firstDay));
                    startDate.setHours(0,0,0,0);
                    periodText = 'Minggu Ini';
                    break;
                case 'year': 
                    startDate = new Date(now.getFullYear(), 0, 1);
                    periodText = `Tahun ${now.getFullYear()}`; 
                    break;
                case 'all': 
                    startDate = new Date(0); 
                    periodText = 'Semua Waktu';
                    break;
                case 'month': default: 
                    startDate = new Date(now.getFullYear(), now.getMonth(), 1); 
                    periodText = `Bulan ${now.toLocaleString('id-ID', {month: 'long'})}`;
                    break;
            }
            transactionsForReport = state.transactions.filter(t => new Date(t.date) >= startDate && new Date(t.date) <= new Date());
        }

        const income = transactionsForReport.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
        const expenseTransactions = transactionsForReport.filter(t => t.type === 'expense');
        const totalExpense = expenseTransactions.reduce((sum, t) => sum + t.amount + (t.adminFee || 0) + (t.deliveryFee || 0), 0);
        const adminFee = expenseTransactions.reduce((sum, t) => sum + (t.adminFee || 0), 0);
        const deliveryFee = expenseTransactions.reduce((sum, t) => sum + (t.deliveryFee || 0), 0);
        
        document.querySelector('#report-card-main .report-summary h5').textContent = `Ringkasan (${periodText})`;
        document.getElementById('report-total-income').textContent = formatCurrency(income);
        document.getElementById('report-total-expense').textContent = formatCurrency(totalExpense);
        document.getElementById('report-total-admin-fee').textContent = formatCurrency(adminFee);
        document.getElementById('report-total-delivery-fee').textContent = formatCurrency(deliveryFee);
        document.getElementById('report-net-cashflow').textContent = formatCurrency(income - totalExpense);
        
        renderTrendChart(transactionsForReport, state.reportPeriod);
    }
    
    function renderBudgets() {
         document.getElementById('budget-list-container').innerHTML = state.budgets.length ? state.budgets.map(b => {
             const spent = state.transactions
                .filter(t => t.type === 'expense' && t.category === b.category)
                .reduce((sum, t) => sum + t.amount + (t.adminFee || 0) + (t.deliveryFee || 0), 0);
             const percentage = b.amount > 0 ? (spent / b.amount) * 100 : 0;
             const pClass = percentage < 75 ? 'success' : percentage < 100 ? 'warning' : 'danger';
            return `<div class="setting-item"><div class="content"><div class="progress-list"><div class="item"><div class="item-header"><span><i class="${getIconForCategory(b.category)}"></i> ${b.category}</span><span>${formatCurrency(spent)} / ${formatCurrency(b.amount)}</span></div><div class="progress-bar"><div class="progress-bar-inner ${pClass}" style="width: ${Math.min(percentage, 100)}%"></div></div></div></div></div><div class="actions"><button class="btn-icon" data-action="edit" data-type="budget" data-id="${b.id}"><i class="fa-solid fa-pencil"></i></button><button class="btn-icon" data-action="delete" data-type="budget" data-id="${b.id}"><i class="fa-solid fa-trash"></i></button></div></div>`
        }).join('') : `<p style="padding: 40px; text-align: center;" class="text-secondary">Belum ada anggaran yang diatur.</p>`;
    }
    
    function renderAssets() {
        document.getElementById('loan-list-container').innerHTML = state.assets.loans.length ? state.assets.loans.map(l => {
            const percentage = l.total > 0 ? (l.paid / l.total) * 100 : 0;
            const pClass = percentage < 50 ? 'danger' : percentage < 100 ? 'warning' : 'success';
            return `<div class="setting-item"><div class="content"><h5>${l.name}</h5><p>Jatuh tempo: ${l.dueDate ? new Date(l.dueDate).toLocaleDateString('id-ID') : 'N/A'}</p><div class="progress-list"><div class="item"><div class="item-header"><span>Terbayar</span><span>${formatCurrency(l.paid)} / ${formatCurrency(l.total)}</span></div><div class="progress-bar"><div class="progress-bar-inner ${pClass}" style="width: ${percentage}%"></div></div></div></div></div><div class="actions"><button class="btn btn-primary btn-sm" data-action="pay-loan" data-id="${l.id}">Bayar</button><button class="btn-icon" data-action="edit" data-type="loan" data-id="${l.id}"><i class="fa-solid fa-pencil"></i></button><button class="btn-icon" data-action="delete" data-type="loan" data-id="${l.id}"><i class="fa-solid fa-trash"></i></button></div></div>`
        }).join('') : `<p style="padding: 40px; text-align: center;" class="text-secondary">Belum ada pinjaman.</p>`;
        document.getElementById('investment-list-container').innerHTML = state.assets.investments.length ? state.assets.investments.map(i => {
            const gain = i.current - i.initial;
            const gainPercent = i.initial > 0 ? (gain / i.initial) * 100 : 0;
            const gainClass = gain >= 0 ? 'text-success' : 'text-danger';
            return `<div class="setting-item"><div class="content"><h5>${i.name} <span class="text-secondary" style="font-weight:500; font-size: 14px;">(${i.type})</span></h5><p class="${gainClass}" style="font-weight: 700;">${formatCurrency(i.current)} <span style="font-size:12px">(${gain >= 0 ? '+' : ''}${gainPercent.toFixed(1)}%)</span></p></div><div class="actions"><button class="btn-icon" data-action="edit" data-type="investment" data-id="${i.id}"><i class="fa-solid fa-pencil"></i></button><button class="btn-icon" data-action="delete" data-type="investment" data-id="${i.id}"><i class="fa-solid fa-trash"></i></button></div></div>`
        }).join('') : `<p style="padding: 40px; text-align: center;" class="text-secondary">Belum ada investasi.</p>`;
    }
    
    const getSettingsHTML = () => `
        <div class="setting-item">
            <div class="content"><h5>Mata Uang</h5><p>Pilih mata uang default untuk aplikasi</p></div>
            <select id="currency-selector" class="btn"><option value="IDR" ${state.settings.currency==='IDR'?'selected':''}>IDR</option><option value="USD" ${state.settings.currency==='USD'?'selected':''}>USD</option></select>
        </div>
        <div class="setting-item">
            <div class="content"><h5>Hapus Semua Data</h5><p>Tindakan ini tidak dapat diurungkan.</p></div>
            <button id="reset-data-btn" class="btn" style="color:var(--danger); border-color:var(--danger)">Hapus</button>
        </div>
        <div class="card-header" style="margin: 24px 0 0;"><h4 style="margin:0;">Manajemen Kategori Pengeluaran</h4></div>
        <form id="add-category-form">
            <input type="text" id="new-category-name" placeholder="Nama Kategori Baru" required>
            <button type="submit" class="btn btn-primary">Tambah</button>
        </form>
        <div id="category-list-container" class="settings-list"></div>
    `;

    function attachSettingsListeners(container) {
        container.querySelector('#currency-selector')?.addEventListener('change', e => { state.settings.currency = e.target.value; renderCurrentView(); saveState(); });
        container.querySelector('#reset-data-btn')?.addEventListener('click', () => { if(confirm('Apakah Anda yakin ingin menghapus semua data? Tindakan ini tidak dapat diurungkan.')){ localStorage.removeItem('dompetkuState'); window.location.reload(); }});
        container.querySelector('#add-category-form')?.addEventListener('submit', handleAddCategory);
    }
    
    function handleAddCategory(e) {
        e.preventDefault();
        const form = e.target;
        const nameInput = form.querySelector('#new-category-name');
        const name = nameInput.value.trim();
        const icon = 'fa-solid fa-tag';
        const existingCategories = Object.keys(getAllExpenseCategories()).map(k => k.toLowerCase());

        if (name && !existingCategories.includes(name.toLowerCase())) {
            state.settings.customExpenseCategories.push({ name, icon });
            updateCategoryIcons();
            saveState();
            renderCurrentView(); 
            form.reset();
        } else {
            alert("Nama kategori tidak boleh kosong dan tidak boleh duplikat.");
        }
    }

    function renderCategoryList(container) {
        const catListContainer = container.querySelector('#category-list-container');
        catListContainer.innerHTML = (state.settings.customExpenseCategories || []).map(cat =>
            `<div class="setting-item">
                <div class="content"><h5><i class="${cat.icon}"></i> ${cat.name}</h5></div>
                <div class="actions"><button class="btn-icon" data-action="delete" data-type="category" data-id="${cat.name}"><i class="fa-solid fa-trash"></i></button></div>
             </div>`
        ).join('');
    }

    function renderSettings() { 
        const container = document.getElementById('desktop-settings-container');
        container.innerHTML = getSettingsHTML();
        attachSettingsListeners(container);
        renderCategoryList(container);
    }

    function renderMoreView() {
        const container = document.getElementById('mobile-settings-container');
        container.innerHTML = `<div class="card-header"><h4>Pengaturan</h4></div>${getSettingsHTML()}<br><div class="card-header" style="margin-top:20px"><h4>Tema</h4></div><div class="setting-item">${document.querySelector('.sidebar-footer .theme-switcher').outerHTML}</div>`;
        attachSettingsListeners(container);
        renderCategoryList(container);
        
        container.querySelector('.theme-switcher').addEventListener('click', e => {
            const themeBtn = e.target.closest('.theme-btn');
            if (themeBtn) setTheme(themeBtn.dataset.themeId);
        });
    }
    
    function openModal(modalId, editData = null) {
        const modal = document.getElementById(modalId);
        if(!modal) return;
        const form = modal.querySelector('form');
        if (form) form.reset();
        
        const titleEl = modal.querySelector('.modal-header h3');
        if (titleEl && !titleEl.dataset.originalTitle) {
            titleEl.dataset.originalTitle = titleEl.textContent;
        }

        const numericInputs = modal.querySelectorAll('input[inputmode="numeric"]');
        numericInputs.forEach(input => input.value = '0');
        
        switch(modalId) {
            case 'add-transaction-modal': document.getElementById('trans-date').valueAsDate = new Date(); handleTransactionTypeChange(); break;
            case 'add-budget-modal':
                if(titleEl) titleEl.textContent = editData ? "Edit Anggaran" : "Atur Anggaran Baru";
                document.getElementById('budget-edit-id').value = editData ? editData.id : '';
                if(editData) { document.getElementById('budget-category').value = editData.category; document.getElementById('budget-amount').value = new Intl.NumberFormat('id-ID').format(editData.amount); }
                break;
            case 'add-loan-modal':
                if(titleEl) titleEl.textContent = editData ? "Edit Pinjaman" : "Tambah Pinjaman Baru";
                document.getElementById('loan-edit-id').value = editData ? editData.id : '';
                if(editData) { document.getElementById('loan-name').value = editData.name; document.getElementById('loan-total').value = new Intl.NumberFormat('id-ID').format(editData.total); document.getElementById('loan-paid').value = new Intl.NumberFormat('id-ID').format(editData.paid); document.getElementById('loan-due-date').value = editData.dueDate; }
                break;
            case 'add-investment-modal':
                if(titleEl) titleEl.textContent = editData ? "Edit Investasi" : "Tambah Investasi Baru";
                document.getElementById('investment-edit-id').value = editData ? editData.id : '';
                if(editData) { document.getElementById('investment-name').value = editData.name; document.getElementById('investment-type').value = editData.type; document.getElementById('investment-initial').value = new Intl.NumberFormat('id-ID').format(editData.initial); document.getElementById('investment-current').value = new Intl.NumberFormat('id-ID').format(editData.current); }
                break;
        }
        updateDynamicSelectors();
        modal.classList.add('show');
    }

    function closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal) return;
        const titleEl = modal.querySelector('.modal-header h3');
        if (titleEl && titleEl.dataset.originalTitle) {
            titleEl.textContent = titleEl.dataset.originalTitle;
        }
        modal.classList.remove('show');
    }
    
    function updateDynamicSelectors() {
        const walletOptions = state.wallets.map(w => `<option value="${w.id}">${w.name}</option>`).join('');
        const walletOptionsWithBalance = state.wallets.map(w => `<option value="${w.id}">${w.name} (${formatCurrency(w.balance)})</option>`).join('');
        
        document.getElementById('db-wallet-filter').innerHTML = `<option value="all">Semua Dompet</option>${walletOptions}`;
        document.getElementById('transaction-wallet-filter').innerHTML = `<option value="all">Semua Dompet</option>${walletOptions}`;
        document.querySelectorAll('#trans-wallet, #trans-from-wallet, #trans-to-wallet').forEach(sel => sel.innerHTML = state.wallets.length ? walletOptionsWithBalance : `<option disabled>Buat dompet dulu</option>`);
        
        const expenseCategories = getAllExpenseCategories();
        const allCategoryKeys = Object.keys(expenseCategories);
        const categoryOptions = allCategoryKeys.map(cat => `<option value="${cat}">${cat}</option>`).join('');
        document.getElementById('transaction-category-filter').innerHTML = `<option value="all">Semua Kategori</option>${categoryOptions}`;
        document.querySelectorAll('#trans-category-exp, #budget-category').forEach(sel => sel.innerHTML = categoryOptions);
    }
    
    function handleAddWallet(e) { e.preventDefault(); const name = document.getElementById('wallet-name').value; const balance = unformatNumber(document.getElementById('wallet-balance').value); if(!name) return; state.wallets.push({ id: `w_${Date.now()}`, name, balance }); closeModal('add-wallet-modal'); renderCurrentView(); saveState(); }
    function handleAddOrUpdateBudget(e) { e.preventDefault(); const id = document.getElementById('budget-edit-id').value; const category = document.getElementById('budget-category').value; const amount = unformatNumber(document.getElementById('budget-amount').value); if (!category || amount <= 0) { alert("Pilih kategori dan masukkan jumlah lebih dari nol."); return; } if(id) { const budget = state.budgets.find(b => b.id === id); Object.assign(budget, { category, amount }); } else { state.budgets.push({ id: `b_${Date.now()}`, category, amount }); } closeModal('add-budget-modal'); renderCurrentView(); saveState(); }
    function handleAddOrUpdateLoan(e) { e.preventDefault(); const id = document.getElementById('loan-edit-id').value; const data = { name: document.getElementById('loan-name').value, total: unformatNumber(document.getElementById('loan-total').value), paid: unformatNumber(document.getElementById('loan-paid').value), dueDate: document.getElementById('loan-due-date').value }; if(!data.name || isNaN(data.total)) return; if(id) { Object.assign(state.assets.loans.find(i=>i.id===id), data); } else { data.id = `l_${Date.now()}`; state.assets.loans.push(data); } closeModal('add-loan-modal'); renderCurrentView(); saveState(); }
    function handleAddOrUpdateInvestment(e) { e.preventDefault(); const id = document.getElementById('investment-edit-id').value; const data = { name: document.getElementById('investment-name').value, type: document.getElementById('investment-type').value, initial: unformatNumber(document.getElementById('investment-initial').value), current: unformatNumber(document.getElementById('investment-current').value) }; if (!data.name || isNaN(data.initial)) return; if(id) { Object.assign(state.assets.investments.find(i=>i.id===id), data); } else { data.id = `i_${Date.now()}`; state.assets.investments.push(data); } closeModal('add-investment-modal'); renderCurrentView(); saveState(); }
    
    const handleTransactionTypeChange = () => {
        const type = document.getElementById('trans-type-selector').value;

        const formSections = [
            { bodyId: 'form-body-expense', type: 'expense', inputs: ['trans-description-exp', 'trans-amount-exp', 'trans-category-exp'] },
            { bodyId: 'form-body-income', type: 'income', inputs: ['trans-description-inc', 'trans-amount-inc'] },
            { bodyId: 'form-body-transfer', type: 'transfer', inputs: ['trans-from-wallet', 'trans-to-wallet', 'trans-amount-tf'] }
        ];

        document.getElementById('wallet-selector-group').classList.toggle('hidden', type === 'transfer');

        formSections.forEach(section => {
            const bodyElement = document.getElementById(section.bodyId);
            const isActive = type === section.type;
            bodyElement.classList.toggle('hidden', !isActive);
            section.inputs.forEach(inputId => {
                const input = document.getElementById(inputId);
                if (input) {
                    input.disabled = !isActive;
                }
            });
        });
        
        document.getElementById('trans-wallet').disabled = (type === 'transfer');
        document.getElementById('trans-date').disabled = false;
    };


    function handleEdit(type, id) {
        let item, modalId;
        if(type === 'budget') { item = state.budgets.find(i=>i.id===id); modalId = 'add-budget-modal'; }
        else if(type === 'loan') { item = state.assets.loans.find(i=>i.id===id); modalId = 'add-loan-modal'; }
        else if(type === 'investment') { item = state.assets.investments.find(i=>i.id===id); modalId = 'add-investment-modal'; }
        if(item && modalId) openModal(modalId, item);
    }
    function handleDelete(type, id) {
        if (!confirm("Anda yakin ingin menghapus item ini?")) return;
        if(type === 'budget') state.budgets = state.budgets.filter(i => i.id !== id);
        else if(type === 'loan') state.assets.loans = state.assets.loans.filter(i => i.id !== id);
        else if(type === 'investment') state.assets.investments = state.assets.investments.filter(i => i.id !== id);
        else if(type === 'category') state.settings.customExpenseCategories = state.settings.customExpenseCategories.filter(c => c.name !== id);
        
        updateCategoryIcons();
        saveState();
        renderCurrentView();
    }
    function handlePayLoan(id) {
        const loan = state.assets.loans.find(l => l.id === id);
        if (!loan) return;
        const remainingBalance = loan.total - loan.paid;
        const paymentStr = prompt(`Masukkan jumlah pembayaran untuk "${loan.name}":\nSisa pinjaman: ${formatCurrency(remainingBalance)}`, '');
        if (!paymentStr) return;
        
        const payment = unformatNumber(paymentStr);
        if (isNaN(payment) || payment <= 0) { 
            alert("Jumlah pembayaran tidak valid."); 
            return; 
        }

        openModal('add-transaction-modal');
        document.getElementById('trans-type-selector').value = 'expense';
        handleTransactionTypeChange();

        document.getElementById('trans-description-exp').value = `Pembayaran ${loan.name}`;
        document.getElementById('trans-amount-exp').value = new Intl.NumberFormat('id-ID').format(payment);
        document.getElementById('trans-category-exp').value = 'Tagihan';
    }

    const setupTheme = () => setTheme(localStorage.getItem('theme') || 'dark', true);
    function setTheme(theme, isInitialLoad = false) {
        document.body.dataset.theme = theme;
        document.querySelectorAll('.theme-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.themeId === theme));
        localStorage.setItem('theme', theme);
        if(!isInitialLoad && (state.currentView === 'dashboard' || state.currentView === 'report')) renderCurrentView();
    }

    function createOrUpdateChart(id,type,data,opt){if(state.charts[id])state.charts[id].destroy();const ctx=document.getElementById(id);if(ctx)state.charts[id]=new Chart(ctx.getContext('2d'),{type,data,options:opt})}
        
    function renderTrendChart(transactions, period){
        let dataGroup = {};
        const now = new Date();
        
        if (period === 'year') {
            const labels = Array.from({length: 12}, (_, i) => new Date(0, i).toLocaleString('id-ID', {month: 'short'}));
            labels.forEach(l => dataGroup[l] = { income: 0, expense: 0 });
            transactions.forEach(t => {
                const key = new Date(t.date).toLocaleString('id-ID', { month: 'short' });
                if(dataGroup.hasOwnProperty(key)) {
                    if(t.type === 'income') dataGroup[key].income += t.amount;
                    else if(t.type === 'expense') dataGroup[key].expense += t.amount + (t.adminFee || 0) + (t.deliveryFee || 0);
                }
            });
        } else {
            let start, end;
            if(period === 'month'){ start = new Date(now.getFullYear(), now.getMonth(), 1); end = new Date(now.getFullYear(), now.getMonth() + 1, 0); } 
            else if (period === 'week') { const first = now.getDate() - now.getDay(); start = new Date(new Date().setDate(first)); end = new Date(new Date().setDate(first + 6)); }
            else if (period === 'today') { start = now; end = now; }
            else if (period === 'custom') { start = new Date(document.getElementById('report-start-date').value); end = new Date(document.getElementById('report-end-date').value); } 
            else { start = transactions.length > 0 ? new Date(Math.min(...transactions.map(t => new Date(t.date)))) : now; end = now; }
            
            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                dataGroup[new Date(d).toISOString().split('T')[0]] = { income: 0, expense: 0 };
            }
            transactions.forEach(t => {
                const key = new Date(t.date).toISOString().split('T')[0];
                if(dataGroup.hasOwnProperty(key)) {
                    if(t.type === 'income') dataGroup[key].income += t.amount;
                    else if(t.type === 'expense') dataGroup[key].expense += t.amount + (t.adminFee || 0) + (t.deliveryFee || 0);
                }
            });
        }
        
        const labels = (period === 'year') ? Object.keys(dataGroup) : Object.keys(dataGroup).map(d => new Date(d + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }));
        const incomeData = Object.values(dataGroup).map(d => d.income);
        const expenseData = Object.values(dataGroup).map(d => d.expense);
        
        createOrUpdateChart('report-trend-chart','line',{labels,datasets:[{label:'Pemasukan',data:incomeData,borderColor:'rgba(46,204,113,1)',tension:0.3,fill:true,backgroundColor:'rgba(46,204,113,0.1)'},{label:'Pengeluaran',data:expenseData,borderColor:'rgba(231,76,60,1)',tension:0.3,fill:true,backgroundColor:'rgba(231,76,60,0.1)'}]},{responsive:true,maintainAspectRatio:false,interaction:{intersect:false,mode:'index'},scales:{y:{ticks:{callback:v=>formatCurrency(v, 'IDR').replace(/\,00$/,'').replace('IDR','').trim()}}},plugins:{tooltip:{callbacks:{label:ctx=>`${ctx.dataset.label}: ${formatCurrency(ctx.raw)}`}}}});
    }
    
    function downloadCSV() {
        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += ["ID", "Tanggal", "Deskripsi", "Kategori", "Tipe", "Jumlah", "Biaya Admin", "Ongkos Kirim", "Dompet"].join(",") + "\r\n";
        state.transactions.forEach(t => {
            const desc = `"${t.description.replace(/"/g, '""')}"`;
            const row = [t.id, new Date(t.date).toISOString().split('T')[0], desc, t.category, t.type, t.amount, t.adminFee || 0, t.deliveryFee || 0, getWalletNameById(t.walletId)];
            csvContent += row.join(",") + "\r\n";
        });
        const link = document.createElement("a");
        link.setAttribute("href", encodeURI(csvContent));
        link.setAttribute("download", `dompetku_transaksi_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
    
    async function downloadPDF(elementId, filename) {
        const card = document.getElementById(elementId);
        if(!card) return;
        const canvas = await html2canvas(card, { useCORS: true, scale: 2, backgroundColor: getComputedStyle(document.body).getPropertyValue('--bg-card') });
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const canvasWidth = canvas.width;
        const canvasHeight = canvas.height;
        const ratio = canvasWidth / canvasHeight;
        const imgWidth = pdfWidth - 20; 
        const imgHeight = imgWidth / ratio;
        let finalHeight = imgHeight > pdfHeight - 20 ? pdfHeight - 20 : imgHeight;
        pdf.addImage(imgData, 'PNG', 10, 10, imgWidth, finalHeight);
        pdf.save(`${filename}_${new Date().toISOString().split('T')[0]}.pdf`);
    }

    init();
});