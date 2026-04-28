// ==================== GLOBAL VARIABLES ====================
let currentStaffId = null;
let currentUser = null;
let clients = [];
let jobs = [];
let staffActivities = [];
let inventory = [];
let users = [];
let announcements = [];
let reports = [];
let isAdminAuthenticated = false;
const ADMIN_PASSWORD = "@admin123#";
const WHATSAPP_NUMBER = "2348185504382";

// Job Routing Stages
const JOB_STAGES = [
    'Client/staff',
    'Graphics',
    'Printing',
    'Photography',
    'Secretary Review',
    'Admin Approval',
    'Delivery',
    'Completed'
];

// PWA Installation
let deferredPrompt;
let installButton = null;

// ==================== INITIALIZATION ====================
window.onload = async function() {
    console.log('🚀 TBOS v3.0 Initializing...');
    updateDate();
    await checkLoginStatus();
    await loadAllData();
    setupPWA();
    registerServiceWorker();
    setupNotifications();

    // Online/Offline Events
    window.addEventListener('online', () => showToast("✅ Back online!"));
    window.addEventListener('offline', () => showToast("⚠️ You are offline."));

    console.log('✅ TBOS v3.0 Ready!');
};

// ==================== PWA SETUP ====================
function setupPWA() {
    // Listen for install prompt
    window.addEventListener('beforeinstallprompt', (e) => {
        console.log('📱 Install prompt available');
        e.preventDefault();
        deferredPrompt = e;
        showInstallButton();
    });

    // Listen for app installed
    window.addEventListener('appinstalled', () => {
        console.log('✅ PWA installed!');
        hideInstallButton();
        deferredPrompt = null;
        showToast('🎉 TBOS installed successfully!');
    });
}

function showInstallButton() {
    // Create install button if not exists
    if (!installButton) {
        installButton = document.createElement('button');
        installButton.id = 'install-pwa-btn';
        installButton.innerHTML = '<i class="fas fa-download"></i> Install App';
        installButton.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: #008080;
            color: white;
            border: none;
            padding: 15px 25px;
            border-radius: 50px;
            font-size: 1rem;
            font-weight: 600;
            cursor: pointer;
            z-index: 9999;
            box-shadow: 0 4px 15px rgba(0,128,128,0.4);
            animation: pulse 2s infinite;
        `;
        installButton.onclick = installApp;
        document.body.appendChild(installButton);

        // Add pulse animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes pulse {
                0% { transform: scale(1); }
                50% { transform: scale(1.05); }
                100% { transform: scale(1); }
            }
        `;
        document.head.appendChild(style);
    }
}

function hideInstallButton() {
    if (installButton) {
        installButton.style.display = 'none';
    }
}

async function installApp() {
    if (!deferredPrompt) {
        showToast('Install prompt not available');
        return;
    }

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response: ${outcome}`);
    deferredPrompt = null;
    hideInstallButton();
}

// ==================== SERVICE WORKER ====================
async function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        try {
            const registration = await navigator.serviceWorker.register('./sw.js', {
                scope: './'
            });
            console.log('✅ Service Worker registered:', registration.scope);

            // Check for updates
            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        if (confirm('🔄 New version available! Reload to update?')) {
                            window.location.reload();
                        }
                    }
                });
            });
        } catch (error) {
            console.error('❌ Service Worker registration failed:', error);
        }
    }
}

// ==================== NOTIFICATIONS ====================
async function setupNotifications() {
    if ('Notification' in window && 'serviceWorker' in navigator) {
        const permission = await Notification.requestPermission();
        console.log('Notification permission:', permission);
    }
}

async function sendNotification(title, body) {
    if ('Notification' in window && Notification.permission === 'granted') {
        const registration = await navigator.serviceWorker.ready;
        registration.showNotification(title, {
            body: body,
            icon: 'assets/logo-192.png',
            badge: 'assets/logo-192.png',
            vibrate: [100, 50, 100],
            tag: 'tbos-notification'
        });
    }
}

// ==================== UTILITY FUNCTIONS ====================
function updateDate() {
    const now = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const dateElement = document.getElementById('currentDate');
    if (dateElement) {
        dateElement.textContent = now.toLocaleDateString('en-US', options);
    }
}

async function checkLoginStatus() {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        currentStaffId = currentUser.id || currentUser.email;

        // Redirect based on role
        if (currentUser.role === 'Administrator') {
            window.location.href = 'admin.html';
        } else {
            window.location.href = 'dashboard.html';
        }
    }
}

function showToast(msg, dur = 3000) {
    let toast = document.getElementById('toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast';
        toast.style.cssText = `
            position: fixed;
            bottom: 30px;
            left: 50%;
            transform: translateX(-50%);
            background: #333;
            color: white;
            padding: 12px 24px;
            border-radius: 50px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            z-index: 9999;
            opacity: 0;
            transition: opacity 0.3s;
        `;
        document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.style.opacity = '1';
    setTimeout(() => toast.style.opacity = '0', dur);
}

function generateId() {
    return 'TBOS-' + Date.now().toString().slice(-6);
}

function clearForm(ids) {
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            if (el.type === 'file') el.value = '';
            else el.value = '';
        }
    });
}

// ==================== LOGIN/LOGOUT ====================
async function login() {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const btnSubmit = document.getElementById('btn-submit');
    const errorMessage = document.getElementById('error-message');
    const errorText = document.getElementById('error-text');

    if (!email || !password) {
        showToast('Please enter email and password');
        return;
    }

    btnSubmit.disabled = true;
    btnSubmit.innerHTML = '<div class="loading-spinner"></div> Signing In...';
    errorMessage.style.display = 'none';

    try {
        console.log('📡 Fetching users from Google Sheets...');
        users = await API.get('users');
        console.log('✅ Users loaded:', users.length);

        const user = users.find(u => u.email === email);
        console.log('🔍 User found:', user);

        if (!user) {
            throw new Error('User not found. Please check your email or register first.');
        }

        if (user.password !== password) {
            throw new Error('Incorrect password. Please try again.');
        }

        if (user.status !== 'Active') {
            throw new Error('Account not active. Contact admin for approval.');
        }

        localStorage.setItem('currentUser', JSON.stringify(user));
        localStorage.setItem('currentStaffId', user.id || email);
        currentUser = user;
        currentStaffId = user.id || email;

        console.log('✅ Login successful:', user);

        setTimeout(() => {
            if (user.role === 'Administrator') {
                window.location.href = 'admin.html';
            } else {
                window.location.href = 'dashboard.html';
            }
        }, 1000);

    } catch (error) {
        console.error('❌ Login error:', error);
        errorMessage.style.display = 'flex';
        errorText.textContent = 'Login failed: ' + error.message;
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = '<i class="fas fa-sign-in-alt"></i> Secure Sign In';
        document.getElementById('login-password').value = '';
    }
}

function logout() {
    if (confirm('Log out?')) {
        localStorage.removeItem('currentUser');
        localStorage.removeItem('currentStaffId');
        window.location.href = 'index.html';
    }
}

// ==================== DATA LOADING ====================
async function loadAllData() {
    console.log('📡 Loading all data from Google Sheets...');
    try {
        const [clientsData, jobsData, staffData, inventoryData, announcementsData] = await Promise.all([
            API.get('clients'),
            API.get('jobs'),
            API.get('staff'),
            API.get('inventory'),
            API.get('announcements')
        ]);

        clients = Array.isArray(clientsData) ? clientsData : [];
        jobs = Array.isArray(jobsData) ? jobsData : [];
        staffActivities = Array.isArray(staffData) ? staffData : [];
        inventory = Array.isArray(inventoryData) ? inventoryData : [];
        announcements = Array.isArray(announcementsData) ? announcementsData : [];

        console.log('✅ Data loaded:');
        console.log('   - Clients:', clients.length);
        console.log('   - Jobs:', jobs.length);
        console.log('   - Staff:', staffActivities.length);
        console.log('   - Inventory:', inventory.length);
        console.log('   - Announcements:', announcements.length);

        localStorage.setItem('local_clients', JSON.stringify(clients));
        localStorage.setItem('local_jobs', JSON.stringify(jobs));
        localStorage.setItem('local_staff', JSON.stringify(staffActivities));
        localStorage.setItem('local_inventory', JSON.stringify(inventory));
        localStorage.setItem('local_announcements', JSON.stringify(announcements));

    } catch (error) {
        console.error('❌ Load error:', error);
        showToast('Using offline mode. Some data may be outdated.');

        clients = JSON.parse(localStorage.getItem('local_clients') || '[]');
        jobs = JSON.parse(localStorage.getItem('local_jobs') || '[]');
        staffActivities = JSON.parse(localStorage.getItem('local_staff') || '[]');
        inventory = JSON.parse(localStorage.getItem('local_inventory') || '[]');
        announcements = JSON.parse(localStorage.getItem('local_announcements') || '[]');
    }
}

// ==================== CLIENTS ====================
async function addClient() {
    const name = document.getElementById('clientName').value.trim();
    if (!name) {
        showToast('Name required');
        return;
    }

    const now = new Date();
    const clientData = {
        id: Date.now().toString(),
        name,
        phone: document.getElementById('clientPhone').value.trim(),
        email: document.getElementById('clientEmail').value.trim(),
        comment: document.getElementById('clientComment').value.trim(),
        date: now.toLocaleDateString(),
        time: now.toLocaleTimeString(),
        staff_id: currentStaffId
    };

    const result = await API.create('clients', clientData);

    if (result.success) {
        clients.push(clientData);
        renderClients();
        clearForm(['clientName', 'clientPhone', 'clientEmail', 'clientComment']);
        showToast('Client added!');
    } else {
        showToast('Failed: ' + (result.error || 'Unknown error'));
    }
}

function renderClients() {
    const list = document.getElementById('clientList');
    if (!list) return;

    const todayClients = clients.filter(c => c.date === new Date().toLocaleDateString());

    if (todayClients.length === 0) {
        list.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">No clients today</p>';
        return;
    }

    list.innerHTML = todayClients.map(c => `
        <div class="data-item">
            <div class="data-item-info">
                <h4>${c.name}</h4>
                <p>📞 ${c.phone || 'N/A'}</p>
                <p>✉️ ${c.email || 'N/A'}</p>
                <p>${c.comment || 'No comment'}</p>
                <p style="font-size: 0.75rem; color: #999;">${c.time}</p>
            </div>
            <div class="data-item-actions">
                <button class="btn-success" onclick="sendWhatsApp('${c.name}', '${c.phone}')">
                    <i class="fab fa-whatsapp"></i>
                </button>
            </div>
        </div>
    `).join('');
}

// ==================== JOBS ====================
async function addJob() {
    const client = document.getElementById('jobClient').value.trim();
    if (!client) {
        showToast('Client name required');
        return;
    }

    const now = new Date();
    const amount = parseFloat(document.getElementById('jobAmount').value) || 0;
    const paid = parseFloat(document.getElementById('jobPaid').value) || 0;
    const trackingId = generateId();

    const jobData = {
        tracking_id: trackingId,
        client_name: client,
        client_phone: document.getElementById('jobPhone').value.trim(),
        client_email: document.getElementById('jobEmail')?.value || '',
        hub: document.getElementById('jobHub').value,
        description: document.getElementById('jobDescription').value.trim(),
        amount: amount,
        paid: paid,
        balance: amount - paid,
        payment_status: paid >= amount ? 'PAID' : (paid > 0 ? 'PARTIALLY PAID' : 'UNPAID'),
        status: paid >= amount ? 'Completed' : 'Pending',
        stage: 'Client/staff',
        delivery_date: document.getElementById('jobDelivery').value,
        date: now.toLocaleDateString(),
        time: now.toLocaleTimeString(),
        staff_id: currentStaffId
    };

    const result = await API.create('jobs', jobData);

    if (result.success) {
        jobs.push(jobData);
        renderJobs();
        clearForm(['jobClient', 'jobPhone', 'jobHub', 'jobDescription', 'jobAmount', 'jobPaid', 'jobDelivery']);
        showToast(`Job created! ID: ${trackingId}`);
        sendJobWhatsApp(trackingId, jobData.client_phone, 'created');
    } else {
        showToast('Failed: ' + (result.error || 'Unknown error'));
    }
}

function renderJobs() {
    const list = document.getElementById('jobList');
    if (!list) return;

    if (jobs.length === 0) {
        list.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">No jobs found</p>';
        return;
    }

    list.innerHTML = jobs.map(j => {
        const statusClass = j.payment_status === 'PAID' ? 'status-paid' :
                           j.payment_status === 'PARTIALLY PAID' ? 'status-partial' : 'status-unpaid';

        return `
        <div class="data-item">
            <div class="data-item-info">
                <h4>${j.tracking_id} - ${j.client_name}</h4>
                <p>🏢 ${j.hub || 'N/A'}</p>
                <p>📝 ${j.description || 'No description'}</p>
                <p>💰 ₦${parseFloat(j.amount).toLocaleString()} | Paid: ₦${parseFloat(j.paid || 0).toLocaleString()}</p>
                <p>📊 Status: <span class="status-badge ${statusClass}">${j.payment_status}</span> | Stage: ${j.stage}</p>
                <p style="font-size: 0.75rem; color: #999;">${j.date} ${j.time}</p>
            </div>
            <div class="data-item-actions">
                <button class="btn-info" onclick="viewJobDetail('${j.tracking_id}')" title="View & Route">
                    <i class="fas fa-eye"></i>
                </button>
                <button class="btn-success" onclick="sendJobWhatsApp('${j.tracking_id}', '${j.client_phone}', 'update')" title="WhatsApp">
                    <i class="fab fa-whatsapp"></i>
                </button>
            </div>
        </div>
        `;
    }).join('');
}

// ==================== WHATSAPP ====================
function sendWhatsApp(name, phone) {
    if (!phone) {
        showToast('No phone number');
        return;
    }
    const message = `Hello ${name},\n\nThank you for choosing Tomstudio BizHub!\n\nContact: +234 818 550 4382`;
    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
}

function sendJobWhatsApp(trackingId, phone, action) {
    if (!phone) {
        showToast('No phone number');
        return;
    }
    const message = `Hello,\n\nYour job status update - ${trackingId}\nAction: ${action}\n\nThank you for choosing Tomstudio BizHub!\nContact: +234 818 550 4382`;
    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
}

// ==================== INVENTORY ====================
async function addInventory() {
    const name = document.getElementById('itemName').value.trim();
    if (!name) {
        showToast('Item name required');
        return;
    }

    const inventoryData = {
        id: Date.now().toString(),
        name,
        category: document.getElementById('itemCategory').value,
        stock: parseInt(document.getElementById('itemStock').value) || 0,
        alert: parseInt(document.getElementById('itemAlert').value) || 5,
        status: 'OK'
    };

    const result = await API.create('inventory', inventoryData);

    if (result.success) {
        inventory.push(inventoryData);
        updateInventoryStatus();
        renderInventory();
        clearForm(['itemName', 'itemCategory', 'itemStock', 'itemAlert']);
        showToast('Item added!');
    } else {
        showToast('Failed: ' + (result.error || 'Unknown error'));
    }
}

function updateInventoryStatus() {
    inventory.forEach(item => {
        if (item.stock === 0) item.status = 'OUT';
        else if (item.stock <= item.alert) item.status = 'LOW';
        else item.status = 'OK';
    });
}

function renderInventory() {
    const list = document.getElementById('inventoryList');
    if (!list) return;

    updateInventoryStatus();

    const total = inventory.length;
    const low = inventory.filter(i => i.status === 'LOW').length;
    const out = inventory.filter(i => i.status === 'OUT').length;

    const totalEl = document.getElementById('totalItems');
    const lowEl = document.getElementById('lowStock');
    const outEl = document.getElementById('outStock');

    if (totalEl) totalEl.textContent = total;
    if (lowEl) lowEl.textContent = low;
    if (outEl) outEl.textContent = out;

    if (inventory.length === 0) {
        list.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">No inventory items</p>';
        return;
    }

    list.innerHTML = inventory.map(i => `
        <div class="data-item">
            <div class="data-item-info">
                <h4>${i.name}</h4>
                <p>📦 ${i.category}</p>
                <p>Stock: ${i.stock} | Alert: ${i.alert}</p>
                <p>Status: <span style="color: ${i.status === 'OK' ? 'green' : i.status === 'LOW' ? 'orange' : 'red'}">${i.status}</span></p>
            </div>
        </div>
    `).join('');
}

// ==================== ADMIN ====================
function openAdminModal() {
    const modal = document.getElementById('adminModal');
    if (modal) modal.style.display = 'flex';
}

function closeAdminModal() {
    const modal = document.getElementById('adminModal');
    if (modal) modal.style.display = 'none';
}

function checkAdminPassword() {
    const password = document.getElementById('adminPassword').value;
    if (password === ADMIN_PASSWORD) {
        isAdminAuthenticated = true;
        closeAdminModal();
        showAdminDashboard();
        showToast('Admin access granted!');
    } else {
        showToast('Wrong password!');
    }
}

function showAdminDashboard() {
    const staffIds = getAllStaffIds();
    const list = document.getElementById('staffListElement');
    if (!list) return;

    if (staffIds.length === 0) {
        list.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">No staff data</p>';
        return;
    }

    list.innerHTML = staffIds.map(id => {
        const count = getDataCount(id);
        return `
        <div class="staff-item" onclick="loadStaffData('${id}')">
            <span>${id}</span>
            <span class="badge">${count}</span>
        </div>
        `;
    }).join('');

    loadStaffData(staffIds[0]);
}

function getAllStaffIds() {
    const staffIds = new Set();
    ['clients', 'jobs', 'staff'].forEach(p => {
        const data = JSON.parse(localStorage.getItem(`local_${p}`) || '[]');
        data.forEach(d => {
            if (d.staff_id) staffIds.add(d.staff_id);
        });
    });
    return Array.from(staffIds);
}

function getDataCount(staffId) {
    let count = 0;
    ['clients', 'jobs', 'staff'].forEach(p => {
        const data = JSON.parse(localStorage.getItem(`local_${p}`) || '[]');
        count += data.filter(d => d.staff_id === staffId).length;
    });
    return count;
}

function loadStaffData(staffId) {
    document.querySelectorAll('.staff-item').forEach(i => i.classList.remove('active'));
    event.target.closest('.staff-item').classList.add('active');

    const allClients = clients.filter(c => c.staff_id === staffId);
    const allJobs = jobs.filter(j => j.staff_id === staffId);
    const allStaff = staffActivities.filter(a => a.staff_id === staffId);

    const totalSales = allJobs.reduce((sum, j) => sum + (parseFloat(j.paid) || 0), 0);

    const container = document.getElementById('staffDataContainer');
    if (!container) return;

    container.innerHTML = `
        <h3>📋 ${staffId}</h3>
        <p>👥 Clients: ${allClients.length}</p>
        <p>💼 Jobs: ${allJobs.length}</p>
        <p>💰 Total Sales: ₦${totalSales.toLocaleString()}</p>
        <p>👷 Activities: ${allStaff.length}</p>
        <div style="margin: 20px 0;">
            <button class="btn-primary" onclick="approveStaff('${staffId}')" style="width: 100%; background: #6c5ce7; color: white; border: none; padding: 12px; border-radius: 8px; cursor: pointer;">
                <i class="fas fa-check"></i> Approve & Clear
            </button>
        </div>
    `;
}

function approveStaff(staffId) {
    if (confirm(`Approve and clear ${staffId}'s data?`)) {
        clients = clients.filter(c => c.staff_id !== staffId);
        jobs = jobs.filter(j => j.staff_id !== staffId);
        staffActivities = staffActivities.filter(a => a.staff_id !== staffId);

        localStorage.setItem('local_clients', JSON.stringify(clients));
        localStorage.setItem('local_jobs', JSON.stringify(jobs));
        localStorage.setItem('local_staff', JSON.stringify(staffActivities));

        showAdminDashboard();
        showToast(`${staffId} approved and cleared!`);
    }
}

// ==================== NAVIGATION ====================
function openClientPortal() {
    window.location.href = 'clients.html';
}

// ==================== EXPORT ====================
function exportCSV() {
    const today = new Date().toLocaleDateString();
    let csv = 'Type,Name,Phone,Amount,Date,Time,Staff\n';

    clients.filter(c => c.date === today).forEach(c => {
        csv += `Client,${c.name},${c.phone},0,${c.date},${c.time},${c.staff_id}\n`;
    });

    jobs.filter(j => j.date === today).forEach(j => {
        csv += `Job,${j.client_name},${j.client_phone},${j.amount},${j.date},${j.time},${j.staff_id}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `TBOS_Report_${today.replace(/\//g, '-')}.csv`;
    a.click();
    showToast('CSV exported!');
}

function backupData() {
    const backup = {
        clients,
        jobs,
        staffActivities,
        inventory,
        date: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `TBOS_Backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    showToast('Backup downloaded!');
}

// ==================== PWA HELPER FUNCTIONS ====================
function checkInstallability() {
    if (window.matchMedia('(display-mode: standalone)').matches) {
        console.log('✅ Running as installed PWA');
        return true;
    }
    if (document.referrer.includes('android-app://')) {
        console.log('✅ Running as installed PWA (Android)');
        return true;
    }
    return false;
}

function shareApp() {
    if (navigator.share) {
        navigator.share({
            title: 'TBOS v3.0',
            text: 'Tomstudio BizHub Operations System - Track, Record, Route, Report, Improve!',
            url: window.location.href
        }).catch(console.error);
    } else {
        showToast('Share not supported on this device');
    }
}

// Export for global use
window.login = login;
window.logout = logout;
window.addClient = addClient;
window.renderClients = renderClients;
window.addJob = addJob;
window.renderJobs = renderJobs;
window.sendWhatsApp = sendWhatsApp;
window.sendJobWhatsApp = sendJobWhatsApp;
window.addInventory = addInventory;
window.renderInventory = renderInventory;
window.openAdminModal = openAdminModal;
window.closeAdminModal = closeAdminModal;
window.checkAdminPassword = checkAdminPassword;
window.approveStaff = approveStaff;
window.exportCSV = exportCSV;
window.backupData = backupData;
window.installApp = installApp;
window.shareApp = shareApp;