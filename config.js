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
            console.log(`📥 GET: ${collection}`, id || 'all');

            try {
                if (!ensureSupabase()) {
                    throw new Error('Supabase not initialized');
                }

                let query = supabaseClient.from(collection).select('*');

                if (id !== null) {
                    query = query.eq('id', id).single();
                }

                const { data, error } = await query;

                if (error) throw error;

                if (!id && Array.isArray(data)) {
                    saveLocalData(collection, data);
                }

                return data || [];
            } catch (error) {
                console.error('❌ GET Error:', error);

                const localData = getLocalData(collection);

                if (id !== null) {
                    return localData.find(item => item.id == id) || null;
                }

                return localData;
            }
        },

        async create(collection, payload) {
            console.log(`📝 CREATE: ${collection}`, payload);

            try {
                if (!ensureSupabase()) {
                    throw new Error('Supabase not initialized');
                }

                const { data, error } = await supabaseClient
                    .from(collection)
                    .insert([payload])
                    .select()
                    .single();

                if (error) throw error;

                const localData = getLocalData(collection);
                localData.push(data);
                saveLocalData(collection, localData);

                return {
                    success: true,
                    data: data
                };
            } catch (error) {
                console.error('❌ CREATE Error:', error);

                payload.id = Date.now().toString();

                const localData = getLocalData(collection);
                localData.push(payload);
                saveLocalData(collection, localData);

                return {
                    success: true,
                    data: payload,
                    offline: true
                };
            }
        },

        async update(collection, payload) {
            console.log(`🔄 UPDATE: ${collection}`, payload);

            try {
                if (!ensureSupabase()) {
                    throw new Error('Supabase not initialized');
                }

                const { data, error } = await supabaseClient
                    .from(collection)
                    .update(payload)
                    .eq('id', payload.id)
                    .select()
                    .single();

                if (error) throw error;

                const localData = getLocalData(collection);
                const index = localData.findIndex(item => item.id == payload.id);

                if (index !== -1) {
                    localData[index] = data;
                    saveLocalData(collection, localData);
                }

                return {
                    success: true,
                    data: data
                };
            } catch (error) {
                console.error('❌ UPDATE Error:', error);

                const localData = getLocalData(collection);
                const index = localData.findIndex(item => item.id == payload.id);

                if (index !== -1) {
                    localData[index] = payload;
                    saveLocalData(collection, localData);
                }

                return {
                    success: true,
                    data: payload,
                    offline: true
                };
            }
        },

        async delete(collection, id) {
            console.log(`🗑️ DELETE: ${collection}`, id);

            try {
                if (ensureSupabase()) {
                    const { error } = await supabaseClient
                        .from(collection)
                        .delete()
                        .eq('id', id);

                    if (error) throw error;
                }
            } catch (error) {
                console.error('❌ DELETE Error:', error);
            }

            const localData = getLocalData(collection);
            const filtered = localData.filter(item => item.id != id);

            saveLocalData(collection, filtered);

            return {
                success: true
            };
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
