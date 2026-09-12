// TEMPORARY AUDIT SCRIPT — read-only.
// Performs ONLY the three element_code validation checks.
// Writes nothing to disk and does not modify existing files.

import fs from 'fs';
import path from 'path';

const BASE = './research/fpl-historical-data/data';
const BOOT_PATH = './temp-boot.json';
const HIST_SEASONS_PATH = './research/historical-seasons.json';
const SAMPLE_SIZE = 15;

function fail(msg: string): never {
  console.log(`MISSING/BLOCKED: ${msg}`);
  process.exit(1);
}

type Row = Record<string, string>;

function parseCsv(file: string): Row[] {
  const lines = fs
    .readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean);

  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim());

  return lines.slice(1).map(line => {
    const cells = line.split(',');
    const row: Row = {};

    headers.forEach((h, i) => {
      row[h] = cells[i] !== undefined ? cells[i].trim() : '';
    });

    return row;
  });
}

// ---------- PRECONDITIONS ----------

if (!fs.existsSync(BASE)) {
  fail(`${BASE} not found — cannot run the audit.`);
}

const seasons = fs
  .readdirSync(BASE)
  .filter(s => /^\d{4}-\d{2}$/.test(s))
  .sort();

if (seasons.length === 0) {
  fail(`No season folders found under ${BASE}`);
}

if (!fs.existsSync(BOOT_PATH)) {
  console.log(
    `MISSING: ${BOOT_PATH} not found — CHECK 1 cannot run. Checks 2 and 3 will still run.`
  );
}

// ---------- IDENTIFY CODE SOURCE ----------

function seasonCodeSource(
  season: string
): {
  kind: 'gws' | 'players_raw' | 'none';
  column: string;
} {
  const gw1 = path.join(BASE, season, 'gws', 'gw1.csv');

  if (fs.existsSync(gw1)) {
    const rows = parseCsv(gw1);

    if (rows.length > 0) {
      if ('element_code' in rows[0]) {
        return { kind: 'gws', column: 'element_code' };
      }

      if ('code' in rows[0]) {
        return { kind: 'gws', column: 'code' };
      }
    }
  }

  const raw = path.join(BASE, season, 'players_raw.csv');

  if (fs.existsSync(raw)) {
    const rows = parseCsv(raw);

    if (rows.length > 0) {
      if ('code' in rows[0]) {
        return { kind: 'players_raw', column: 'code' };
      }

      if ('element_code' in rows[0]) {
        return { kind: 'players_raw', column: 'element_code' };
      }
    }
  }

  return { kind: 'none', column: '' };
}

// ---------- CHECK 3: COVERAGE ----------

console.log('========================================');
console.log('CHECK 3: element_code COVERAGE');
console.log('========================================');

let totalRows = 0;
let totalWithCode = 0;

const codeMap = new Map<
  string,
  {
    seasons: Set<string>;
    names: Set<string>;
  }
>();

for (const season of seasons) {
  const src = seasonCodeSource(season);

  let seasonTotal = 0;
  let seasonWithCode = 0;

  if (src.kind === 'gws') {
    const gwDir = path.join(BASE, season, 'gws');

    const gwFiles = fs
      .readdirSync(gwDir)
      .filter(f => /^gw\d+\.csv$/.test(f));

    for (const gwFile of gwFiles) {
      const rows = parseCsv(path.join(gwDir, gwFile));

      for (const row of rows) {
        seasonTotal++;

        const code = row[src.column];

        if (code) {
          seasonWithCode++;

          if (!codeMap.has(code)) {
            codeMap.set(code, {
              seasons: new Set(),
              names: new Set()
            });
          }

          const entry = codeMap.get(code)!;

          entry.seasons.add(season);

          if (row['name']) {
            entry.names.add(row['name']);
          }
        }
      }
    }
  } else if (src.kind === 'players_raw') {
    const rawPath = path.join(BASE, season, 'players_raw.csv');
    const rows = parseCsv(rawPath);

    seasonTotal = rows.length;

    for (const row of rows) {
      const code = row[src.column];

      if (code) {
        seasonWithCode++;

        if (!codeMap.has(code)) {
          codeMap.set(code, {
            seasons: new Set(),
            names: new Set()
          });
        }

        const entry = codeMap.get(code)!;

        entry.seasons.add(season);

        const name =
          row['first_name'] && row['second_name']
            ? `${row['first_name']} ${row['second_name']}`
            : row['name'] || row['web_name'] || '';

        if (name) {
          entry.names.add(name);
        }
      }
    }
  }

  totalRows += seasonTotal;
  totalWithCode += seasonWithCode;

  const pct =
    seasonTotal > 0
      ? ((seasonWithCode / seasonTotal) * 100).toFixed(1)
      : 'N/A';

  console.log(
    `${season} [${src.kind}${src.kind !== 'none' ? ':' + src.column : ''}]: ` +
      `${seasonWithCode}/${seasonTotal} (${pct}%)`
  );
}

const overallPct =
  totalRows > 0
    ? ((totalWithCode / totalRows) * 100).toFixed(1)
    : 'N/A';

console.log(`OVERALL: ${totalWithCode}/${totalRows} (${overallPct}%)`);
console.log(
  `Distinct element_code values: ${codeMap.size}`
);

// ---------- CHECK 2: UNIQUENESS ----------

console.log('\n========================================');
console.log('CHECK 2: element_code UNIQUENESS');
console.log('========================================');

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z]/g, '');
}

const multiName = [...codeMap.entries()].filter(
  ([, entry]) => entry.names.size > 1
);

const suspicious: string[] = [];

for (const [code, entry] of multiName) {
  const names = [...entry.names];
  const normalized = names.map(normalizeName);

  let related = true;

  for (let i = 0; i < normalized.length; i++) {
    for (let j = i + 1; j < normalized.length; j++) {
      if (
        !normalized[i].includes(normalized[j]) &&
        !normalized[j].includes(normalized[i])
      ) {
        related = false;
      }
    }
  }

  if (!related && suspicious.length < 10) {
    suspicious.push(
      `element_code=${code}: ` +
        `names=[${names.join(' | ')}] ` +
        `seasons=[${[...entry.seasons].sort().join(',')}]`
    );
  }
}

console.log(
  `Codes with >1 distinct name string: ${multiName.length}`
);

console.log(
  `Suspicious identity collisions: ${suspicious.length}`
);

if (suspicious.length > 0) {
  suspicious.forEach(s => console.log(` - ${s}`));
} else {
  console.log('No suspicious multi-identity element_code values found.');
}

// ---------- CHECK 1: CURRENT FPL VS HISTORICAL ----------

console.log('\n========================================');
console.log('CHECK 1: CURRENT FPL CODE VS HISTORICAL');
console.log('========================================');

console.log(
  'Sampling method: deterministic — ascending FPL element.id, first 15 eligible players.'
);

if (!fs.existsSync(BOOT_PATH)) {
  console.log('SKIPPED — temp-boot.json not found.');
} else {
  const boot = JSON.parse(
    fs.readFileSync(BOOT_PATH, 'utf8')
  );

  if (
    !boot.elements ||
    boot.elements.length === 0 ||
    boot.elements[0]?.code === undefined
  ) {
    console.log(
      'SKIPPED — temp-boot.json does not contain elements[].code.'
    );
  } else {
    let sampleIds: number[];

    if (fs.existsSync(HIST_SEASONS_PATH)) {
      const hist = JSON.parse(
        fs.readFileSync(HIST_SEASONS_PATH, 'utf8')
      );

      sampleIds = Object.values(hist as any)
        .filter(
          (p: any) =>
            p.history_past &&
            p.history_past.length > 0
        )
        .map((p: any) => p.id);
    } else {
      console.log(
        'NOTE: historical-seasons.json not found — sampling directly from temp-boot.json.'
      );

      sampleIds = boot.elements.map(
        (e: any) => e.id
      );
    }

    const sampled = [...new Set(sampleIds)]
      .sort((a, b) => a - b)
      .slice(0, SAMPLE_SIZE);

    let matched = 0;
    let notFound = 0;

    const results: string[] = [];

    for (const id of sampled) {
      const player = boot.elements.find(
        (e: any) => e.id === id
      );

      if (!player) continue;

      const code = String(player.code);
      const archiveEntry = codeMap.get(code);

      if (!archiveEntry) {
        notFound++;

        results.push(
          `${player.web_name} ` +
            `(id=${id}, code=${code}): NOT FOUND`
        );
      } else {
        matched++;

        results.push(
          `${player.web_name} ` +
            `(id=${id}, code=${code}): MATCH — ` +
            `archive seasons=[${[
              ...archiveEntry.seasons
            ]
              .sort()
              .join(',')}]`
        );
      }
    }

    console.log(
      `Sampled: ${sampled.length} | ` +
        `Matched: ${matched} | ` +
        `Not found: ${notFound}`
    );

    console.log('Examples:');

    results.forEach(result =>
      console.log(` - ${result}`)
    );
  }
}

console.log('\n========================================');
console.log('AUDIT COMPLETE — READ ONLY');
console.log('Nothing was modified or written to disk.');
console.log('========================================');