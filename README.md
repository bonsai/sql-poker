# SQL-Poker 🃏

**A complete Texas Hold'em poker engine written in pure SQL.**

No Python. No Ruby. No runtime. Just SQL.

**[▶ Play in your browser](https://bonsai.github.io/sql-poker/)** (GitHub Pages)

```bash
sqlite3 :memory: < sql-poker.sql
```

That's it. Shuffle, deal, evaluate, and declare a winner — all in one command.

![demo](demo.gif)

## Quick Start

### CLI
```bash
# In-memory game
sqlite3 :memory: < sql-poker.sql

# Save state for debugging
sqlite3 poker.db < sql-poker.sql
```
[Live Demo](https://bonsai.github.io/sql-poker/)

### Sample Output
```
=== HOLE CARDS ===
Player 0: Q♠  A♥
Player 1: 7♣  5♥
Player 2: 6♣  5♣
Player 3: K♥  9♥
=== COMMUNITY ===
4♣  7♥  10♦  A♣  10♥
  Player 0 → Two Pair
  Player 1 → Two Pair
  Player 2 → One Pair
  Player 3 → One Pair
🏆 WINNER:  Player 0 → Two Pair
```

## How It Works

| Step | SQL Technique |
|------|--------------|
| Shuffle | `ORDER BY RANDOM()` |
| Subset enumeration | 5-way self-join `C(7,5)=20` |
| Hand evaluation | Nested `CASE` + frequency CTEs |
| Winner | `ROW_NUMBER() OVER` + `ORDER BY` |

See [UX.md](UX.md) for design philosophy and [USAGE.md](USAGE.md) for detailed docs.

## Testing

100 consecutive games, zero crashes:
```bash
for i in $(seq 1 100); do sqlite3 :memory: < sql-poker.sql > /dev/null || echo "FAIL"; done
```

Verified hands: High Card, One Pair, Two Pair, Three of a Kind, Straight, Flush, Full House.

## License

MIT.
