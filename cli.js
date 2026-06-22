#!/usr/bin/env node
// sql-poker: Texas Hold'em in pure SQL — watch SQL flow
// Usage: sql-poker [--players 2|4] [--speed 500]

import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'fs';
import { join } from 'path';
import { createInterface } from 'readline';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

const args = process.argv.slice(2);
const players = parseInt(args[args.indexOf('--players') + 1]) || 2;
const speed = parseInt(args[args.indexOf('--speed') + 1]) || 800;

const sqlPath = join(__dirname, 'sql-poker.sql');
const fullSQL = readFileSync(sqlPath, 'utf8');

const handLimit = players * 2;
const commStart = handLimit;
const commEnd = handLimit + 5;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function exec(db, sql) { db.exec(sql); }

function query(db, sql) {
  return db.prepare(sql).all().map(row => ({ ...row }));
}

function logSQL(label, sql) {
  const trimmed = sql.trim().replace(/\s+/g, ' ');
  console.log(`\n${label}`);
  console.log(`  SQL: ${trimmed.length > 100 ? trimmed.substring(0, 100) + '...' : trimmed}`);
}

function logRows(rows, maxRows = 10) {
  const show = rows.slice(0, maxRows);
  for (const r of show) {
    const vals = Object.entries(r).map(([k, v]) => `${k}=${v}`).join(', ');
    console.log(`    → ${vals}`);
  }
  if (rows.length > maxRows) console.log(`    ... +${rows.length - maxRows} more rows`);
}

async function runGame(gameNum) {
  const db = new DatabaseSync(':memory:');

  console.log(`\n${'═'.repeat(50)}`);
  console.log(`  SQL-Poker — Game ${gameNum} (${players}P)`);
  console.log(`${'═'.repeat(50)}`);

  // ── Step 1: 配る (Deal hole cards) ──
  console.log(`\n┌── 1. 配る (Deal) ──`);

  const cardsCreateSQL = fullSQL.match(/CREATE TABLE cards[\s\S]*?;/)[0];
  const cardsInsertSQL = fullSQL.match(/INSERT INTO cards[\s\S]*?;/)[0];
  logSQL('  CREATE cards', cardsCreateSQL);
  exec(db, cardsCreateSQL);
  await sleep(speed);

  logSQL('  INSERT 52 cards', cardsInsertSQL);
  exec(db, cardsInsertSQL);
  const cardCount = db.prepare('SELECT COUNT(*) as n FROM cards').get();
  console.log(`    → ${cardCount.n} cards created`);
  await sleep(speed);

  // ── Step 2: 切る (Shuffle / Cut) ──
  console.log(`\n┌── 2. 切る (Shuffle) ──`);

  const deckCreateSQL = fullSQL.match(/CREATE TABLE deck[\s\S]*?;/)[0];
  const deckInsertSQL = fullSQL.match(/INSERT INTO deck[\s\S]*?;/)[0];
  logSQL('  CREATE deck', deckCreateSQL);
  exec(db, deckCreateSQL);
  await sleep(speed);

  logSQL('  SHUFFLE: ORDER BY RANDOM()', deckInsertSQL);
  exec(db, deckInsertSQL);

  const deckPreview = query(db, `
    SELECT d.pos, c.rank, c.suit FROM deck d JOIN cards c ON c.id=d.card_id ORDER BY d.pos LIMIT 8
  `);
  console.log('    → Deck (first 8):');
  for (const r of deckPreview) console.log(`       pos=${r.pos}: ${r.rank}${r.suit}`);
  await sleep(speed);

  // ── Step 3: もらう (Deal community / Draw) ──
  console.log(`\n┌── 3. もらう (Draw community cards) ──`);

  db.exec(fullSQL.match(/CREATE TABLE hand_cards[\s\S]*?;/)[0]);
  db.exec(fullSQL.match(/CREATE TABLE community_cards[\s\S]*?;/)[0]);

  const handDealSQL = `INSERT INTO hand_cards (player, card_id) SELECT d.pos / 2, d.card_id FROM deck d WHERE d.pos < ${handLimit}`;
  logSQL(`  DEAL ${players * 2} cards to ${players} players`, handDealSQL);
  exec(db, handDealSQL);
  await sleep(speed);

  const commDealSQL = `INSERT INTO community_cards (card_id) SELECT d.card_id FROM deck d WHERE d.pos >= ${commStart} AND d.pos < ${commEnd}`;
  logSQL('  DEAL 5 community cards', commDealSQL);
  exec(db, commDealSQL);
  await sleep(speed);

  // Show dealt cards
  const holeRows = query(db, `
    SELECT h.player, c.rank, c.suit, c.val
    FROM hand_cards h JOIN cards c ON c.id = h.card_id
    ORDER BY h.player, c.val DESC
  `);
  const grouped = {};
  for (const r of holeRows) {
    if (!grouped[r.player]) grouped[r.player] = [];
    grouped[r.player].push(r.rank + r.suit);
  }

  const commCards = query(db, `
    SELECT c.rank, c.suit FROM community_cards cc JOIN cards c ON c.id = cc.card_id
  `).map(c => c.rank + c.suit);

  console.log('    → Hole cards:');
  for (const [p, cards] of Object.entries(grouped)) {
    console.log(`       P${p}: ${cards.join('  ')}`);
  }
  console.log(`    → Board: ${commCards.join('  ')}`);
  await sleep(speed);

  // ── Step 4: 役判定 (Evaluate) ──
  console.log(`\n┌── 4. 役判定 (Evaluate) ──`);

  const evalCTE = `WITH
comm AS (SELECT card_id, ROW_NUMBER() OVER () - 1 AS ci FROM community_cards),
hole AS (SELECT player, card_id, ROW_NUMBER() OVER (PARTITION BY player ORDER BY card_id) - 1 AS hi FROM hand_cards),
p7(player, card_id, bit) AS (
  SELECT h.player, h.card_id, h.hi FROM hole h
  UNION ALL
  SELECT DISTINCT h.player, cn.card_id, cn.ci + 2 FROM hole h CROSS JOIN comm cn
),
p7c AS (SELECT p.player, p.card_id, p.bit, c.suit, c.val FROM p7 p JOIN cards c ON c.id = p.card_id),
sub(player, c0,c1,c2,c3,c4, s0,s1,s2,s3,s4, v0,v1,v2,v3,v4) AS (
  SELECT a.player, a.card_id,b.card_id,c.card_id,d.card_id,e.card_id,
         a.suit,b.suit,c.suit,d.suit,e.suit, a.val,b.val,c.val,d.val,e.val
  FROM p7c a
  JOIN p7c b ON b.player=a.player AND b.bit>a.bit
  JOIN p7c c ON c.player=a.player AND c.bit>b.bit
  JOIN p7c d ON d.player=a.player AND c.bit<d.bit
  JOIN p7c e ON e.player=a.player AND d.bit<e.bit
),
eval AS (
  SELECT player, v0,v1,v2,v3,v4, s0,s1,s2,s3,s4,
    CASE WHEN s0=s1 AND s1=s2 AND s2=s3 AND s3=s4 THEN 1 ELSE 0 END AS fl,
    MAX(v0,MAX(v1,MAX(v2,MAX(v3,v4)))) AS mx,
    MIN(v0,MIN(v1,MIN(v2,MIN(v3,v4)))) AS mn,
    (SELECT COUNT(DISTINCT x) FROM (SELECT v0 x UNION SELECT v1 UNION SELECT v2 UNION SELECT v3 UNION SELECT v4)) AS uq,
    (SELECT MAX(c) FROM (SELECT COUNT(*) AS c FROM (SELECT v0 AS vi UNION ALL SELECT v1 UNION ALL SELECT v2 UNION ALL SELECT v3 UNION ALL SELECT v4) GROUP BY vi)) AS tf,
    (SELECT vi FROM (SELECT vi, COUNT(*) AS c FROM (SELECT v0 vi UNION ALL SELECT v1 UNION ALL SELECT v2 UNION ALL SELECT v3 UNION ALL SELECT v4) GROUP BY vi ORDER BY COUNT(*) DESC, vi DESC LIMIT 1)) AS tv,
    (SELECT vi FROM (SELECT vi, COUNT(*) AS c, ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC, vi DESC) AS rn FROM (SELECT v0 vi UNION ALL SELECT v1 UNION ALL SELECT v2 UNION ALL SELECT v3 UNION ALL SELECT v4) GROUP BY vi) WHERE rn=2 LIMIT 1) AS sv,
    (SELECT c FROM (SELECT vi, COUNT(*) AS c, ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC, vi DESC) AS rn FROM (SELECT v0 vi UNION ALL SELECT v1 UNION ALL SELECT v2 UNION ALL SELECT v3 UNION ALL SELECT v4) GROUP BY vi) WHERE rn=2 LIMIT 1) AS sf
  FROM sub
),
ranked AS (
  SELECT player, tf, sf, tv, sv,
    CASE
      WHEN fl=1 AND ((mx-mn=4 AND uq=5) OR (mx=14 AND mn=2 AND uq=5
        AND (SELECT COUNT(*) FROM (SELECT v0 x UNION ALL SELECT v1 UNION ALL SELECT v2 UNION ALL SELECT v3 UNION ALL SELECT v4) WHERE x IN (14,2,3,4,5))=5)) THEN 9
      WHEN tf=4 THEN 8
      WHEN tf=3 AND sf=2 THEN 7
      WHEN fl=1 THEN 6
      WHEN uq=5 AND mx-mn=4 THEN 5
      WHEN uq=5 AND mx=14 AND (SELECT COUNT(*) FROM (SELECT v0 x UNION ALL SELECT v1 UNION ALL SELECT v2 UNION ALL SELECT v3 UNION ALL SELECT v4) WHERE x IN (14,2,3,4,5))=5 THEN 5
      WHEN tf=3 THEN 4
      WHEN tf=2 AND sf=2 THEN 3
      WHEN tf=2 THEN 2
      ELSE 1
    END AS hr,
    COALESCE(tv,0)*10000 + COALESCE(sv,0)*100 +
    COALESCE((SELECT MAX(x) FROM (SELECT v0 x UNION ALL SELECT v1 UNION ALL SELECT v2 UNION ALL SELECT v3 UNION ALL SELECT v4)
     WHERE x != COALESCE((SELECT vi FROM (SELECT vi FROM (SELECT v0 vi UNION ALL SELECT v1 UNION ALL SELECT v2 UNION ALL SELECT v3 UNION ALL SELECT v4) GROUP BY vi ORDER BY COUNT(*) DESC, vi DESC LIMIT 1)),-1)),0) AS tb
  FROM eval
),
best AS (SELECT player, hr, tb, ROW_NUMBER() OVER (PARTITION BY player ORDER BY hr DESC, tb DESC) AS rn FROM ranked),
pb AS (SELECT player, hr, tb FROM best WHERE rn=1),
hn AS (SELECT player, hr, tb, CASE hr
  WHEN 9 THEN 'Straight Flush' WHEN 8 THEN 'Four of a Kind' WHEN 7 THEN 'Full House'
  WHEN 6 THEN 'Flush' WHEN 5 THEN 'Straight' WHEN 4 THEN 'Three of a Kind'
  WHEN 3 THEN 'Two Pair' WHEN 2 THEN 'One Pair' WHEN 1 THEN 'High Card'
END AS hand_name FROM pb)`;

  logSQL('  EVAL: C(7,5)=20 subsets per player', evalCTE);
  await sleep(speed);

  const results = query(db, `
    ${evalCTE}
    SELECT line FROM (
      SELECT '  P' || player || ' → ' || hand_name AS line, 1 AS o, hr, tb FROM hn
      UNION ALL
      SELECT * FROM (SELECT '🏆 P' || player || ' → ' || hand_name, 2, hr, tb FROM hn ORDER BY hr DESC, tb DESC LIMIT 1)
    ) ORDER BY o, hr DESC, tb DESC
  `);

  console.log('    → Results:');
  for (const r of results) console.log(`       ${r.line}`);

  console.log(`\n${'─'.repeat(50)}`);
}

// Interactive loop
let gameNum = 1;
const rl = createInterface({ input: process.stdin, output: process.stdout });

console.log(`SQL-Poker (${players}P) — Enter to deal, 'q' to quit`);

function prompt() {
  rl.question('> ', async (input) => {
    if (input.trim().toLowerCase() === 'q') {
      console.log('Bye!');
      rl.close();
      return;
    }
    await runGame(gameNum++);
    prompt();
  });
}

rl.on('close', () => process.exit(0));

await runGame(gameNum++);
prompt();
