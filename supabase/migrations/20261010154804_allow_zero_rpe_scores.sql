alter table public.set_logs
  drop constraint if exists set_logs_rpe_check,
  add constraint set_logs_rpe_check check (rpe >= 0 and rpe <= 10);

alter table public.exercise_feedbacks
  drop constraint if exists exercise_feedbacks_rpe_check,
  add constraint exercise_feedbacks_rpe_check check (rpe >= 0 and rpe <= 10);
