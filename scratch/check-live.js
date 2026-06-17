async function check() {
  try {
    const res = await fetch('https://portal.pharmegichealthcare.com/login');
    const html = await res.text();
    
    // Find NextJS static script URLs
    const matches = html.matchAll(/src="(\/_next\/static\/chunks\/[^"]+\.js)"/g);
    const urls = Array.from(matches).map(m => m[1]);
    
    console.log('Found JS bundles:', urls);
    
    let found = false;
    for (const url of urls) {
      const fullUrl = `https://portal.pharmegichealthcare.com${url}`;
      const jsRes = await fetch(fullUrl);
      const js = await jsRes.text();
      if (js.includes('tableLayout') || js.includes('tableLayout = \'auto\'') || js.includes('col1.setAttribute(\'width\', \'180\')')) {
        console.log(`FOUND NEW PATCH IN: ${fullUrl}`);
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
