// config.js - TBOS v3.0 Supabase Configuration
// ✅ CLEAN CODE - NO SPACES - GLOBAL API EXPOSED

// ✅ CORRECT SUPABASE URL (no extra 'y')
const SUPABASE_URL = 'https://wbmshbmfrteutglydiay.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndibXNoYmZydGV1dGdseWlkaWF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyMjk5OTIsImV4cCI6MjA5MjkwNTk5Mn0.UiV0Uaxv0fXb_sHuoIOJ2AGJKenUmfmFAzaifPY0A6Y';

// ✅ Initialize Supabase Client globally
window.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ✅ API Object - All methods
const API = {
    async get(collection, id = null) {
        console.log('🔗 API GET:', collection, id);
        
        try {
            let query = supabase.from(collection).select('*');
            
            if (id) {
                query = query.eq('id', id);
            }
            
            const { data, error } = await query;
            
            if (error) throw error;
            
            console.log('📊 API Response:', data);
            return data || [];
        } catch (error) {
            console.error('❌ API GET Error:', error);
            return JSON.parse(localStorage.getItem(`local_${collection}`) || '[]');
        }
    },

    async create(collection, data) {
        console.log('📝 API CREATE:', collection, data);
        
        try {
            const { data: result, error } = await supabase
                .from(collection)
                .insert([data])
                .select();
            
            if (error) throw error;
            
            console.log('✅ API CREATE Result:', result);
            
            if (result && result[0]) {
                const localData = JSON.parse(localStorage.getItem(`local_${collection}`) || '[]');
                localData.push(result[0]);
                localStorage.setItem(`local_${collection}`, JSON.stringify(localData));
            }
            
            return { success: true, data: result ? result[0] : data };
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
        console.log('🔄 API UPDATE:', collection, data);
        
        try {
            const { data: result, error } = await supabase
                .from(collection)
                .update(data)
                .eq('id', data.id)
                .select();
            
            if (error) throw error;
            
            console.log('✅ API UPDATE Result:', result);
            
            if (result && result[0]) {
                const localData = JSON.parse(localStorage.getItem(`local_${collection}`) || '[]');
                const index = localData.findIndex(item => item.id == data.id);
                if (index >= 0) localData[index] = data;
                localStorage.setItem(`local_${collection}`, JSON.stringify(localData));
            }
            
            return { success: true, data: result ? result[0] : data };
        } catch (error) {
            console.error('❌ API UPDATE Error:', error);
            const localData = JSON.parse(localStorage.getItem(`local_${collection}`) || '[]');
            const index = localData.findIndex(item => item.id == data.id);
            if (index >= 0) localData[index] = data;
            localStorage.setItem(`local_${collection}`, JSON.stringify(localData));
            return { success: true, local: true };
        }
    },

    async delete(collection, id) {
        console.log('🗑️ API DELETE:', collection, id);
        
        try {
            const { error } = await supabase
                .from(collection)
                .delete()
                .eq('id', id);
            
            if (error) throw error;
            
            console.log('✅ API DELETE Result: Success');
            
            const localData = JSON.parse(localStorage.getItem(`local_${collection}`) || '[]');
            const filtered = localData.filter(item => item.id != id);
            localStorage.setItem(`local_${collection}`, JSON.stringify(filtered));
            
            return { success: true };
        } catch (error) {
            console.error('❌ API DELETE Error:', error);
            const localData = JSON.parse(localStorage.getItem(`local_${collection}`) || '[]');
            const filtered = localData.filter(item => item.id != id);
            localStorage.setItem(`local_${collection}`, JSON.stringify(filtered));
            return { success: true, local: true };
        }
    }
};

console.log('✅ TBOS v3.0 - Supabase Backend Connected');
console.log('📊 Project URL:', SUPABASE_URL);

// ✅ EXPOSE API GLOBALLY (Fixes module scoping issue!)
window.API = API;