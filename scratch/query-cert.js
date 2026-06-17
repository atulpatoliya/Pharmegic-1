import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const certId = '6f433096-8846-4c7d-9a91-f6c0ac106c54';
  
  const { data: cert, error } = await supabase
    .from('certificates')
    .select(`
      *,
      chemicals (chemical_name, cas_number, ec_number, tonnage_band),
      clients (
        company_name,
        uuid_number,
        address,
        city,
        state,
        postal_code,
        country
      )
    `)
    .eq('id', certId)
    .single();
    
  if (error) {
    console.error('Error fetching cert:', error.message);
    return;
  }
  
  console.log('CERTIFICATE DATA:');
  console.log(JSON.stringify(cert, null, 2));
}

run();
