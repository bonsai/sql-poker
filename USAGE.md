# USAGE.md — SQL-Poker Usage Guide

## Basic Usage

```bash
# Run a single game
sqlite3 :memory: < sql-poker.sql

# Save game state to file for inspection
sqlite3 poker.db < sql-poker.sql
```

## Running Multiple Games

```bash
# 10 games in a row
for i in $(seq 1 10); do
  echo "=== Game $i ==="
  sqlite3 :memory: < sql-poker.sql
  echo ""
done

# Stress test: 1000 games, count failures
failures=0
for i in $(seq 1 1000); do
  sqlite3 :memory: < sql-poker.sql > /dev/null 2>&1 || ((failures++))
done
echo "Failures: $failures / 1000"
```

## Inspecting Game State

Save to a file, then query:

```bash
sqlite3 poker.db < sql-poker.sql

# Look at the deck order
sqlite3 poker.db "SELECT d.pos, c.rank, c.suit FROM deck d JOIN cards c ON c.id=d.card_id ORDER BY d.pos;"

# See all hands with card details
sqlite3 poker.db "SELECT h.player, c.rank, c.suit, c.val FROM hand_cards h JOIN cards c ON c.id=h.card_id ORDER BY h.player, c.val DESC;"

# Community cards
sqlite3 poker.db "SELECT c.rank, c.suit FROM community_cards cc JOIN cards c ON c.id=cc.card_id;"
```

## Output Format

### Section 1: Hole Cards
One row per player, showing their 2 private cards.
```
Player 0: Q♠  A♥
Player 1: 7♣  5♥
```

### Section 2: Community Cards
Single row with all 5 community cards (flop + turn + river combined).
```
4♣  7♥  10♦  A♣  10♥
```

### Section 3: Results
Each player's best hand, sorted by strength.
```
  Player 0 → Two Pair
  Player 1 → One Pair
🏆 WINNER:  Player 0 → Two Pair
```

## Hand Ranks (strongest to weakest)

| Rank | Name | Example |
|------|------|---------|
| 9 | Straight Flush | 5♥ 6♥ 7♥ 8♥ 9♥ |
| 8 | Four of a Kind | 9♠ 9♥ 9♦ 9♣ K♠ |
| 7 | Full House | J♠ J♥ J♦ 4♣ 4♠ |
| 6 | Flush | 2♦ 5♦ 8♦ J♦ A♦ |
| 5 | Straight | 5♠ 6♥ 7♦ 8♣ 9♠ |
| 4 | Three of a Kind | Q♠ Q♥ Q♦ 7♣ 3♠ |
| 3 | Two Pair | 8♠ 8♥ 5♦ 5♣ K♠ |
| 2 | One Pair | A♠ A♥ 9♦ 6♣ 2♠ |
| 1 | High Card | A♠ K♥ 9♦ 6♣ 3♠ |

## Customization

### Change number of players

Edit the deal section. For 6 players:

```sql
-- 6 players × 2 cards = 12 cards for hands, 5 for community = 17 total
INSERT INTO hand_cards (player, card_id)
SELECT d.pos / 2, d.card_id FROM deck d WHERE d.pos < 12;

INSERT INTO community_cards (card_id)
SELECT d.card_id FROM deck d WHERE d.pos >= 12 AND d.pos < 17;
```

### Fixed seed (debugging)

Replace `ORDER BY RANDOM()` with a fixed deck order:

```sql
-- Aces first, then kings, etc.
INSERT INTO deck (pos, card_id)
SELECT ROW_NUMBER() OVER (ORDER BY val DESC, id) - 1, id FROM cards;
```

### Export game logs for ML

```bash
# Run 100 games, capture all output
for i in $(seq 1 100); do
  echo "GAME:$(printf '%04d' $i)"
  sqlite3 :memory: < sql-poker.sql
done > game_log.txt
```

## Platform Notes

- **Linux/macOS**: `sqlite3` is pre-installed or available via package manager
- **Windows**: install via `winget install SQLite.SQLite` or download from sqlite.org
- **Docker**: `docker run --rm -v $(pwd):/data nouchka/sqlite3 /data/sql-poker.sql`
