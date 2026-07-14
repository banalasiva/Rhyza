-- Two-tier reaction palette (signal + expressive). Idempotent upsert; the app
-- derives signal-vs-expressive from src/lib/reactions.ts, so no column change.
INSERT INTO "reaction_types" ("key", "emoji", "label", "sort_order") VALUES
  ('clicked','💥','It clicked',1),
  ('point','💡','Good point',2),
  ('agree','✅','I''m with this',3),
  ('mind','🧠','Changed thinking',4),
  ('fence','⚖️','On the fence',5),
  ('confuse','🤔','Still confused',6),
  ('impl','🛠️','I tried this',7),
  ('ref','📚','Great reference',8),
  ('beauty','✨','Beautifully said',9),
  ('love','❤️','Love',20),
  ('clap','👏','Applause',21),
  ('haha','😂','Haha',22),
  ('fire','🔥','Fire',23),
  ('party','🎉','Celebrate',24),
  ('praise','🙌','Yes!',25)
ON CONFLICT ("key") DO UPDATE SET
  "emoji" = EXCLUDED."emoji",
  "label" = EXCLUDED."label",
  "sort_order" = EXCLUDED."sort_order";
