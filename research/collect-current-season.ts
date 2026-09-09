import fs from 'fs';

const boot = JSON.parse(fs.readFileSync('temp-boot.json', 'utf8'));

async function fetchPlayerHistory(id: number) {
  const res = await fetch(
    `https://fantasy.premierleague.com/api/element-summary/${id}/`,
    {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'application/json',
      },
    }
  );

  if (!res.ok) {
    throw new Error(`Player ${id}: HTTP ${res.status}`);
  }

  return res.json();
}

async function run() {
  const output: Record<number, any> = {};

  console.log(`Collecting histories for ${boot.elements.length} players...`);

  for (let i = 0; i < boot.elements.length; i++) {
    const player = boot.elements[i];

    try {
      const data = await fetchPlayerHistory(player.id);

      output[player.id] = {
        id: player.id,
        name: player.web_name,
        team: player.team,
        history: data.history,
      };

      if ((i + 1) % 25 === 0) {
        console.log(`Collected ${i + 1}/${boot.elements.length}`);
      }
    } catch (err: any) {
      console.error(`Failed ${player.web_name}: ${err.message}`);
    }
  }

  fs.writeFileSync(
    'research/current-season-history.json',
    JSON.stringify(output, null, 2)
  );

  console.log('Done.');
  console.log('Saved: research/current-season-history.json');
}

run();
