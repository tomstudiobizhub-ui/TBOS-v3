// config.js - TBOS v3.0 Supabase Configuration
// ============================================
// IMPORTANT: Load scripts in this exact order in ALL HTML files:
//
// 1. <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
// 2. <script src="config.js"></script>
// ============================================

(function() {
    'use strict';

    // ============================================
    // SUPABASE SETTINGS
    // ============================================
    const SUPABASE_URL = 'https://wbmshbmfrteutglydiay.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndibXNoYm1mcnRldXRnbHlkaWF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczMjk5OTIsImV4cCI6MjA5MjkwNTk5Mn0.UiV0Uaxv0fXb_sHuoIOJ2AGJKenUmfmFAzaifPY0A6Y';

    let supabaseClient = null;
    let initialized = false;

    // ============================================
    // LOCAL STORAGE HELPERS
    // ============================================
    function getLocalData(collection) {
        try {
            return JSON.parse(localStorage.getItem(`local_${collection}`) || '[]');
        } catch (error) {
            console.error('Error reading localStorage:', error);
            return [];
        }
    }

    function saveLocalData(collection, data) {
        try {
            localStorage.setItem(`local_${collection}`, JSON.stringify(data));
        } catch (error) {
            console.error('Error saving to localStorage:', error);
        }
    }

    // ============================================
    // INITIALIZE SUPABASE
    // ============================================
    function initSupabase() {
        if (initialized) return true;

        if (typeof window.supabase === 'undefined' || typeof window.supabase.createClient !== 'function') {
            console.error(
                '❌ Supabase library not loaded.\n' +
                'Make sure this script appears BEFORE config.js:\n' +
                '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>'
            );
            return false;
        }

        try {
            supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
            // Expose the existing client for authenticated modules; never expose a service-role key.
            window.TBOS_SUPABASE = supabaseClient;
            initialized = true;

            console.log('✅ TBOS v3.0 - Supabase Connected');
            console.log('📡 Project URL:', SUPABASE_URL);

            return true;
        } catch (error) {
            console.error('❌ Supabase Initialization Failed:', error);
            return false;
        }
    }

    // ============================================
    // ENSURE SUPABASE IS READY
    // ============================================
    function ensureSupabase() {
        if (!initialized) {
            initSupabase();
        }
        return initialized;
    }

    // ============================================
    // API WRAPPER - PRO ARCHITECTURE
    // ============================================
    const API = {
        async get(collection, id = null) {
            if (!ensureSupabase()) throw new Error('Supabase is unavailable; no cached data was used.');
            if (collection === 'users') {
                if (id !== null) {
                    const { data: profile, error: profileError } = await supabaseClient.rpc('tbos_my_safe_profile');
                    if (profileError) throw profileError;
                    return profile && profile.id === id ? profile : null;
                }
                const { data: profile, error: profileError } = await supabaseClient.rpc('tbos_my_safe_profile');
                if (profileError) throw profileError;
                if (!profile) return [];
                if (profile.role === 'Administrator') {
                    const { data, error } = await supabaseClient.rpc('tbos_admin_list_profiles');
                    if (error) throw error;
                    return Array.isArray(data) ? data : [];
                }
                return [profile];
            }
            let query = supabaseClient.from(collection).select('*');
            if (id !== null) query = query.eq('id', id).single();
            const { data, error } = await query;
            if (error) {
                console.error('GET failed:', collection, error);
                throw error;
            }
            return data ?? (id !== null ? null : []);
        },
        async create(collection, payload) {
            if (!ensureSupabase()) return { success: false, error: 'Supabase is unavailable.' };
            const { data, error } = await supabaseClient.from(collection).insert([payload]).select().single();
            if (error) {
                console.error('CREATE failed:', collection, error);
                return { success: false, error: error.message };
            }
            return { success: true, data };
        },
        async update(collection, payload) {
            if (!ensureSupabase()) return { success: false, error: 'Supabase is unavailable.' };
            if (!payload || payload.id == null) return { success: false, error: 'A record id is required.' };
            const { data, error } = await supabaseClient.from(collection).update(payload).eq('id', payload.id).select().single();
            if (error) {
                console.error('UPDATE failed:', collection, error);
                return { success: false, error: error.message };
            }
            return { success: true, data };
        },
        async delete(collection, id) {
            if (!ensureSupabase()) return { success: false, error: 'Supabase is unavailable.' };
            const { error, count } = await supabaseClient.from(collection).delete({ count: 'exact' }).eq('id', id);
            if (error) {
                console.error('DELETE failed:', collection, error);
                return { success: false, error: error.message };
            }
            return { success: true, count };
        }
    };

    // ============================================
    // GLOBAL EXPORT
    // ============================================
    window.API = API;
    window.initSupabase = initSupabase;
    window.supabaseClient = supabaseClient;

    // ============================================
    // AUTO INITIALIZE
    // ============================================
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSupabase);
    } else {
        initSupabase();
    }

    console.log(' TBOS v3.0 API Ready - Use API.get(), API.create(), API.update(), API.delete()');
})();
