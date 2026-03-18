// assets/js/auth.js

// Check if user is logged in
function checkAuth() {
    const user = localStorage.getItem('tbos_user');
    if(!user) {
        window.location.href = 'index.html';
        return false;
    }
    
    currentUser = JSON.parse(user);
    applyTheme(currentUser.hub);
    updateUserInfo();
    return true;
}

// Login with Supabase
async function loginUser(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password
    });

    if (error) {
        alert('Login failed: ' + error.message);
        return;
    }

    // Get user profile from database
    const {  profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();

    if (profileError || !profile) {
        alert('Profile not found. Contact admin.');
        return;
    }

    // Store user session
    const userSession = {
        id: profile.id,
        name: profile.full_name,
        email: profile.email,
        role: profile.role,
        hub: profile.hub,
        phone: profile.phone
    };
    
    localStorage.setItem('tbos_user', JSON.stringify(userSession));
    localStorage.setItem('tbos_hub', profile.hub);
    localStorage.setItem('tbos_role', profile.role);
    
    // Redirect based on role
    if(profile.role === 'Administrator') {
        window.location.href = 'admin.html';
    } else {
        window.location.href = 'dashboard.html';
    }
}

// Demo login (for testing without Supabase)
function demoLogin() {
    const userSession = {
        id: 'demo-123',
        name: 'Demo Admin',
        email: 'admin@tbos.com',
        role: 'Administrator',
        hub: 'IT',
        phone: '+2348030827417'
    };
    
    localStorage.setItem('tbos_user', JSON.stringify(userSession));
    localStorage.setItem('tbos_hub', 'IT');
    localStorage.setItem('tbos_role', 'Administrator');
    window.location.href = 'dashboard.html';
}

// Logout
async function logout() {
    await supabase.auth.signOut();
    localStorage.removeItem('tbos_user');
    localStorage.removeItem('tbos_hub');
    localStorage.removeItem('tbos_role');
    window.location.href = 'index.html';
}

// Update user info in UI
function updateUserInfo() {
    if(currentUser) {
        const nameEl = document.getElementById('user-name');
        const hubEl = document.getElementById('user-hub-badge');
        
        if(nameEl) nameEl.innerText = currentUser.name;
        if(hubEl) hubEl.innerText = currentUser.hub;
        
        // Show admin sections if admin
        if(currentUser.role === 'Administrator') {
            document.querySelectorAll('.admin-only').forEach(function(el) { 
                el.classList.remove('hidden'); 
            });
        }
    }
}

// Apply hub theme
function applyTheme(hub) {
    const hubColors = {
        'Graphics Design': 'hub-blue',
        'Printing': 'hub-red',
        'Photography': 'hub-yellow',
        'Tech Academy': 'hub-purple',
        'Online Shop': 'hub-teal',
        'IT': 'hub-cyan'
    };
    
    document.body.className = '';
    const themeClass = hubColors[hub] || 'hub-grey';
    document.body.classList.add(themeClass);
}

// Toggle sidebar
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    if(sidebar) sidebar.classList.toggle('active');
}

// Toggle modal
function toggleModal(modalId) {
    const modal = document.getElementById(modalId);
    if(modal) {
        modal.style.display = modal.style.display === 'flex' ? 'none' : 'flex';
    }
}

// Toggle notifications
function toggleNotifications() {
    const panel = document.getElementById('notification-panel');
    if(panel) panel.classList.toggle('active');
}