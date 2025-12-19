require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function testBucket() {
    console.log("Testing access to 'node-photos' bucket...");
    try {
        const { data, error } = await supabase.storage.getBucket('node-photos');
        if (error) {
            console.error("❌ Bucket Check Error:", error.message);

            console.log("Attempting to list buckets...");
            const { data: buckets, error: listError } = await supabase.storage.listBuckets();
            if (listError) console.error("List Error:", listError);
            else console.log("Available buckets:", buckets.map(b => b.name));

        } else {
            console.log("✅ Bucket 'node-photos' exists and is accessible.");
        }
    } catch (e) {
        console.error("Exception:", e);
    }
}

testBucket();
