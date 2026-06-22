# UX.md — SQL-Poker Design Philosophy

## Why SQL?

The question isn't "can SQL do this?" — it's "what does it look like when SQL does this?"

SQL is a declarative language for set operations. Poker is a game of sets:
sets of cards, sets of combinations, sets of rules. The mapping is natural.

This project is a **proof of concept**: game logic doesn't need a runtime.
It needs a query engine.

## Design Principles

### 1. Single File, Zero Dependencies

One `.sql` file. No build step. No package manager. No runtime.
If you have `sqlite3`, you have poker.

### 2. Readable Over Clever

Every CTE has a name that describes its purpose:
- `comm` — community cards numbered
- `hole` — hole cards numbered per player
- `p7` — 7 cards per player (bit positions)
- `sub` — all 5-card subsets of 7
- `eval` — scored subsets
- `ranked` — hand rank + tiebreaker
- `best` — best hand per player

The SQL reads top-to-bottom like a pipeline.

### 3. Correctness Over Speed

The evaluation enumerates all C(7,5)=20 five-card subsets per player.
This is O(n) per game — fast enough. A production engine would use
lookup tables or bit tricks. Here, clarity wins.

### 4. The Database IS the Program

No application layer. The tables are the game state.
The queries are the game logic. The output is the game result.

You can pause mid-game by saving the `.db` file and querying state later.

## Architecture

```
cards (52 rows)
  ↓ ORDER BY RANDOM()
deck (52 rows, shuffled)
  ↓ deal
hand_cards (8 rows) + community_cards (5 rows)
  ↓ CTE pipeline
results (4 rows + 1 winner)
```

The entire game is a **data pipeline**: source → transform → output.

## What Makes This Interesting

### The Shuffle

```sql
INSERT INTO deck (pos, card_id)
SELECT ROW_NUMBER() OVER (ORDER BY RANDOM()) - 1, id FROM cards;
```

One line. True random shuffle. No Fisher-Yates needed.

### The Subset Enumeration

```sql
FROM p7c a
JOIN p7c b ON b.player=a.player AND b.bit>a.bit
JOIN p7c c ON c.player=a.player AND c.bit>b.bit
JOIN p7c d ON d.player=a.player AND c.bit<d.bit
JOIN p7c e ON e.player=a.player AND d.bit<e.bit
```

Five nested self-joins with strict inequality. This is `C(7,5) = 20`
combinations, generated declaratively. No loops. No recursion.

### The Hand Evaluator

A single `CASE` expression with 9 branches, each checking:
- Flush: all 5 suits equal
- Straight: max - min = 4, all unique
- Wheel: A-2-3-4-5 special case
- Frequency analysis: count occurrences of each rank

All inline. No helper functions. No stored procedures.

## Roadmap

### v1.1 — Split Pot Detection
Detect ties and split the pot. Currently the first player wins ties.

### v1.2 — Betting Rounds
Add `bets` table, `actions` table. Pre-flop → flop → turn → river.
Fold logic: if all but one fold, that player wins.

### v1.3 — N-Player Support
Parameterize player count. Currently hardcoded to 4.

### v1.4 — Game Log Export
`INSERT INTO game_log` on each run. Feed to ML pipeline.

### v2.0 — ML Opponent
Train a model on game logs. Predict fold/call/raise from hand strength.
Use `RANDOM() < model_output` as the decision function — still in SQL.

## The ML Vision

```
SQL-Poker (game engine)
  → game_log table (hand, action, result)
    → Python/ML (train model)
      → model weights
        → SQL: RANDOM() < sigmoid(weights · features)
          → AI player that lives in SQL
```

The dream: an AI that plays poker using nothing but SQL queries.
The temperature parameter controls "handicapping" — how often the AI
makes suboptimal plays. A hot temperature = loose play. Cold = tight.

## Lessons Learned

1. **SQLite CTEs are powerful but picky** — column aliases in subqueries
   can't be referenced in ORDER BY. Use expressions instead.

2. **UNION ALL + LIMIT scoping** — `LIMIT` applies to the entire UNION,
   not just the last SELECT. Wrap in a subquery to limit individually.

3. **CROSS JOIN for combinations** — the 5-way self-join is elegant but
   generates many rows. For larger card games, consider recursive CTEs.

4. **Bit positions as join keys** — numbering cards 0..6 and joining on
   `a.bit < b.bit < c.bit` is a clean way to enumerate combinations.

## Related Work

- **yakuql** — Mahjong hand evaluation in SQL (by same author)
- **SQL-Game** — various game logic experiments in SQL
- **"SQL is not a programming language"** — a lie we disprove for fun
