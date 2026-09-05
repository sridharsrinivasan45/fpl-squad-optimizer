async function run() {
  try {
    const res = await fetch('https://fantasy.premierleague.com/api/element-summary/12/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
      }
    });
    if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
    const data = await res.json();
    console.log("History array keys:", Object.keys(data));
    console.log("First match history entry in 2026/27:");
    console.log(data.history[0]);
  } catch (err) {
    console.error("Fetch failed:", err.message);
  }
}
run();
