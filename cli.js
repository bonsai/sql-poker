#!/usr/bin/env node
// sql-poker: Texas Hold'em in pure SQL
// Usage: sql-poker [--players 2|4] [--games N]

const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const players = parseInt(args[args.indexOf('--players') + 1]) || 2;
const games = parseInt(args[args.indexOf('--games') + 1]) || 1;

const db = new DatabaseSync(':memory:');
const sqlPath = path.join(__dirname, 'sql-poker.sql');
let sql = fs.readFileSync(sqlPath, 'utf8');

// Patch player count in deal statements
const handLimit = players * 2;
const commStart = handLimit;
const commEnd = handLimit + 5;
sql = sql.replace(
  /SELECT d\.pos \/ 2, d\.card_id FROM deck d WHERE d\.pos < \d+/,
  `SELECT d.pos / 2, d.card_id FROM deck d WHERE d.pos < ${handLimit}`
);
sql = sql.replace(
  /SELECT d\.card_id FROM deck d WHERE d\.pos >= \d+ AND d\.pos < \d+/,
  `SELECT d.card_id FROM deck d WHERE d.pos >= ${commStart} AND d.pos < ${commEnd}`
);

// Evaluation CTE used for results
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

// Run games
for (let g = 1; g <= games; g++) {
  db.exec(sql);

  if (games > 1) console.log(`\n── Game ${g} ──`);

  // Hole cards — concise
  const holeRows = db.prepare(`
    SELECT h.player, c.rank, c.suit
    FROM hand_cards h JOIN cards c ON c.id = h.card_id
    ORDER BY h.player, c.val DESC
  `).all();

  const grouped = {};
  for (const r of holeRows) {
    if (!grouped[r.player]) grouped[r.player] = [];
    grouped[r.player].push(r.rank + r.suit);
  }

  console.log('\nHOLE:');
  for (const [p, cards] of Object.entries(grouped)) {
    console.log(`  P${p}: ${cards.join(' ')}`);
  }

  // Community — concise
  const commCards = db.prepare(`
    SELECT c.rank, c.suit FROM community_cards cc JOIN cards c ON c.id = cc.card_id
  `).all().map(c => c.rank + c.suit);
  console.log(`BOARD: ${commCards.join(' ')}`);

  // Results
  const results = db.prepare(`
    ${evalCTE}
    SELECT line FROM (
      SELECT '  P' || player || ' → ' || hand_name AS line, 1 AS o, hr, tb FROM hn
      UNION ALL
      SELECT * FROM (SELECT '🏆 P' || player || ' → ' || hand_name, 2, hr, tb FROM hn ORDER BY hr DESC, tb DESC LIMIT 1)
    ) ORDER BY o, hr DESC, tb DESC
  `).all();

  console.log('\nRESULT:');
  for (const r of results) console.log(r.line);
}
