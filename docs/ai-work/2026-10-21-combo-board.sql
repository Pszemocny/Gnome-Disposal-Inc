-- BIGGEST COMBO board on the live database. Idempotent: safe to run again.
-- Constraints only: the trigger function scores_guard (and the salt in its body) stays as it is;
-- its 30/min, 2000/day and key checks already cover every board.
-- Existing rows pass both checks (no row has board 'combo' yet).
begin;

alter table public.scores
  drop constraint if exists scores_board_check,
  add constraint scores_board_check check (board ~ '^(main|speed|combo|daily-\d{4}-\d{2}-\d{2})$');

-- the biggest combo of one run, as the game shows it (machine feeding counts too); a whole number up to 100 000
alter table public.scores
  drop constraint if exists scores_combo_check,
  add constraint scores_combo_check check (board <> 'combo' or (score between 1 and 100000 and score = trunc(score)));

commit;
