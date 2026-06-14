const { Client } = require('pg');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const pwd = 'At@9726530209_1';
const projectRef = 'uxaymhgstyirgzkroaqp';
const user = `postgres.${projectRef}`;

const regions = [
  'ap-south-1',
  'ap-southeast-1',
  'ap-northeast-1',
  'eu-central-1',
  'eu-west-1',
  'eu-west-2',
  'us-east-1',
  'us-east-2',
  'us-west-1',
  'us-west-2',
  'sa-east-1',
  'ca-central-1'
];

async function test() {
  for (const region of regions) {
    const host = `aws-0-${region}.pooler.supabase.com`;
    const connectionString = `postgresql://${user}:${encodeURIComponent(pwd)}@${host}:6543/postgres`;
    console.log(`Trying region ${region} (${host})...`);
    
    const client = new Client({
      connectionString,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 5000 // Fast timeout
    });

    try {
      await client.connect();
      console.log(`\nSUCCESS! Connected successfully in region: ${region}`);
      
      console.log('Running migration...');
      await client.query('ALTER TABLE public.certificates ADD COLUMN IF NOT EXISTS tonnage_band TEXT;');
      console.log('Migration ran successfully!');
      
      await client.end();
      return;
    } catch (err) {
      console.log(`Failed for ${region}: ${err.message}`);
    }
  }
  console.log('\nAll regions finished.');
}

test();
