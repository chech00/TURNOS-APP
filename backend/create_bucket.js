require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function createBucket() {
    console.log("Attempting to create 'node-photos' bucket...");
    try {
        const { data, error } = await supabase.storage.createBucket('node-photos', {
            public: true,
            allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp'],
            fileSizeLimit: 5242880 // 5MB
        });

        if (error) {
            console.error("❌ Error creating bucket:", error);
            // Check if it already exists but might be private?
            if (error.message.includes('already exists')) {
                console.log("Bucket exists. Checking details...");
                const { data: bucket } = await supabase.storage.getBucket('node-photos');
                console.log("Bucket details:", bucket);
            }
        } else {
            console.log("✅ Bucket 'node-photos' created successfully!");
        }
    } catch (e) {
        console.error("Exception:", e);
    }
}

createBucket();
