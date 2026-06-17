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
      if (js.includes('tableLayout') || js.includes('col1.setAttribute("width", "180")') || js.includes('col1.setAttribute(\'width\', \'180\')')) {
        console.log(`FOUND NEW PATCH IN: ${url}`);
        found = true;
      }
    }
    
    if (!found) {
      console.log('NEW PATCH NOT DEPLOYED YET ON THE LIVE SERVER!');
    }
  } catch (err) {
    console.error(err);
  }
}

check();
