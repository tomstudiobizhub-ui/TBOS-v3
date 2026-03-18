// Supabase Configuration
c// Supabase Configuration
const SUPABASE_URL = 'https://epvgarbconcrwasccjxu.supabase.co';
const SUPABASE_KEY = 'sb_publishable_ZTwyZPfFc8uXFXpG_Wkarw_f5ygNfBg'; // Anon key ONLY

// Initialize Supabase Client
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);


// Database Tables Structure
/*
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    hub TEXT NOT NULL,
    phone TEXT,
    status TEXT DEFAULT 'pending',
    score INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tracking_id TEXT UNIQUE NOT NULL,
    invoice_id TEXT UNIQUE NOT NULL,
    client_name TEXT NOT NULL,
    client_phone TEXT NOT NULL,
    client_email TEXT,
    hub TEXT NOT NULL,
    description TEXT NOT NULL,
    amount DECIMAL NOT NULL,
    paid DECIMAL DEFAULT 0,
    balance DECIMAL DEFAULT 0,
    status TEXT DEFAULT 'UNPAID',
    stage TEXT DEFAULT 'Pending',
    delivery_date DATE NOT NULL,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE job_timeline (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID REFERENCES jobs(id),
    stage TEXT NOT NULL,
    staff_name TEXT NOT NULL,
    timestamp TIMESTAMP DEFAULT NOW(),
    notes TEXT
);

CREATE TABLE inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    category TEXT,
    stock INTEGER NOT NULL,
    alert_level INTEGER NOT NULL,
    status TEXT DEFAULT 'OK',
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE announcements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message TEXT NOT NULL,
    type TEXT DEFAULT 'info',
    target_hub TEXT DEFAULT 'all',
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL,
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);
*/