async function run() {
  try {
    const res = await fetch('https://fantasy.premierleague.com/api/bootstrap-static/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
      }
    });
    const data = await res.json();
    
    // Find Saka
    const saka = data.elements.find(el => el.web_name === 'Saka' || el.id === 12 || el.web_name.includes('Saka'));
    if (!saka) {
      console.log("Saka not found. Printing first element keys instead:");
      console.log(Object.keys(data.elements[0]));
      console.log("First element:", data.elements[0]);
    } else {
      console.log("Keys and values for Saka:");
      for (const [key, value] of Object.entries(saka)) {
        if (value !== null && value !== 0 && value !== '' && value !== '0.0') {
          console.log(`- ${key}: ${JSON.stringify(value)}`);
        }
      }
    }
  } catch (err) {
    console.error("Fetch failed:", err.message);
  }
}
run();
