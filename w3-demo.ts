import 'dotenv/config';
import { runSql } from './lib/agents/sql';
import { detectSchedulingIntent } from './lib/scheduling';

const [cmd, ...rest] = process.argv.slice(2);
const q = rest.join(' ');
(async () => {
  if (cmd === 'sql') console.log(await runSql(q));
  else if (cmd === 'intent') console.log(JSON.stringify(await detectSchedulingIntent(q), null, 2));
  process.exit(0);
})();
