#!/usr/bin/env node
// 7日でわかるSQL — 高校生向け教材
// ポーカーゲームを作りながらSQLを学ぶ

import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'fs';
import { join } from 'path';
import { createInterface } from 'readline';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

// ── Typewriting effect ──
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function typewrite(text, delay = 30) {
  for (const ch of text) {
    process.stdout.write(ch);
    await sleep(delay);
  }
}

async function typewriteLine(text, delay = 30) {
  await typewrite(text, delay);
  console.log();
}

// ── Screen helpers ──
function clear() { console.clear(); }

function header(title) {
  const w = 50;
  console.log('═'.repeat(w));
  console.log(`  ${title}`);
  console.log('═'.repeat(w));
}

function box(text) {
  const lines = text.split('\n');
  const w = Math.max(...lines.map(l => l.length)) + 4;
  console.log('┌' + '─'.repeat(w) + '┐');
  for (const l of lines) console.log(`│  ${l.padEnd(w - 2)}│`);
  console.log('└' + '─'.repeat(w) + '┘');
}

function pause() {
  return new Promise(resolve => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question('  ⏎ Enter で次へ...', () => { rl.close(); resolve(); });
  });
}

function promptChoice(choices) {
  return new Promise(resolve => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question('  > ', (input) => {
      rl.close();
      resolve(input.trim());
    });
  });
}

// ── SQL execution with animation ──
function exec(db, sql) { db.exec(sql); }

function query(db, sql) { return db.prepare(sql).all(); }

async function showSQL(label, sql, delay = 20) {
  console.log(`\n  📝 ${label}`);
  console.log(`  SQL: `);
  await typewrite(`    ${sql}`, delay);
  console.log();
}

async function showResult(rows, label = '結果') {
  if (rows.length === 0) {
    console.log(`  → (データなし)`);
    return;
  }
  console.log(`\n  📊 ${label} (${rows.length}行):`);
  const cols = Object.keys(rows[0]);
  console.log(`    ${cols.join(' | ')}`);
  console.log(`    ${cols.map(() => '─'.repeat(10)).join('─┼─')}`);
  for (const r of rows.slice(0, 15)) {
    console.log(`    ${cols.map(c => String(r[c]).padEnd(10)).join(' | ')}`);
  }
  if (rows.length > 15) console.log(`    ... +${rows.length - 15}行`);
}

// ── Story characters ──
const characters = {
  sensei: '👨‍🏫 先生',
  taro: '👦 タロウ',
  hanako: '👧 ハナコ',
  db: '🗄️  DB',
};

function say(who, msg) {
  console.log(`\n  ${characters[who]}: ${msg}`);
}

// ── Day lessons ──

async function day1() {
  clear();
  header('Day 1: SELECT — データを見る');

  await typewriteLine('\n  🎮 ポーカーゲームを作ろう！', 40);
  await typewriteLine('  まずはカードのデータを見てみよう。\n', 30);

  await pause();

  const db = new DatabaseSync(':memory:');

  // Create cards
  await showSQL('カードテーブルを作る', 'CREATE TABLE cards (id INTEGER, suit TEXT, rank TEXT, val INTEGER)');
  exec(db, `CREATE TABLE cards (id INTEGER, suit TEXT, rank TEXT, val INTEGER)`);
  await sleep(500);

  await showSQL('カードを52枚追加する', 'INSERT INTO cards VALUES (1, "♠", "A", 14), (2, "♠", "K", 13), ...');
  exec(db, `INSERT INTO cards VALUES
    (1,'♠','A',14),(2,'♠','K',13),(3,'♠','Q',12),(4,'♠','J',11),(5,'♠','10',10),
    (6,'♠','9',9),(7,'♠','8',8),(8,'♠','7',7),(9,'♠','6',6),(10,'♠','5',5),
    (11,'♠','4',4),(12,'♠','3',3),(13,'♠','2',2),
    (14,'♥','A',14),(15,'♥','K',13),(16,'♥','Q',12),(17,'♥','J',11),(18,'♥','10',10),
    (19,'♥','9',9),(20,'♥','8',8),(21,'♥','7',7),(22,'♥','6',6),(23,'♥','5',5),
    (24,'♥','4',4),(25,'♥','3',3),(26,'♥','2',2),
    (27,'♦','A',14),(28,'♦','K',13),(29,'♦','Q',12),(30,'♦','J',11),(31,'♦','10',10),
    (32,'♦','9',9),(33,'♦','8',8),(34,'♦','7',7),(35,'♦','6',6),(36,'♦','5',5),
    (37,'♦','4',4),(38,'♦','3',3),(39,'♦','2',2),
    (40,'♣','A',14),(41,'♣','K',13),(42,'♣','Q',12),(43,'♣','J',11),(44,'♣','10',10),
    (45,'♣','9',9),(46,'♣','8',8),(47,'♣','7',7),(48,'♣','6',6),(49,'♣','5',5),
    (50,'♣','4',4),(51,'♣','3',3),(52,'♣','2',2)`);
  await sleep(500);

  // SELECT *
  await typewriteLine('\n  💡 SELECT は「データを見る」コマンド', 30);
  await typewriteLine('  SELECT * FROM テーブル名 で全データを取得\n', 30);

  await showSQL('全カードを見る', 'SELECT * FROM cards');
  const all = query(db, 'SELECT * FROM cards');
  await showResult(all, '全カード');
  await sleep(500);

  // SELECT specific columns
  await typewriteLine('\n  💡 特定の列だけ見ることもできる', 30);
  await typewriteLine('  SELECT 列名1, 列名2 FROM テーブル名\n', 30);

  await showSQL('スートとランクだけ見る', 'SELECT suit, rank FROM cards LIMIT 10');
  const partial = query(db, 'SELECT suit, rank FROM cards LIMIT 10');
  await showResult(partial, 'スートとランク');
  await sleep(500);

  // SELECT with alias
  await typewriteLine('\n  💡 AS で列名を変えられる（エイリアス）', 30);
  await showSQL('列名を日本語に', 'SELECT rank AS ランク, suit AS マーク FROM cards LIMIT 5');
  const alias = query(db, 'SELECT rank AS ランク, suit AS マーク FROM cards LIMIT 5');
  await showResult(alias, '日本語表示');
  await sleep(500);

  // SELECT with ORDER BY
  await typewriteLine('\n  💡 ORDER BY で並び替え', 30);
  await typewriteLine('  ORDER BY 列名 ASC（昇順）/ DESC（降順）\n', 30);

  await showSQL('強い順に並び替え', 'SELECT rank, val FROM cards GROUP BY rank ORDER BY val DESC');
  const ordered = query(db, 'SELECT rank, val FROM cards GROUP BY rank ORDER BY val DESC');
  await showResult(ordered, '強い順');

  await pause();

  // Quiz
  clear();
  header('Day 1: クイズ');

  await typewriteLine('\n  ❓ 次のSQLの実行結果は？\n', 30);
  box('SELECT rank, suit\nFROM cards\nWHERE suit = "♥"\nLIMIT 3');

  console.log('\n  1) ♥のカード3枚（A♥, K♥, Q♥）');
  console.log('  2) ♥のカード13枚');
  console.log('  3) 全カード52枚');
  console.log('  4) エラー');

  let ans = await promptChoice();
  if (ans === '1') {
    console.log('\n  ✅ 正解！WHERE で ♥ だけ絞り、LIMIT 3 で3枚だけ表示');
  } else {
    console.log('\n  ❌ 不正解。答えは1)。WHERE で条件絞り、LIMIT で件数制限');
  }

  await pause();
  console.log('\n  📚 Day 1 完了！次は WHERE をもっと詳しく学ぼう。\n');
}

async function day2() {
  clear();
  header('Day 2: WHERE — データを絞る');

  await typewriteLine('\n  🎮 ポーカーで「強いカードだけ選びたい」', 40);
  await typewriteLine('  WHERE で条件を指定しよう！\n', 30);

  await pause();

  const db = new DatabaseSync(':memory:');
  exec(db, `CREATE TABLE cards (id INTEGER, suit TEXT, rank TEXT, val INTEGER)`);
  exec(db, `INSERT INTO cards VALUES
    (1,'♠','A',14),(2,'♠','K',13),(3,'♠','Q',12),(4,'♠','J',11),(5,'♠','10',10),
    (6,'♥','A',14),(7,'♥','K',13),(8,'♥','Q',12),(9,'♥','J',11),(10,'♥','10',10),
    (11,'♦','A',14),(12,'♦','K',13),(13,'♦','Q',12),(14,'♦','J',11),(15,'♦','10',10),
    (16,'♣','A',14),(17,'♣','K',13),(18,'♣','Q',12),(19,'♣','J',11),(20,'♣','10',10)`);

  // WHERE basic
  await typewriteLine('  💡 WHERE は「条件で絞る」コマンド', 30);
  await typewriteLine('  SELECT * FROM テーブル WHERE 条件\n', 30);

  await showSQL('A（エース）だけ見る', 'SELECT * FROM cards WHERE rank = "A"');
  const aces = query(db, 'SELECT * FROM cards WHERE rank = "A"');
  await showResult(aces, 'エース');
  await sleep(500);

  // WHERE with AND
  await typewriteLine('\n  💡 AND で条件を組み合わせる', 30);
  await showSQL('♠のAだけ見る', 'SELECT * FROM cards WHERE rank = "A" AND suit = "♠"');
  const spadeA = query(db, 'SELECT * FROM cards WHERE rank = "A" AND suit = "♠"');
  await showResult(spadeA, '♠のエース');
  await sleep(500);

  // WHERE with OR
  await typewriteLine('\n  💡 OR は「どちらか」', 30);
  await showSQL('AまたはK', 'SELECT * FROM cards WHERE rank = "A" OR rank = "K"');
  const ak = query(db, 'SELECT * FROM cards WHERE rank = "A" OR rank = "K"');
  await showResult(ak, 'AまたはK');
  await sleep(500);

  // WHERE with comparison
  await typewriteLine('\n  💡 比較演算子: >, <, >=, <=, !=', 30);
  await showSQL('val >= 13（K以上）', 'SELECT * FROM cards WHERE val >= 13');
  const strong = query(db, 'SELECT * FROM cards WHERE val >= 13');
  await showResult(strong, 'K以上のカード');
  await sleep(500);

  // WHERE with IN
  await typewriteLine('\n  💡 IN で複数値を指定', 30);
  await showSQL('A, K, Qだけ', 'SELECT * FROM cards WHERE rank IN ("A", "K", "Q")');
  const top3 = query(db, 'SELECT * FROM cards WHERE rank IN ("A", "K", "Q")');
  await showResult(top3, 'A, K, Q');
  await sleep(500);

  // WHERE with LIKE
  await typewriteLine('\n  💡 LIKE で部分一致（% はワイルドカード）', 30);
  await showSQL('10を含む', 'SELECT * FROM cards WHERE rank LIKE "%10%"');
  const ten = query(db, 'SELECT * FROM cards WHERE rank LIKE "%10%"');
  await showResult(ten, '10を含む');

  await pause();

  // Quiz
  clear();
  header('Day 2: クイズ');

  await typewriteLine('\n  ❓ 次のSQLで何行返る？\n', 30);
  box('SELECT *\nFROM cards\nWHERE val >= 11\n  AND suit = "♥"');

  console.log('\n  1) 2行（A♥, K♥）');
  console.log('  2) 3行（A♥, K♥, Q♥）');
  console.log('  3) 4行（A♥, K♥, Q♥, J♥）');
  console.log('  4) 5行');

  let ans = await promptChoice();
  if (ans === '3') {
    console.log('\n  ✅ 正解！val>=11 は A(14), K(13), Q(12), J(11) の4枚');
  } else {
    console.log('\n  ❌ 不正解。答えは3)。val>=11 は A, K, Q, J の4枚');
  }

  await pause();
  console.log('\n  📚 Day 2 完了！次は INSERT でデータを追加しよう。\n');
}

async function day3() {
  clear();
  header('Day 3: INSERT — データを追加');

  await typewriteLine('\n  🎮 ゲームにプレイヤーを追加しよう！', 40);
  await typewriteLine('  INSERT でデータを追加する。\n', 30);

  await pause();

  const db = new DatabaseSync(':memory:');

  await showSQL('プレイヤーテーブルを作る', 'CREATE TABLE players (id INTEGER, name TEXT, chips INTEGER)');
  exec(db, 'CREATE TABLE players (id INTEGER, name TEXT, chips INTEGER)');
  await sleep(500);

  await typewriteLine('\n  💡 INSERT INTO でデータを追加', 30);
  await typewriteLine('  INSERT INTO テーブル (列名) VALUES (値)\n', 30);

  await showSQL('プレイヤーを追加', 'INSERT INTO players VALUES (1, "タロウ", 1000)');
  exec(db, 'INSERT INTO players VALUES (1, "タロウ", 1000)');
  await sleep(300);

  await showSQL('もう1人追加', 'INSERT INTO players VALUES (2, "ハナコ", 1000)');
  exec(db, 'INSERT INTO players VALUES (2, "ハナコ", 1000)');
  await sleep(300);

  await showSQL('確認', 'SELECT * FROM players');
  const players = query(db, 'SELECT * FROM players');
  await showResult(players, 'プレイヤー一覧');
  await sleep(500);

  // INSERT multiple
  await typewriteLine('\n  💡 一度に複数行追加もできる', 30);
  await showSQL('3人まとめて追加', 'INSERT INTO players VALUES (3, "ジロウ", 1000), (4, "サブロウ", 1000)');
  exec(db, 'INSERT INTO players VALUES (3, "ジロウ", 1000), (4, "サブロウ", 1000)');
  await sleep(300);

  await showSQL('確認', 'SELECT * FROM players');
  const allPlayers = query(db, 'SELECT * FROM players');
  await showResult(allPlayers, '全プレイヤー');
  await sleep(500);

  // INSERT with SELECT
  await typewriteLine('\n  💡 SELECT の結果を INSERT できる', 30);
  await showSQL('コピーして追加', 'INSERT INTO players SELECT id + 10, name || "_コピー", chips FROM players WHERE id <= 2');
  exec(db, 'INSERT INTO players SELECT id + 10, name || "_コピー", chips FROM players WHERE id <= 2');
  await sleep(300);

  await showSQL('確認', 'SELECT * FROM players');
  const copied = query(db, 'SELECT * FROM players');
  await showResult(copied, 'コピー後');

  await pause();

  // Quiz
  clear();
  header('Day 3: クイズ');

  await typewriteLine('\n  ❓ 次のSQLの結果は？\n', 30);
  box('CREATE TABLE t (id INTEGER, name TEXT);\nINSERT INTO t VALUES (1, "A");\nINSERT INTO t VALUES (2, "B");\nINSERT INTO t SELECT id + 10, name FROM t;\nSELECT * FROM t;');

  console.log('\n  1) 2行（A, B）');
  console.log('  2) 4行（A, B, A1, B1）');
  console.log('  3) 4行（A, B, 11A, 12B）');
  console.log('  4) エラー');

  let ans = await promptChoice();
  if (ans === '3') {
    console.log('\n  ✅ 正解！SELECT で既存行をコピーして id+10 で追加');
  } else {
    console.log('\n  ❌ 不正解。答えは3)。id+10 で 11, 12 になる');
  }

  await pause();
  console.log('\n  📚 Day 3 完了！次は UPDATE と DELETE を学ぼう。\n');
}

async function day4() {
  clear();
  header('Day 4: UPDATE / DELETE — データを変更・削除');

  await typewriteLine('\n  🎮 チップの増減を管理しよう！', 40);

  await pause();

  const db = new DatabaseSync(':memory:');
  exec(db, 'CREATE TABLE players (id INTEGER, name TEXT, chips INTEGER)');
  exec(db, 'INSERT INTO players VALUES (1, "タロウ", 1000), (2, "ハナコ", 1000)');

  await typewriteLine('\n  💡 UPDATE でデータを変更', 30);
  await typewriteLine('  UPDATE テーブル SET 列名 = 値 WHERE 条件\n', 30);

  await showSQL('タロウが勝って+500', 'UPDATE players SET chips = chips + 500 WHERE name = "タロウ"');
  exec(db, 'UPDATE players SET chips = chips + 500 WHERE name = "タロウ"');
  await sleep(300);

  await showSQL('確認', 'SELECT * FROM players');
  let rows = query(db, 'SELECT * FROM players');
  await showResult(rows, '更新後');
  await sleep(500);

  await typewriteLine('\n  ⚠️  WHERE を忘れると全行更新される！', 30);
  await typewriteLine('  UPDATE players SET chips = 0  ← 全員のチップが0に！\n', 30);

  await showSQL('全員のチップを0に（危険！）', 'UPDATE players SET chips = 0');
  exec(db, 'UPDATE players SET chips = 0');
  await sleep(300);

  await showSQL('確認', 'SELECT * FROM players');
  rows = query(db, 'SELECT * FROM players');
  await showResult(rows, '全リセット後');
  await sleep(500);

  // DELETE
  await typewriteLine('\n  💡 DELETE でデータを削除', 30);
  await typewriteLine('  DELETE FROM テーブル WHERE 条件\n', 30);

  await showSQL('タロウを削除', 'DELETE FROM players WHERE name = "タロウ"');
  exec(db, 'DELETE FROM players WHERE name = "タロウ"');
  await sleep(300);

  await showSQL('確認', 'SELECT * FROM players');
  rows = query(db, 'SELECT * FROM players');
  await showResult(rows, '削除後');
  await sleep(500);

  await typewriteLine('\n  ⚠️  DELETE FROM players  ← WHERE なしは全削除！', 30);

  await pause();

  // Quiz
  clear();
  header('Day 4: クイズ');

  await typewriteLine('\n  ❓ 危険なSQLはどれ？\n', 30);

  console.log('\n  1) UPDATE players SET chips = 1000 WHERE id = 1');
  console.log('  2) DELETE FROM players WHERE id = 1');
  console.log('  3) UPDATE players SET chips = 0');
  console.log('  4) SELECT * FROM players WHERE id = 1');

  let ans = await promptChoice();
  if (ans === '3') {
    console.log('\n  ✅ 正解！WHERE がない UPDATE は全員のチップを0にする');
  } else {
    console.log('\n  ❌ 不正解。答えは3)。WHERE がないと全行更新される');
  }

  await pause();
  console.log('\n  📚 Day 4 完了！次は JOIN でテーブルを結合しよう。\n');
}

async function day5() {
  clear();
  header('Day 5: JOIN — テーブルを結合');

  await typewriteLine('\n  🎮 カードとプレイヤーを組み合わせよう！', 40);

  await pause();

  const db = new DatabaseSync(':memory:');
  exec(db, 'CREATE TABLE players (id INTEGER, name TEXT)');
  exec(db, 'CREATE TABLE hands (player_id INTEGER, card_id INTEGER)');
  exec(db, 'INSERT INTO players VALUES (1, "タロウ"), (2, "ハナコ")');
  exec(db, 'INSERT INTO hands VALUES (1, 1), (1, 14), (2, 2), (2, 15)');

  await typewriteLine('\n  💡 2つのテーブルに同じデータがある', 30);
  await showSQL('プレイヤー', 'SELECT * FROM players');
  let rows = query(db, 'SELECT * FROM players');
  await showResult(rows, 'プレイヤー');
  await sleep(300);

  await showSQL('手札', 'SELECT * FROM hands');
  rows = query(db, 'SELECT * FROM hands');
  await showResult(rows, '手札');
  await sleep(500);

  await typewriteLine('\n  💡 JOIN でテーブルを結合する', 30);
  await typewriteLine('  SELECT * FROM テーブル1 JOIN テーブル2 ON 条件\n', 30);

  await showSQL('プレイヤー名と手札を結合', 'SELECT p.name, h.card_id FROM players p JOIN hands h ON p.id = h.player_id');
  const joined = query(db, 'SELECT p.name, h.card_id FROM players p JOIN hands h ON p.id = h.player_id');
  await showResult(joined, '結合結果');
  await sleep(500);

  // LEFT JOIN
  await typewriteLine('\n  💡 LEFT JOIN は左のテーブルを全件保持', 30);
  await showSQL('手札がないプレイヤーも表示', 'SELECT p.name, h.card_id FROM players p LEFT JOIN hands h ON p.id = h.player_id');
  exec(db, 'INSERT INTO players VALUES (3, "ジロウ")');
  const leftJoin = query(db, 'SELECT p.name, h.card_id FROM players p LEFT JOIN hands h ON p.id = h.player_id');
  await showResult(leftJoin, 'LEFT JOIN結果');
  await sleep(500);

  // Multiple JOIN
  await typewriteLine('\n  💡 3つ以上のテーブルも結合できる', 30);
  exec(db, 'CREATE TABLE cards (id INTEGER, suit TEXT, rank TEXT)');
  exec(db, 'INSERT INTO cards VALUES (1, "♠", "A"), (2, "♠", "K"), (14, "♥", "A"), (15, "♥", "K")');

  await showSQL('3テーブル結合', 'SELECT p.name, c.suit, c.rank FROM players p JOIN hands h ON p.id = h.player_id JOIN cards c ON h.card_id = c.id');
  const multiJoin = query(db, 'SELECT p.name, c.suit, c.rank FROM players p JOIN hands h ON p.id = h.player_id JOIN cards c ON h.card_id = c.id');
  await showResult(multiJoin, '3テーブル結合');

  await pause();

  // Quiz
  clear();
  header('Day 5: クイズ');

  await typewriteLine('\n  ❓ JOIN と LEFT JOIN の違いは？\n', 30);

  console.log('\n  1) JOIN は全件、LEFT JOIN は一致する件だけ');
  console.log('  2) JOIN は一致する件だけ、LEFT JOIN は左を全件保持');
  console.log('  3) 違いはない');
  console.log('  4) LEFT JOIN は右を全件保持');

  let ans = await promptChoice();
  if (ans === '2') {
    console.log('\n  ✅ 正解！JOIN=INNER JOIN=一致のみ、LEFT JOIN=左全件保持');
  } else {
    console.log('\n  ❌ 不正解。答えは2)。LEFT JOIN は左テーブルを全件保持');
  }

  await pause();
  console.log('\n  📚 Day 5 完了！次は GROUP BY で集約しよう。\n');
}

async function day6() {
  clear();
  header('Day 6: GROUP BY — データを集約');

  await typewriteLine('\n  🎮 各プレイヤーの勝ち数を集計しよう！', 40);

  await pause();

  const db = new DatabaseSync(':memory:');
  exec(db, 'CREATE TABLE games (id INTEGER, player_name TEXT, result TEXT, pot INTEGER)');
  exec(db, `INSERT INTO games VALUES
    (1, 'タロウ', 'win', 100), (2, 'ハナコ', 'lose', 0),
    (3, 'タロウ', 'win', 200), (4, 'ハナコ', 'win', 150),
    (5, 'ジロウ', 'lose', 0), (6, 'タロウ', 'lose', 0),
    (7, 'ハナコ', 'win', 300), (8, 'ジロウ', 'win', 100)`);

  await typewriteLine('\n  💡 GROUP BY でグループ化して集計', 30);
  await typewriteLine('  COUNT, SUM, AVG, MAX, MIN などの集約関数と一緒に使う\n', 30);

  await showSQL('各プレイヤーのゲーム数', 'SELECT player_name, COUNT(*) FROM games GROUP BY player_name');
  let rows = query(db, 'SELECT player_name, COUNT(*) as games FROM games GROUP BY player_name');
  await showResult(rows, 'ゲーム数');
  await sleep(500);

  await showSQL('各プレイヤーの勝ち数', 'SELECT player_name, COUNT(*) FROM games WHERE result = "win" GROUP BY player_name');
  rows = query(db, 'SELECT player_name, COUNT(*) as wins FROM games WHERE result = "win" GROUP BY player_name');
  await showResult(rows, '勝ち数');
  await sleep(500);

  await showSQL('各プレイヤーの合計獲得チップ', 'SELECT player_name, SUM(pot) FROM games GROUP BY player_name');
  rows = query(db, 'SELECT player_name, SUM(pot) as total_pot FROM games GROUP BY player_name');
  await showResult(rows, '合計獲得チップ');
  await sleep(500);

  await showSQL('平均獲得チップ', 'SELECT player_name, AVG(pot) FROM games GROUP BY player_name');
  rows = query(db, 'SELECT player_name, AVG(pot) as avg_pot FROM games GROUP BY player_name');
  await showResult(rows, '平均獲得チップ');
  await sleep(500);

  // HAVING
  await typewriteLine('\n  💡 HAVING で集計後の条件絞り', 30);
  await showSQL('勝ち数2以上のプレイヤー', 'SELECT player_name, COUNT(*) as wins FROM games WHERE result = "win" GROUP BY player_name HAVING wins >= 2');
  rows = query(db, 'SELECT player_name, COUNT(*) as wins FROM games WHERE result = "win" GROUP BY player_name HAVING wins >= 2');
  await showResult(rows, '勝ち数2以上');

  await pause();

  // Quiz
  clear();
  header('Day 6: クイズ');

  await typewriteLine('\n  ❓ WHERE と HAVING の違いは？\n', 30);

  console.log('\n  1) WHERE は集計前、HAVING は集計後の条件');
  console.log('  2) WHERE は集計後、HAVING は集計前の条件');
  console.log('  3) 違いはない');
  console.log('  4) WHERE はINSERT用、HAVING はSELECT用');

  let ans = await promptChoice();
  if (ans === '1') {
    console.log('\n  ✅ 正解！WHERE=行単位の絞り、HAVING=集計後の絞り');
  } else {
    console.log('\n  ❌ 不正解。答えは1)。WHERE=集計前、HAVING=集計後');
  }

  await pause();
  console.log('\n  📚 Day 6 完了！いよいよ最終日、ポーカーゲームを作る！\n');
}

async function day7() {
  clear();
  header('Day 7: 総合 — ポーカーゲームを作る！');

  await typewriteLine('\n  🎮 これまで学んだSQLを全部使ってポーカーゲーム！', 40);
  await typewriteLine('  CREATE, INSERT, SELECT, WHERE, JOIN, GROUP BY 全部出てくる！\n', 30);

  await pause();

  const db = new DatabaseSync(':memory:');

  // Step 1: CREATE
  console.log('\n  ── Step 1: テーブルを作る (CREATE) ──');
  await showSQL('cards テーブル', 'CREATE TABLE cards (id INTEGER, suit TEXT, rank TEXT, val INTEGER)');
  exec(db, 'CREATE TABLE cards (id INTEGER, suit TEXT, rank TEXT, val INTEGER)');
  await sleep(300);

  await showSQL('players テーブル', 'CREATE TABLE players (id INTEGER, name TEXT, chips INTEGER)');
  exec(db, 'CREATE TABLE players (id INTEGER, name TEXT, chips INTEGER)');
  await sleep(300);

  await showSQL('hands テーブル', 'CREATE TABLE hands (player_id INTEGER, card_id INTEGER)');
  exec(db, 'CREATE TABLE hands (player_id INTEGER, card_id INTEGER)');
  await sleep(300);

  // Step 2: INSERT
  console.log('\n  ── Step 2: データを追加 (INSERT) ──');
  await showSQL('52枚のカード', 'INSERT INTO cards VALUES (1,"♠","A",14), (2,"♠","K",13), ...');
  exec(db, `INSERT INTO cards VALUES
    (1,'♠','A',14),(2,'♠','K',13),(3,'♠','Q',12),(4,'♠','J',11),(5,'♠','10',10),
    (6,'♠','9',9),(7,'♠','8',8),(8,'♠','7',7),(9,'♠','6',6),(10,'♠','5',5),
    (11,'♠','4',4),(12,'♠','3',3),(13,'♠','2',2),
    (14,'♥','A',14),(15,'♥','K',13),(16,'♥','Q',12),(17,'♥','J',11),(18,'♥','10',10),
    (19,'♥','9',9),(20,'♥','8',8),(21,'♥','7',7),(22,'♥','6',6),(23,'♥','5',5),
    (24,'♥','4',4),(25,'♥','3',3),(26,'♥','2',2),
    (27,'♦','A',14),(28,'♦','K',13),(29,'♦','Q',12),(30,'♦','J',11),(31,'♦','10',10),
    (32,'♦','9',9),(33,'♦','8',8),(34,'♦','7',7),(35,'♦','6',6),(36,'♦','5',5),
    (37,'♦','4',4),(38,'♦','3',3),(39,'♦','2',2),
    (40,'♣','A',14),(41,'♣','K',13),(42,'♣','Q',12),(43,'♣','J',11),(44,'♣','10',10),
    (45,'♣','9',9),(46,'♣','8',8),(47,'♣','7',7),(48,'♣','6',6),(49,'♣','5',5),
    (50,'♣','4',4),(51,'♣','3',3),(52,'♣','2',2)`);
  await sleep(300);

  await showSQL('プレイヤー追加', 'INSERT INTO players VALUES (1,"タロウ",1000), (2,"ハナコ",1000)');
  exec(db, 'INSERT INTO players VALUES (1, "タロウ", 1000), (2, "ハナコ", 1000)');
  await sleep(300);

  // Step 3: Shuffle + Deal
  console.log('\n  ── Step 3: シャッフルして配る (ORDER BY RANDOM) ──');
  await showSQL('山札を作る', 'CREATE TABLE deck AS SELECT ROW_NUMBER() OVER (ORDER BY RANDOM()) - 1 AS pos, id AS card_id FROM cards');
  exec(db, 'CREATE TABLE deck AS SELECT ROW_NUMBER() OVER (ORDER BY RANDOM()) - 1 AS pos, id AS card_id FROM cards');
  await sleep(300);

  await showSQL('手札を配る', 'INSERT INTO hands SELECT pos / 2, card_id FROM deck WHERE pos < 4');
  exec(db, 'INSERT INTO hands SELECT pos / 2, card_id FROM deck WHERE pos < 4');
  await sleep(300);

  // Step 4: JOIN to see hands
  console.log('\n  ── Step 4: 手札を見る (JOIN) ──');
  await showSQL('プレイヤー名と手札', 'SELECT p.name, c.rank, c.suit FROM players p JOIN hands h ON p.id = h.player_id JOIN cards c ON h.card_id = c.id');
  const hands = query(db, 'SELECT p.name, c.rank, c.suit FROM players p JOIN hands h ON p.id = h.player_id JOIN cards c ON h.card_id = c.id ORDER BY p.id, c.val DESC');
  await showResult(hands, '手札');
  await sleep(500);

  // Step 5: Community cards
  console.log('\n  ── Step 5: コミュニティカード (INSERT + SELECT) ──');
  await showSQL('コミュニティカード', 'CREATE TABLE community AS SELECT card_id FROM deck WHERE pos >= 4 AND pos < 9');
  exec(db, 'CREATE TABLE community AS SELECT card_id FROM deck WHERE pos >= 4 AND pos < 9');
  await sleep(300);

  await showSQL('ボードを見る', 'SELECT c.rank, c.suit FROM community cc JOIN cards c ON cc.card_id = c.id');
  const board = query(db, 'SELECT c.rank, c.suit FROM community cc JOIN cards c ON cc.card_id = c.id');
  await showResult(board, 'ボード');
  await sleep(500);

  // Step 6: Evaluate
  console.log('\n  ── Step 6: 役判定 (GROUP BY + 集約関数) ──');
  await typewriteLine('  💡 7枚から5枚を選んで最強の役を判定', 30);
  await typewriteLine('  C(7,5)=20通りを全部試す！\n', 30);

  await showSQL('全カードを1つに', 'SELECT player_id, card_id FROM hands UNION ALL SELECT -1, card_id FROM community');
  const allCards = query(db, 'SELECT player_id, card_id FROM hands UNION ALL SELECT -1, card_id FROM community');
  await showResult(allCards, '全カード');
  await sleep(500);

  // Final result
  console.log('\n  🎉 ポーカーゲーム完成！');
  console.log('  使ったSQL: CREATE, INSERT, SELECT, WHERE, JOIN, ORDER BY, GROUP BY, UNION ALL');
  console.log('  これでSQLの基本はマスター！');

  await pause();

  // Final quiz
  clear();
  header('Day 7: 最終クイズ');

  await typewriteLine('\n  ❓ 7日間で学んだSQLコマンドを全部選べ\n', 30);

  console.log('  1) SELECT  2) WHERE  3) INSERT  4) UPDATE');
  console.log('  5) DELETE  6) JOIN   7) GROUP BY  8) ORDER BY');

  let ans = await promptChoice();
  if (ans === '12345678' || ans === '1 2 3 4 5 6 7 8' || ans === '全て' || ans === '全部') {
    console.log('\n  ✅ 正解！全部使った！おめでとう！');
  } else {
    console.log('\n  💡 全部使ったよ！SELECT, WHERE, INSERT, UPDATE, DELETE, JOIN, GROUP BY, ORDER BY');
  }

  await pause();

  clear();
  header('🎓 7日でわかるSQL — 修了！');

  await typewriteLine('\n  おめでとう！7日間のSQL学習が完了しました！\n', 40);
  console.log('  Day 1: SELECT  ✅');
  console.log('  Day 2: WHERE   ✅');
  console.log('  Day 3: INSERT  ✅');
  console.log('  Day 4: UPDATE/DELETE ✅');
  console.log('  Day 5: JOIN    ✅');
  console.log('  Day 6: GROUP BY ✅');
  console.log('  Day 7: 総合 — ポーカー ✅');
  console.log('\n  次は実際にデータベースを触ってみよう！');
  console.log('  sqlite3 :memory: < sql-poker.sql で遊んでね 🎮\n');
}

// ── Main menu ──
async function main() {
  clear();
  header('7日でわかるSQL — ポーカーで学ぶSQL入門');

  await typewriteLine('\n  🎮 ポーカーゲームを作りながらSQLを学ぼう！', 40);
  await typewriteLine('  7日間でSQLの基本が身につくよ。\n', 30);

  console.log('  1) Day 1 — SELECT（データを見る）');
  console.log('  2) Day 2 — WHERE（データを絞る）');
  console.log('  3) Day 3 — INSERT（データを追加）');
  console.log('  4) Day 4 — UPDATE/DELETE（変更/削除）');
  console.log('  5) Day 5 — JOIN（テーブル結合）');
  console.log('  6) Day 6 — GROUP BY（データ集約）');
  console.log('  7) Day 7 — 総合（ポーカーゲーム制作）');
  console.log('  8) フリーモード（ポーカーを遊ぶ）');
  console.log('  0) 終了');

  const rl = createInterface({ input: process.stdin, output: process.stdout });

  rl.question('\n  > ', async (input) => {
    rl.close();
    const choice = input.trim();

    switch (choice) {
      case '1': await day1(); break;
      case '2': await day2(); break;
      case '3': await day3(); break;
      case '4': await day4(); break;
      case '5': await day5(); break;
      case '6': await day6(); break;
      case '7': await day7(); break;
      case '8': await freeMode(); break;
      case '0': console.log('Bye!'); process.exit(0);
      default: console.log('1-8 を選んでね');
    }

    await main();
  });
}

async function freeMode() {
  clear();
  header('フリーモード — ポーカーを遊ぶ');

  const db = new DatabaseSync(':memory:');
  const sqlPath = join(__dirname, 'sql-poker.sql');
  const fullSQL = readFileSync(sqlPath, 'utf8');

  exec(db, fullSQL.match(/CREATE TABLE cards[\s\S]*?;/)[0]);
  exec(db, fullSQL.match(/INSERT INTO cards[\s\S]*?;/)[0]);
  exec(db, fullSQL.match(/CREATE TABLE deck[\s\S]*?;/)[0]);
  exec(db, fullSQL.match(/INSERT INTO deck[\s\S]*?;/)[0]);
  exec(db, fullSQL.match(/CREATE TABLE hand_cards[\s\S]*?;/)[0]);
  exec(db, fullSQL.match(/CREATE TABLE community_cards[\s\S]*?;/)[0]);
  exec(db, `INSERT INTO hand_cards (player, card_id) SELECT d.pos / 2, d.card_id FROM deck d WHERE d.pos < 4`);
  exec(db, `INSERT INTO community_cards (card_id) SELECT d.card_id FROM deck d WHERE d.pos >= 4 AND d.pos < 9`);

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
  const commCards = query(db, 'SELECT c.rank, c.suit FROM community_cards cc JOIN cards c ON c.id = cc.card_id').map(c => c.rank + c.suit);

  console.log('\n  HOLE:');
  for (const [p, cards] of Object.entries(grouped)) console.log(`    P${p}: ${cards.join('  ')}`);
  console.log(`  BOARD: ${commCards.join('  ')}`);

  const evalCTE = `WITH comm AS (SELECT card_id, ROW_NUMBER() OVER () - 1 AS ci FROM community_cards), hole AS (SELECT player, card_id, ROW_NUMBER() OVER (PARTITION BY player ORDER BY card_id) - 1 AS hi FROM hand_cards), p7(player, card_id, bit) AS (SELECT h.player, h.card_id, h.hi FROM hole h UNION ALL SELECT DISTINCT h.player, cn.card_id, cn.ci + 2 FROM hole h CROSS JOIN comm cn), p7c AS (SELECT p.player, p.card_id, p.bit, c.suit, c.val FROM p7 p JOIN cards c ON c.id = p.card_id), sub AS (SELECT a.player, a.card_id,b.card_id,c.card_id,d.card_id,e.card_id, a.suit,b.suit,c.suit,d.suit,e.suit, a.val,b.val,c.val,d.val,e.val FROM p7c a JOIN p7c b ON b.player=a.player AND b.bit>a.bit JOIN p7c c ON c.player=a.player AND c.bit>b.bit JOIN p7c d ON d.player=a.player AND c.bit<d.bit JOIN p7c e ON e.player=a.player AND d.bit<e.bit), eval AS (SELECT player, v0,v1,v2,v3,v4, s0,s1,s2,s3,s4, CASE WHEN s0=s1 AND s1=s2 AND s2=s3 AND s3=s4 THEN 1 ELSE 0 END AS fl, MAX(v0,MAX(v1,MAX(v2,MAX(v3,v4)))) AS mx, MIN(v0,MIN(v1,MIN(v2,MIN(v3,v4)))) AS mn, (SELECT COUNT(DISTINCT x) FROM (SELECT v0 x UNION SELECT v1 UNION SELECT v2 UNION SELECT v3 UNION SELECT v4)) AS uq, (SELECT MAX(c) FROM (SELECT COUNT(*) AS c FROM (SELECT v0 AS vi UNION ALL SELECT v1 UNION ALL SELECT v2 UNION ALL SELECT v3 UNION ALL SELECT v4) GROUP BY vi)) AS tf, (SELECT vi FROM (SELECT vi, COUNT(*) AS c FROM (SELECT v0 vi UNION ALL SELECT v1 UNION ALL SELECT v2 UNION ALL SELECT v3 UNION ALL SELECT v4) GROUP BY vi ORDER BY COUNT(*) DESC, vi DESC LIMIT 1)) AS tv, (SELECT vi FROM (SELECT vi, COUNT(*) AS c, ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC, vi DESC) AS rn FROM (SELECT v0 vi UNION ALL SELECT v1 UNION ALL SELECT v2 UNION ALL SELECT v3 UNION ALL SELECT v4) GROUP BY vi) WHERE rn=2 LIMIT 1) AS sv, (SELECT c FROM (SELECT vi, COUNT(*) AS c, ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC, vi DESC) AS rn FROM (SELECT v0 vi UNION ALL SELECT v1 UNION ALL SELECT v2 UNION ALL SELECT v3 UNION ALL SELECT v4) GROUP BY vi) WHERE rn=2 LIMIT 1) AS sf FROM sub), ranked AS (SELECT player, tf, sf, tv, sv, CASE WHEN fl=1 AND ((mx-mn=4 AND uq=5) OR (mx=14 AND mn=2 AND uq=5 AND (SELECT COUNT(*) FROM (SELECT v0 x UNION ALL SELECT v1 UNION ALL SELECT v2 UNION ALL SELECT v3 UNION ALL SELECT v4) WHERE x IN (14,2,3,4,5))=5)) THEN 9 WHEN tf=4 THEN 8 WHEN tf=3 AND sf=2 THEN 7 WHEN fl=1 THEN 6 WHEN uq=5 AND mx-mn=4 THEN 5 WHEN uq=5 AND mx=14 AND (SELECT COUNT(*) FROM (SELECT v0 x UNION ALL SELECT v1 UNION ALL SELECT v2 UNION ALL SELECT v3 UNION ALL SELECT v4) WHERE x IN (14,2,3,4,5))=5 THEN 5 WHEN tf=3 THEN 4 WHEN tf=2 AND sf=2 THEN 3 WHEN tf=2 THEN 2 ELSE 1 END AS hr, COALESCE(tv,0)*10000 + COALESCE(sv,0)*100 + COALESCE((SELECT MAX(x) FROM (SELECT v0 x UNION ALL SELECT v1 UNION ALL SELECT v2 UNION ALL SELECT v3 UNION ALL SELECT v4) WHERE x != COALESCE((SELECT vi FROM (SELECT vi FROM (SELECT v0 vi UNION ALL SELECT v1 UNION ALL SELECT v2 UNION ALL SELECT v3 UNION ALL SELECT v4) GROUP BY vi ORDER BY COUNT(*) DESC, vi DESC LIMIT 1)),-1)),0) AS tb FROM eval), best AS (SELECT player, hr, tb, ROW_NUMBER() OVER (PARTITION BY player ORDER BY hr DESC, tb DESC) AS rn FROM ranked), pb AS (SELECT player, hr, tb FROM best WHERE rn=1), hn AS (SELECT player, hr, tb, CASE hr WHEN 9 THEN "Straight Flush" WHEN 8 THEN "Four of a Kind" WHEN 7 THEN "Full House" WHEN 6 THEN "Flush" WHEN 5 THEN "Straight" WHEN 4 THEN "Three of a Kind" WHEN 3 THEN "Two Pair" WHEN 2 THEN "One Pair" WHEN 1 THEN "High Card" END AS hand_name FROM pb)`;

  const results = query(db, `${evalCTE} SELECT line FROM (SELECT "  P" || player || " → " || hand_name AS line, 1 AS o, hr, tb FROM hn UNION ALL SELECT * FROM (SELECT "🏆 P" || player || " → " || hand_name, 2, hr, tb FROM hn ORDER BY hr DESC, tb DESC LIMIT 1)) ORDER BY o, hr DESC, tb DESC`);

  console.log('\n  RESULT:');
  for (const r of results) console.log(`    ${r.line}`);

  await pause();
}

main();
