async function check() {
  try {
    const timestamp = Date.now();
    const res = await fetch(`https://portal.pharmegichealthcare.com/login?_=${timestamp}`, {
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });
    const html = await res.text();
    
    // Find NextJS static script URLs
    const matches = html.matchAll(/src="(\/_next\/static\/chunks\/[^"]+\.js)"/g);
    const urls = Array.from(matches).map(m => m[1]);
    
    console.log('Found JS bundles (fresh):', urls);
    
    let found = false;
    for (const url of urls) {
      const fullUrl = `https://portal.pharmegichealthcare.com${url}?_=${timestamp}`;
      const jsRes = await fetch(fullUrl, {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      const js = await jsRes.text();
      if (js.includes('Gotenberg PDF converter is starting up')) {
        console.log(`FOUND RETRY LOGIC IN: ${url}`);
        found = true;
      }
    }
    
    if (!found) {
      console.log('RETRY LOGIC NOT DEPLOYED YET ON THE LIVE SERVER!');
    }
  } catch (err) {
    console.error(err);
  }
}

check();
