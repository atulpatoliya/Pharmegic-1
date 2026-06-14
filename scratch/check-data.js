const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE are required in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);
const clientId = '5bf01f34-2668-4b72-ac3d-aa253bb7331b';

async function check() {
  try {
    console.log(`\nQuerying client_chemicals for client ${clientId}...`);
    const { data: clientChems, error: ccError } = await supabase
      .from('client_chemicals')
      .select('*, chemicals(*)')
      .eq('client_id', clientId);

    if (ccError) throw ccError;
    console.log('\n--- Client Chemicals list ---');
    console.log(JSON.stringify(clientChems.map(c => ({
      id: c.id,
      chemical_id: c.chemical_id,
      chemical_name: c.chemicals?.chemical_name,
      cas_number: c.chemicals?.cas_number,
      status: c.status
    })), null, 2));

    console.log('\nQuerying certificates for this client...');
    const { data: certs, error: certError } = await supabase
      .from('certificates')
      .select('id, certificate_number, chemical_id, status, type, chemicals(chemical_name, cas_number)')
      .eq('client_id', clientId);

    if (certError) throw certError;
    console.log('\n--- Certificates ---');
    console.log(JSON.stringify(certs, null, 2));

  } catch (err) {
    console.error('Error querying database:', err.message);
  }
}

check();
