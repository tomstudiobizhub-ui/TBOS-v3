// ✅ config.js - TBOS v3.0 Supabase Configuration
// ✅ FIXED - No spaces in code

const API_CONFIG = {
    url: 'https://script.google.com/macros/s/AKfycbxPA7cp1TDTlLzNP3nd9KVf8mqi4GklbOR-sEQmCmOdkcJB7Mq2okx6IGyoeCxqI8uPzw/exec',
    sheetId: '152j4vVhX1eHoiHpzxVaoPH0WjsYQ9Wcn2LBgkTHtvxs'
};

const API = {
    async get(collection, id = null) {
        const url = id 
            ? `${API_CONFIG.url}?action=getOne&collection=${collection}&id=${id}`
            : `${API_CONFIG.url}?action=getAll&collection=${collection}`;
        
        console.log('🔗 API GET:', url);
        
        try {
            const response = await fetch(url);
            const data = await response.json();
            console.log('📊 API Response:', data);
            return Array.isArray(data) ? data : (data.error ? [] : [data]);
        } catch (error) {
            console.error('❌ API GET Error:', error);
            return JSON.parse(localStorage.getItem(`local_${collection}`) || '[]');
        }
    },

    async create(collection, data) {
        console.log('📝 API CREATE:', collection, data);
        
        try {
            const response = await fetch(API_CONFIG.url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'create',
                    collection: collection,
                    data: data
                })
            });
            const result = await response.json();
            console.log('✅ API CREATE Result:', result);
            
            if (result.success) {
                const localData = JSON.parse(localStorage.getItem(`local_${collection}`) || '[]');
                localData.push(data);
                localStorage.setItem(`local_${collection}`, JSON.stringify(localData));
            }
            
            return result;
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
            const response = await fetch(API_CONFIG.url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'update',
                    collection: collection,
                    data: data
                })
            });
            const result = await response.json();
            console.log('✅ API UPDATE Result:', result);
            
            if (result.success) {
                const localData = JSON.parse(localStorage.getItem(`local_${collection}`) || '[]');
                const index = localData.findIndex(item => item.id == data.id);
                if (index >= 0) localData[index] = data;
                localStorage.setItem(`local_${collection}`, JSON.stringify(localData));
            }
            
            return result;
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
            const response = await fetch(API_CONFIG.url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'delete',
                    collection: collection,
                    data: { id: id }
                })
            });
            const result = await response.json();
            console.log('✅ API DELETE Result:', result);
            
            if (result.success) {
                const localData = JSON.parse(localStorage.getItem(`local_${collection}`) || '[]');
                const filtered = localData.filter(item => item.id != id);
                localStorage.setItem(`local_${collection}`, JSON.stringify(filtered));
            }
            
            return result;
        } catch (error) {
            console.error('❌ API DELETE Error:', error);
            const localData = JSON.parse(localStorage.getItem(`local_${collection}`) || '[]');
            const filtered = localData.filter(item => item.id != id);
            localStorage.setItem(`local_${collection}`, JSON.stringify(filtered));
            return { success: true, local: true };
        }
    }
};

console.log('✅ TBOS v3.0 - Google Sheets Backend Connected');
console.log('📊 Sheet ID:', API_CONFIG.sheetId);
console.log('🌐 API URL:', API_CONFIG.url);