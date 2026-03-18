// Mock Database (Replace with Firebase in production)
const db = {
    jobs: [
        { 
            trackingId: 'TBOS-240001', invoiceId: 'INV-2026-0001',
            client: 'John Doe', phone: '+2348030827417',
            hub: 'Graphics Design', description: 'Logo design and branding',
            amount: 50000, paid: 50000, balance: 0, 
            status: 'PAID', stage: 'Completed', 
            deliveryDate: '2026-01-20', createdAt: '2026-01-15',
            timeline: [
                { stage: 'Job Created', staff: 'Admin', time: '2026-01-15 09:00' },
                { stage: 'Graphics Completed', staff: 'Grace', time: '2026-01-17 14:00' },
                { stage: 'Job Delivered', staff: 'Admin', time: '2026-01-18 11:00' }
            ]
        },
        { 
            trackingId: 'TBOS-240002', invoiceId: 'INV-2026-0002',
            client: 'Jane Smith', phone: '+2348030827418',
            hub: 'Printing', description: 'Business cards and flyers',
            amount: 150000, paid: 75000, balance: 75000, 
            status: 'PARTIAL', stage: 'In Progress', 
            deliveryDate: '2026-01-25', createdAt: '2026-01-16',
            timeline: [
                { stage: 'Job Created', staff: 'Admin', time: '2026-01-16 11:00' },
                { stage: 'Printing Started', staff: 'Mike', time: '2026-01-17 09:00' }
            ]
        },
        { 
            trackingId: 'TBOS-240003', invoiceId: 'INV-2026-0003',
            client: 'Tech Corp', phone: '+2348030827419',
            hub: 'Photography', description: 'Event photography coverage',
            amount: 500000, paid: 0, balance: 500000, 
            status: 'UNPAID', stage: 'Pending', 
            deliveryDate: '2026-01-18', createdAt: '2026-01-14',
            timeline: [
                { stage: 'Job Created', staff: 'Admin', time: '2026-01-14 15:00' }
            ]
        }
    ],
    staff: [
        { name: 'Admin User', role: 'Administrator', hub: 'IT', status: 'Active', score: 98 },
        { name: 'Grace Design', role: 'Staff', hub: 'Graphics Design', status: 'Active', score: 85 },
        { name: 'Mike Print', role: 'Staff', hub: 'Printing', status: 'Active', score: 70 },
        { name: 'Sarah Photo', role: 'HOD', hub: 'Photography', status: 'Active', score: 92 }
    ],
    inventory: [
        { name: 'Flex Banner Roll', stock: 8, alertLevel: 3, status: 'OK' },
        { name: 'Glossy Paper A4', stock: 2, alertLevel: 5, status: 'LOW' },
        { name: 'Camera Lens', stock: 0, alertLevel: 1, status: 'OUT' },
        { name: 'Ink Cartridges', stock: 15, alertLevel: 5, status: 'OK' }
    ],
    notifications: [
        { type: 'job', title: 'New Job Created', message: 'TBOS-240003 - Tech Corp', time: '5 min ago' },
        { type: 'payment', title: 'Payment Received', message: '₦75,000 for TBOS-240002', time: '1 hour ago' },
        { type: 'alert', title: 'Job Delayed', message: 'TBOS-240003 exceeded deadline', time: '2 hours ago' }
    ]
};

// AI Price Base Rates (₦)
const aiBaseRates = {
    'Graphics Design': 5000,
    'Printing': 10000,
    'Photography': 25000,
    'Tech Academy': 3000,
    'Online Shop': 2000
};

// Current User State
let currentUser = null;
let currentInvoice = null;