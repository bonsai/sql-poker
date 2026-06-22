-- ============================================================
-- SQL-Poker: Texas Hold'em in Pure SQLite
-- Usage:  sqlite3 :memory: < sql-poker.sql
--         sqlite3 poker.db < sql-poker.sql
-- ============================================================

-- ── 0. Cleanup ──────────────────────────────────────────────
DROP TABLE IF EXISTS hand_cards;
DROP TABLE IF EXISTS community_cards;
DROP TABLE IF EXISTS deck;
DROP TABLE IF EXISTS cards;

-- ── 1. Card Definition (52 cards) ──────────────────────────
CREATE TABLE cards (
  id    INTEGER PRIMARY KEY,
  suit  TEXT    NOT NULL,
  rank  TEXT    NOT NULL,
  val   INTEGER NOT NULL
);

INSERT INTO cards (id, suit, rank, val) VALUES
  ( 1,'♠','2',2),( 2,'♠','3',3),( 3,'♠','4',4),( 4,'♠','5',5),( 5,'♠','6',6),
  ( 6,'♠','7',7),( 7,'♠','8',8),( 8,'♠','9',9),( 9,'♠','10',10),(10,'♠','J',11),
  (11,'♠','Q',12),(12,'♠','K',13),(13,'♠','A',14),
  (14,'♥','2',2),(15,'♥','3',3),(16,'♥','4',4),(17,'♥','5',5),(18,'♥','6',6),
  (19,'♥','7',7),(20,'♥','8',8),(21,'♥','9',9),(22,'♥','10',10),(23,'♥','J',11),
  (24,'♥','Q',12),(25,'♥','K',13),(26,'♥','A',14),
  (27,'♦','2',2),(28,'♦','3',3),(29,'♦','4',4),(30,'♦','5',5),(31,'♦','6',6),
  (32,'♦','7',7),(33,'♦','8',8),(34,'♦','9',9),(35,'♦','10',10),(36,'♦','J',11),
  (37,'♦','Q',12),(38,'♦','K',13),(39,'♦','A',14),
  (40,'♣','2',2),(41,'♣','3',3),(42,'♣','4',4),(43,'♣','5',5),(44,'♣','6',6),
  (45,'♣','7',7),(46,'♣','8',8),(47,'♣','9',9),(48,'♣','10',10),(49,'♣','J',11),
  (50,'♣','Q',12),(51,'♣','K',13),(52,'♣','A',14);

-- ── 2. Shuffle ──────────────────────────────────────────────
CREATE TABLE deck (
  pos     INTEGER PRIMARY KEY,
  card_id INTEGER NOT NULL REFERENCES cards(id)
);

INSERT INTO deck (pos, card_id)
SELECT ROW_NUMBER() OVER (ORDER BY RANDOM()) - 1, id FROM cards;

-- ── 3. Deal ─────────────────────────────────────────────────
CREATE TABLE hand_cards (
  player  INTEGER NOT NULL,
  card_id INTEGER NOT NULL REFERENCES cards(id)
);

CREATE TABLE community_cards (
  card_id INTEGER NOT NULL REFERENCES cards(id)
);

INSERT INTO hand_cards (player, card_id)
SELECT d.pos / 2, d.card_id FROM deck d WHERE d.pos < 8;

INSERT INTO community_cards (card_id)
SELECT d.card_id FROM deck d WHERE d.pos >= 8 AND d.pos < 13;

-- ── 4. Show Table ───────────────────────────────────────────
SELECT '=== HOLE CARDS ===' AS section;
SELECT 'Player ' || h.player || ': ' ||
       GROUP_CONCAT(c.rank || c.suit, '  ') AS hand
FROM hand_cards h JOIN cards c ON c.id = h.card_id
GROUP BY h.player;

SELECT '=== COMMUNITY ===' AS section;
SELECT GROUP_CONCAT(c.rank || c.suit, '  ') AS community
FROM community_cards cc JOIN cards c ON c.id = cc.card_id;

-- ── 5. Evaluate + Results (single statement) ────────────────
WITH
comm AS (
  SELECT card_id, ROW_NUMBER() OVER () - 1 AS ci FROM community_cards
),
hole AS (
  SELECT player, card_id,
         ROW_NUMBER() OVER (PARTITION BY player ORDER BY card_id) - 1 AS hi
  FROM hand_cards
),
-- 7 cards per player: bits 0,1=hole  2..6=community
-- hole: 2 cards per player (bit 0,1)
-- community: same 5 cards for all players (bit 2..6)
p7(player, card_id, bit) AS (
  SELECT h.player, h.card_id, h.hi AS bit
  FROM hole h
  UNION ALL
  SELECT DISTINCT h.player, cn.card_id, cn.ci + 2 AS bit
  FROM hole h
  CROSS JOIN comm cn
),
p7c AS (
  SELECT p.player, p.card_id, p.bit, c.suit, c.val
  FROM p7 p JOIN cards c ON c.id = p.card_id
),
-- Enumerate C(7,5)=20 subsets via 5 nested joins
sub(player, c0,c1,c2,c3,c4, s0,s1,s2,s3,s4, v0,v1,v2,v3,v4) AS (
  SELECT a.player, a.card_id,b.card_id,c.card_id,d.card_id,e.card_id,
         a.suit,b.suit,c.suit,d.suit,e.suit,
         a.val,b.val,c.val,d.val,e.val
  FROM p7c a
  JOIN p7c b ON b.player=a.player AND b.bit>a.bit
  JOIN p7c c ON c.player=a.player AND c.bit>b.bit
  JOIN p7c d ON d.player=a.player AND c.bit<d.bit
  JOIN p7c e ON e.player=a.player AND d.bit<e.bit
),
-- For each subset, compute hand rank
eval AS (
  SELECT player, v0,v1,v2,v3,v4, s0,s1,s2,s3,s4,
    CASE WHEN s0=s1 AND s1=s2 AND s2=s3 AND s3=s4 THEN 1 ELSE 0 END AS fl,
    MAX(v0,MAX(v1,MAX(v2,MAX(v3,v4)))) AS mx,
    MIN(v0,MIN(v1,MIN(v2,MIN(v3,v4)))) AS mn,
    (SELECT COUNT(DISTINCT x) FROM (SELECT v0 x UNION SELECT v1 UNION SELECT v2 UNION SELECT v3 UNION SELECT v4)) AS uq,
    (SELECT MAX(c) FROM (SELECT COUNT(*) AS c FROM (SELECT v0 AS vi UNION ALL SELECT v1 UNION ALL SELECT v2 UNION ALL SELECT v3 UNION ALL SELECT v4) GROUP BY vi)) AS tf,
    -- top val: the vi with highest count, tiebreak by vi desc
    (SELECT vi FROM (SELECT vi, COUNT(*) AS c FROM (SELECT v0 vi UNION ALL SELECT v1 UNION ALL SELECT v2 UNION ALL SELECT v3 UNION ALL SELECT v4) GROUP BY vi ORDER BY COUNT(*) DESC, vi DESC LIMIT 1)) AS tv,
    -- second group: vi with second-highest count
    (SELECT vi FROM (
      SELECT vi, COUNT(*) AS c, ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC, vi DESC) AS rn
      FROM (SELECT v0 vi UNION ALL SELECT v1 UNION ALL SELECT v2 UNION ALL SELECT v3 UNION ALL SELECT v4)
      GROUP BY vi
    ) WHERE rn=2 LIMIT 1) AS sv,
    -- second freq
    (SELECT c FROM (
      SELECT vi, COUNT(*) AS c, ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC, vi DESC) AS rn
      FROM (SELECT v0 vi UNION ALL SELECT v1 UNION ALL SELECT v2 UNION ALL SELECT v3 UNION ALL SELECT v4)
      GROUP BY vi
    ) WHERE rn=2 LIMIT 1) AS sf
  FROM sub
),
ranked AS (
  SELECT player, tf, sf, tv, sv,
    CASE
      WHEN fl=1 AND ((mx-mn=4 AND uq=5) OR (mx=14 AND mn=2 AND uq=5
        AND (SELECT COUNT(*) FROM (SELECT v0 x UNION ALL SELECT v1 UNION ALL SELECT v2 UNION ALL SELECT v3 UNION ALL SELECT v4) WHERE x IN (14,2,3,4,5))=5))
        THEN 9
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
     WHERE x != COALESCE((SELECT vi FROM (SELECT vi FROM (SELECT v0 vi UNION ALL SELECT v1 UNION ALL SELECT v2 UNION ALL SELECT v3 UNION ALL SELECT v4) GROUP BY vi ORDER BY COUNT(*) DESC, vi DESC LIMIT 1)),-1)
    ),0) AS tb
  FROM eval
),
best AS (
  SELECT player, hr, tb,
         ROW_NUMBER() OVER (PARTITION BY player ORDER BY hr DESC, tb DESC) AS rn
  FROM ranked
),
pb AS (
  SELECT player, hr, tb FROM best WHERE rn=1
),
hn AS (
  SELECT player, hr, tb,
    CASE hr
      WHEN 9 THEN 'Straight Flush'
      WHEN 8 THEN 'Four of a Kind'
      WHEN 7 THEN 'Full House'
      WHEN 6 THEN 'Flush'
      WHEN 5 THEN 'Straight'
      WHEN 4 THEN 'Three of a Kind'
      WHEN 3 THEN 'Two Pair'
      WHEN 2 THEN 'One Pair'
      WHEN 1 THEN 'High Card'
    END AS hand_name
  FROM pb
)
SELECT line FROM (
  SELECT '  Player ' || player || ' → ' || hand_name AS line, 1 AS o, hr, tb FROM hn
  UNION ALL
  SELECT * FROM (
    SELECT '🏆 WINNER:  Player ' || player || ' → ' || hand_name, 2, hr, tb
    FROM hn ORDER BY hr DESC, tb DESC LIMIT 1
  )
)
ORDER BY o, hr DESC, tb DESC;
