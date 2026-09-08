// Explicit local-only preview: live market reads + one native Codex call, no mail.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { collectMarketSnapshot } from './daily-markets.mjs';
import { generateEdition, render } from './daily-html.mjs';
import { createDailyWindow } from './daily-window.mjs';

const window = createDailyWindow({ now: new Date() });
const directory = resolve('data/operator', `markets-preview-${Date.now()}`);
mkdirSync(directory, { recursive: true });
const save = (name, value) => writeFileSync(join(directory, name), typeof value === 'string' ? value : JSON.stringify(value, null, 2), { flag: 'wx', mode: 0o600 });
try {
  const markets = await collectMarketSnapshot();
  const acquisition = { ...window, items: [], markets };
  save('acquisition.json', acquisition);
  const finance = await generateEdition('finance', acquisition, window.date, directory);
  const report = { ...window, editions: [finance], sourceWarnings: markets.warnings };
  const preview = render(report);
  save('finance.html', preview.html); save('finance.md', preview.text);
  console.log(JSON.stringify({ phase: 'market-preview-not-sent', directory, available: markets.rows.filter(row => row.status === 'ok').length,
    total: markets.rows.length, insights: finance.marketSnapshot.rows.filter(row => row.insight).length, warnings: markets.warnings }));
} catch {
  console.error(JSON.stringify({ phase: 'market-preview-failed-not-sent', directory, note: 'Inspect saved acquisition; no automatic retry.' }));
  process.exitCode = 1;
}
