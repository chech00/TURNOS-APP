const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.warn("⚠️ Supabase credentials missing (SUPABASE_URL or SUPABASE_KEY). Filesystem features may not work.");
}

// Fallback to avoid crash if envs are missing, but requests will fail
const supabase = createClient(supabaseUrl || 'https://example.supabase.co', supabaseKey || 'placeholder');

module.exports = { supabase };
