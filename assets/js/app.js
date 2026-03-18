// assets/js/app.js

// AI Price Estimator
function calculateAIPrice() {
    const hub = document.getElementById('job-hub').value;
    const desc = document.getElementById('job-desc').value;
    
    if(!hub) {
        document.getElementById('job-ai').value = '';
        return;
    }
    
    const aiBaseRates = {
        'Graphics Design': 5000,
        'Printing': 10000,
        'Photography': 25000,
        'Tech Academy': 3000,
        'Online Shop': 2000
    };
    
    const base = aiBaseRates[hub] || 3000;
    const complexity = desc.length > 100 ? 1.5 : (desc.length > 50 ? 1.2 : 1.0);
    const estimated = Math.round(base * complexity);
    const min = Math.round(estimated * 0.8);
    const max = Math.round(estimated * 1.2);
    
    document.getElementById('job-ai').value = 
        '₦' + estimated.toLocaleString() + ' (Range: ₦' + min.toLocaleString() + ' - ₦' + max.toLocaleString() + ')';
    document.getElementById('job-amount').value = estimated;
}

// Load Dashboard Data from Supabase
async function loadDashboard() {
    // Load Jobs Count
    const {  jobs } = await supabase.from('jobs').select('id, status, stage, paid, amount');
    
    if(jobs) {
        document.getElementById('stat-jobs').innerText = jobs.length;
        document.getElementById('stat-pending').innerText = jobs.filter(j => j.status === 'UNPAID').length;
        
        const revenue = jobs.reduce((sum, j) => sum + parseFloat(j.paid || 0), 0);
        document.getElementById('stat-revenue').innerText = '₦' + revenue.toLocaleString();
        
        document.getElementById('stat-delayed').innerText = jobs.filter(j => 
            j.status === 'UNPAID' && j.stage !== 'Completed'
        ).length;
    }
    
    // Load Staff Leaderboard
    const {  staff } = await supabase
        .from('profiles')
        .select('full_name, role, hub, score')
        .eq('status', 'Active')
        .order('score', { ascending: false })
        .limit(5);
    
    if(staff) {
        let html = '';
        staff.forEach((s, i) => {
            html += '<tr>' +
                '<td><span style="color: var(--primary); font-weight: 700;">#' + (i + 1) + '</span></td>' +
                '<td>' + s.full_name + '</td>' +
                '<td>' + s.hub + '</td>' +
                '<td><span class="status-badge status-completed">' + s.score + '</span></td>' +
                '<td>' + Math.floor(s.score / 5) + '</td></tr>';
        });
        document.getElementById('leaderboard-body').innerHTML = html;
    }
    
    // Update badges
    if(jobs) {
        document.getElementById('job-badge').innerText = jobs.filter(j => j.status === 'UNPAID').length;
    }
    
    loadNotifications();
}

// Load Jobs from Supabase
async function loadJobs() {
    const tbody = document.getElementById('job-table-body');
    if(!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="7" class="loading">Loading jobs...</td></tr>';
    
    const {  jobs, error } = await supabase
        .from('jobs')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error loading jobs:', error);
        tbody.innerHTML = '<tr><td colspan="7">Error loading jobs</td></tr>';
        return;
    }

    let html = '';
    jobs.forEach(function(job) {
        var statusClass = job.status === 'PAID' ? 'status-paid' : 
                           job.status === 'PARTIAL' ? 'status-partial' : 'status-unpaid';
        
        html += '<tr>' +
            '<td><strong class="text-primary">' + job.tracking_id + '</strong></td>' +
            '<td>' + job.client_name + '<br><small style="color: var(--text-muted);">' + job.client_phone + '</small></td>' +
            '<td>' + job.hub + '</td>' +
            '<td>' + job.stage + '</td>' +
            '<td>₦' + parseFloat(job.amount).toLocaleString() + '</td>' +
            '<td><span class="status-badge ' + statusClass + '">' + job.status + '</span></td>' +
            '<td>' +
            '<button class="btn-sm btn-info" onclick="viewJobDetail(\'' + job.id + '\')"><i class="fas fa-eye"></i></button> ' +
            '<button class="btn-sm btn-success" onclick="showInvoiceByTracking(\'' + job.tracking_id + '\')"><i class="fas fa-file-invoice"></i></button> ' +
            '<button class="btn-sm btn-whatsapp" onclick="sendJobWhatsApp(\'' + job.tracking_id + '\')"><i class="fab fa-whatsapp"></i></button>' +
            '</td></tr>';
    });
    
    tbody.innerHTML = html;
}

// Create New Job with Supabase
async function createJob(jobData) {
    const user = JSON.parse(localStorage.getItem('tbos_user'));
    
    const newJob = {
        tracking_id: jobData.trackingId,
        invoice_id: jobData.invoiceId,
        client_name: jobData.client,
        client_phone: jobData.phone,
        client_email: jobData.email || null,
        hub: jobData.hub,
        description: jobData.description,
        amount: jobData.amount,
        paid: jobData.paid,
        balance: jobData.amount - jobData.paid,
        status: jobData.paid >= jobData.amount ? 'PAID' : (jobData.paid > 0 ? 'PARTIAL' : 'UNPAID'),
        stage: 'Pending',
        delivery_date: jobData.deliveryDate,
        created_by: user.id
    };

    const { data, error } = await supabase
        .from('jobs')
        .insert([newJob])
        .select();

    if (error) {
        console.error('Error creating job:', error);
        alert('Error creating job: ' + error.message);
        return null;
    }

    // Add to timeline
    await supabase.from('job_timeline').insert([{
        job_id: data[0].id,
        stage: 'Job Created',
        staff_name: user.name,
        notes: 'Job logged via TBOS v3.0'
    }]);

    return data[0];
}

// WhatsApp Integration
function sendWhatsAppNotification(clientName, phone, trackingId, message) {
    var cleanPhone = phone.replace(/[^0-9]/g, '');
    if(cleanPhone.startsWith('234')) {
        cleanPhone = cleanPhone.substring(3);
    }
    
    var whatsappMessage = 'Hello ' + clientName + ',\n\n' +
        'TBOS Update - ' + trackingId + '\n' +
        message + '\n\n' +
        'Thank you for choosing Tomstudio BizHub!\n' +
        'Contact: +234 803 082 7417';
    
    var whatsappURL = 'https://wa.me/234' + cleanPhone + '?text=' + encodeURIComponent(whatsappMessage);
    window.open(whatsappURL, '_blank');
}

function sendJobWhatsApp(trackingId) {
    // Fetch job from Supabase and send WhatsApp
    supabase.from('jobs').select('*').eq('tracking_id', trackingId).single().then(({  job }) => {
        if(job) {
            sendWhatsAppNotification(job.client_name, job.client_phone, job.tracking_id, 
                'Status: ' + job.stage + ' | Amount: ₦' + parseFloat(job.amount).toLocaleString());
        }
    });
}

// Load Notifications
async function loadNotifications() {
    const user = JSON.parse(localStorage.getItem('tbos_user'));
    if(!user || !user.id) return;
    
    const {  notifications } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .eq('read', false)
        .order('created_at', { ascending: false })
        .limit(10);
    
    const list = document.getElementById('notification-list');
    const count = document.getElementById('notif-count');
    
    if(notifications && list) {
        let html = '';
        notifications.forEach(function(n) {
            var icon = n.type === 'job' ? 'briefcase' : n.type === 'payment' ? 'money-bill' : 'exclamation-triangle';
            html += '<div class="notification-item">' +
                '<div class="notification-icon"><i class="fas fa-' + icon + '"></i></div>' +
                '<div class="notification-content">' +
                '<div class="notification-title">' + n.title + '</div>' +
                '<div style="font-size: 0.85rem; color: var(--text-muted);">' + n.message + '</div>' +
                '<div class="notification-time">' + new Date(n.created_at).toLocaleString() + '</div></div></div>';
        });
        
        list.innerHTML = html;
        if(count) count.innerText = notifications.length;
    }
}

// Load Inventory
async function loadInventory() {
    const tbody = document.getElementById('inventory-table-body');
    if(!tbody) return;
    
    const {  inventory } = await supabase.from('inventory').select('*').order('name');
    
    if(inventory) {
        let html = '';
        inventory.forEach(function(item) {
            const statusClass = item.status === 'OK' ? 'status-paid' : 
                               item.status === 'LOW' ? 'status-partial' : 'status-unpaid';
            
            html += '<tr>' +
                '<td>' + item.name + '</td>' +
                '<td>' + item.stock + '</td>' +
                '<td>' + item.alert_level + '</td>' +
                '<td><span class="status-badge ' + statusClass + '">' + item.status + '</span></td></tr>';
        });
        
        tbody.innerHTML = html;
        
        // Update stats
        document.getElementById('inv-total').innerText = inventory.length;
        document.getElementById('inv-low').innerText = inventory.filter(i => i.status === 'LOW').length;
        document.getElementById('inv-out').innerText = inventory.filter(i => i.status === 'OUT').length;
        document.getElementById('inv-ok').innerText = inventory.filter(i => i.status === 'OK').length;
    }
}

// Load Staff
async function loadStaff() {
    const tbody = document.getElementById('staff-table-body');
    if(!tbody) return;
    
    const {  staff } = await supabase.from('profiles').select('*').eq('status', 'Active').order('full_name');
    
    if(staff) {
        let html = '';
        staff.forEach(function(s) {
            const statusClass = s.status === 'Active' ? 'status-paid' : 'status-partial';
            
            html += '<tr>' +
                '<td>' + s.full_name + '</td>' +
                '<td>' + s.email + '</td>' +
                '<td>' + s.role + '</td>' +
                '<td>' + s.hub + '</td>' +
                '<td><span class="status-badge ' + statusClass + '">' + s.status + '</span></td>' +
                '<td><span class="status-badge status-completed">' + s.score + '</span></td>' +
                '<td>' +
                '<button class="btn-sm btn-info" onclick="showStaffID(\'' + s.full_name + '\', \'' + s.role + '\', \'' + s.hub + '\')">' +
                '<i class="fas fa-id-card"></i></button></td></tr>';
        });
        
        tbody.innerHTML = html;
    }
}