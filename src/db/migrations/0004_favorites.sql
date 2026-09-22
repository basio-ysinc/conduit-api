-- お気に入り。PRIMARY KEY (user_id, article_id) で重複登録を防ぎ、
-- INSERT OR IGNORE / DELETE で冪等な登録・解除を実現する。
CREATE TABLE favorites (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, article_id)
);
