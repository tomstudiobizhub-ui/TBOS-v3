// config.js - TBOS v3.0 Supabase Configuration
// ============================================
// Global Supabase API Wrapper
// Must be loaded AFTER:
// <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>

(function () {
    'use strict';

    // ============================================
    // SUPABASE CONFIGURATION
    // ============================================
    const SUPABASE_URL = 'https://wbmshbmfrteutglydiay.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndibXNoYm1mcnRldXRnbHlkaWF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczMjk5OTIsImV4cCI6MjA5MjkwNTk5Mn0.UiV0Uaxv0fXb_sHuoIOJ2AGJKenUmfmFAzaifPY0A6Y';

    let supabaseClient = null;

    // ============================================
    // INITIALIZE SUPABASE
    // ============================================
    function initSupabase() {
        try {
            if (!window.supabase) {
                throw new Error('Supabase library not loaded.');
            }

            supabaseClient = window.supabase.createClient(
                SUPABASE_URL,
                SUPABASE_KEY
            );

            console.log('✅ TBOS v3.0 - Supabase Connected');
            console.log('📡 URL:', SUPABASE_URL);

            return true;
        } catch (error) {
            console.error('❌ Supabase Initialization Failed:', error);
            return false;
        }
    }

    // ============================================
    // LOCAL STORAGE HELPERS
    // ============================================
    function getLocalData(collection) {
        return JSON.parse(
            localStorage.getItem(`local_${collection}`) || '[]'
        );
    }

    function saveLocalData(collection, data) {
        localStorage.setItem(
            `local_${collection}`,
            JSON.stringify(data)
        );
    }

    // ============================================
    // API METHODS
    // ============================================
    const API = {
        async get(collection, id = null) {
            console.log('📥 GET:', collection, id || 'all');

            try {
                if (!supabaseClient) {
                    throw new Error('Supabase not initialized');
                }

                let query = supabaseClient
                    .from(collection)
                    .select('*');

                if (id !== null) {
                    query = query.eq('id', id).single();
                }

                const { data, error } = await query;

                if (error) throw error;

                if (!id) {
                    saveLocalData(collection, data || []);
                }

                return data || [];
            } catch (error) {
                console.error('❌ GET Error:', error);
                return id
                    ? getLocalData(collection).find(item => item.id == id) || null
                    : getLocalData(collection);
            }
        },

        async create(collection, payload) {
            console.log('📝 CREATE:', collection, payload);

            try {
                if (!supabaseClient) {
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
                    data
                };
            } catch (error) {
                console.error('❌ CREATE Error:', error);

                payload.id = Date.now();

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
            console.log('🔄 UPDATE:', collection, payload);

            try {
                if (!supabaseClient) {
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
                const index = localData.findIndex(
                    item => item.id == payload.id
                );

                if (index !== -1) {
                    localData[index] = data;
                    saveLocalData(collection, localData);
                }

                return {
                    success: true,
                    data
                };
            } catch (error) {
                console.error('❌ UPDATE Error:', error);

                const localData = getLocalData(collection);
                const index = localData.findIndex(
                    item => item.id == payload.id
                );

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
            console.log('🗑️ DELETE:', collection, id);

            try {
                if (!supabaseClient) {
                    throw new Error('Supabase not initialized');
                }

                const { error } = await supabaseClient
                    .from(collection)
                    .delete()
                    .eq('id', id);

                if (error) throw error;
            } catch (error) {
                console.error('❌ DELETE Error:', error);
            }

            const localData = getLocalData(collection);
            const filtered = localData.filter(
                item => item.id != id
            );

            saveLocalData(collection, filtered);

            return {
                success: true
            };
        }
    };

    // ============================================
    // GLOBAL EXPORTS
    // ============================================
    window.API = API;
    window.initSupabase = initSupabase;

    // ============================================
    // AUTO INITIALIZATION
    // ============================================
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSupabase);
    } else {
        initSupabase();
    }
})();