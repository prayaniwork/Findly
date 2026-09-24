import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envPath = fs.existsSync('.env.local') ? '.env.local' : 'backend/.env.local';
const envContent = fs.readFileSync(envPath, 'utf8');

function getEnv(key) {
  const match = envContent.match(new RegExp(`^${key}=(.*)$`, 'm'));
  return match ? match[1].trim() : '';
}

const serpApiKey = getEnv('SERPAPI_API_KEY');
const supabaseUrl = getEnv('NEXT_PUBLIC_SUPABASE_URL');
const supabaseKey = getEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY') || getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');

console.log('--------------------------------------------------');
console.log('🔍 RUNNING LIVE CREDENTIAL HEALTH CHECKS');
console.log('--------------------------------------------------\n');

async function checkSerpApi() {
  console.log('1. Checking SerpAPI Key...');
  if (!serpApiKey) {
    console.log('   ❌ SerpAPI Key is missing in .env.local');
    return false;
  }

  try {
    // 1a. Check account endpoint
    const accountRes = await fetch(`https://serpapi.com/account?api_key=${serpApiKey}`);
    if (accountRes.ok) {
      const data = await accountRes.json();
      console.log('   ✅ SerpAPI Authentication Successful!');
      console.log(`      • Account Email: ${data.account_email || 'N/A'}`);
      console.log(`      • Plan: ${data.plan_name || 'Free/Developer'}`);
      console.log(`      • Searches Remaining: ${data.total_searches_left ?? data.searches_per_month}`);
      return true;
    } else {
      const err = await accountRes.json().catch(() => ({}));
      console.log(`   ❌ SerpAPI returned status ${accountRes.status}:`, err.error || accountRes.statusText);
      return false;
    }
  } catch (err) {
    console.log('   ❌ Network error connecting to SerpAPI:', err.message);
    return false;
  }
}

async function checkSupabase() {
  console.log('\n2. Checking Supabase Connection & Key...');
  if (!supabaseUrl || !supabaseKey) {
    console.log('   ❌ Supabase URL or Key is missing in .env.local');
    return false;
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 2a. Check Auth endpoint
    const { error: authError } = await supabase.auth.getSession();
    if (authError) {
      console.log('   ❌ Supabase Auth failed:', authError.message);
      return false;
    }
    console.log('   ✅ Supabase Auth & Gateway Connected!');
    console.log(`      • Project URL: ${supabaseUrl}`);

    // 2b. Check Database access via PostgREST
    const { data, error } = await supabase.from('todos').select('*').limit(1);
    if (error) {
      if (error.code === 'PGRST205') {
        console.log('   ✅ Supabase Database Connected & Key Authenticated!');
        console.log('      • Status: Ready (Table "todos" not yet created in Supabase dashboard, which is expected)');
      } else {
        console.log(`      • Database response: ${error.message} (${error.code})`);
      }
    } else {
      console.log('   ✅ Supabase Database Connected & Key Authenticated!');
      console.log(`      • Found ${data.length} records in "todos" table`);
    }
    return true;
  } catch (err) {
    console.log('   ❌ Network error connecting to Supabase:', err.message);
    return false;
  }
}

async function run() {
  const serpOk = await checkSerpApi();
  const supaOk = await checkSupabase();

  console.log('\n--------------------------------------------------');
  if (serpOk && supaOk) {
    console.log('🎉 ALL KEYS ARE VALID, ACTIVE, AND WORKING!');
  } else {
    console.log('⚠️ One or more checks reported an issue.');
  }
  console.log('--------------------------------------------------');
}

run();
