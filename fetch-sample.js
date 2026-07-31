async function run() {
  const url = 'https://fantasy.premierleague.com/api/bootstrap-static/';
  console.log(`Fetching from: ${url}`);
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('Total players found:', data.elements.length);
    console.log('First 3 players:');
    
    // Print first 3 players
    for (let i = 0; i < 3; i++) {
      const player = data.elements[i];
      if (player) {
        console.log(`\nPlayer #${i + 1}: ${player.web_name} (ID: ${player.id})`);
        console.log(JSON.stringify(player, null, 2));
      }
    }
  } catch (err) {
    console.error('Fetch failed:', err.message);
  }
}

run();
