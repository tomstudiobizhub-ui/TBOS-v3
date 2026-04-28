// config.js - TBOS v3.0 Supabase Configuration
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

// ✅ YOUR SUPABASE CREDENTIALS
const SUPABASE_URL = 'https://wbmshbmfrteutglydiay.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndibXNoYm1mcnRldXRnbHlkaWF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczMjk5OTIsImV4cCI6MjA5MjkwNTk5Mn0.UiV0Uaxv0fXb_sHuoIOJ2AGJKenUmfmFAzaifPY0A6Y';

// ✅ Initialize Supabase Client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ✅ API Helper Functions
const API = {
    async get(collection, id = null) {
        try {
            let query = supabase.from(collection).select('*');
            if (id) query = query.eq('id', id);
            const { data, error } = await query;
            if (error) throw error;
            console.log('✅ GET:', collection, data?.length || 0, 'records');
            return data || [];
        } catch (error) {
            console.error('❌ API GET Error:', error);
            return JSON.parse(localStorage.getItem(`local_${collection}`) || '[]');
        }
    },

    async create(collection, data) {
        try {
            const { data: result, error } = await supabase
                .from(collection)
                .insert([data])
                .select();
            if (error) throw error;
            console.log('✅ CREATE:', collection, result[0]);
            const localData = JSON.parse(localStorage.getItem(`local_${collection}`) || '[]');
            localData.push(result[0]);
            localStorage.setItem(`local_${collection}`, JSON.stringify(localData));
            return { success: true, data: result[0] };
        } catch (error) {
            console.error('❌ API CREATE Error:', error);
            const localData = JSON.parse(localStorage.getItem(`local_${collection}`) || '[]');
            data.id = Date.now().toString();
            localData.push(data);
            localStorage.setItem(`local_${collection}`, JSON.stringify(localData));
            return { success: true, id: data.id, local: true };
        }
    },

    async update(collection, data) {
        try {
            const { data: result, error } = await supabase
                .from(collection)
                .update(data)
                .eq('id', data.id)
                .select();
            if (error) throw error;
            console.log('✅ UPDATE:', collection, result[0]);
            const localData = JSON.parse(localStorage.getItem(`local_${collection}`) || '[]');
            const index = localData.findIndex(item => item.id === data.id);
            if (index >= 0) localData[index] = data;
            localStorage.setItem(`local_${collection}`, JSON.stringify(localData));
            return { success: true, data: result[0] };
        } catch (error) {
            console.error('❌ API UPDATE Error:', error);
            const localData = JSON.parse(localStorage.getItem(`local_${collection}`) || '[]');
            const index = localData.findIndex(item => item.id === data.id);
            if (index >= 0) localData[index] = data;
            localStorage.setItem(`local_${collection}`, JSON.stringify(localData));
            return { success: true, local: true };
        }
    },

    async delete(collection, id) {
        try {
            const { error } = await supabase
                .from(collection)
                .delete()
                .eq('id', id);
            if (error) throw error;
            console.log('✅ DELETE:', collection, id);
            const localData = JSON.parse(localStorage.getItem(`local_${collection}`) || '[]');
            const filtered = localData.filter(item => item.id !== id);
            localStorage.setItem(`local_${collection}`, JSON.stringify(filtered));
            return { success: true };
        } catch (error) {
            console.error('❌ API DELETE Error:', error);
            const localData = JSON.parse(localStorage.getItem(`local_${collection}`) || '[]');
            const filtered = localData.filter(item => item.id !== id);
            localStorage.setItem(`local_${collection}`, JSON.stringify(filtered));
            return { success: true, local: true };
        }
    },

    async login(email, password) {
        try {
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .eq('email', email)
                .eq('password', password)
                .single();
            if (error || !data) throw new Error('Invalid credentials');
            if (data.status !== 'Active') throw new Error('Account not active');
            console.log('✅ LOGIN:', data.name);
            localStorage.setItem('currentUser', JSON.stringify(data));
            localStorage.setItem('currentStaffId', data.id);
            return { success: true, user: data };
        } catch (error) {
            console.error('❌ LOGIN Error:', error);
            return { success: false, error: error.message };
        }
    },

    logout() {
        localStorage.removeItem('currentUser');
        localStorage.removeItem('currentStaffId');
        console.log('✅ LOGOUT');
    }
};

console.log('✅ TBOS v3.0 - Supabase Backend Connected');
console.log('📊 Project URL:', SUPABASE_URL);

// Make supabase and API available globally
window.supabase = supabase;
window.API = API;