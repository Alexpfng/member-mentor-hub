-- 05_verify.sql — à exécuter sur la CIBLE après import. Les blocs 1 doivent renvoyer 0 ligne.
-- 1. Intégrité référentielle
select 'profiles orphelins' as ko, p.id::text from public.profiles p left join auth.users u on u.id=p.id where u.id is null
union all select 'roles orphelins', r.user_id::text from public.user_roles r left join auth.users u on u.id=r.user_id where u.id is null
union all select 'programs sans coach', pr.id::text from public.programs pr left join auth.users u on u.id=pr.coach_id where u.id is null
union all select 'assignments cassés', a.id::text from public.assignments a left join public.programs pr on pr.id=a.program_id left join auth.users u on u.id=a.member_id where pr.id is null or u.id is null
union all select 'sessions cassées', s.id::text from public.sessions s left join auth.users u on u.id=s.member_id where u.id is null
union all select 'set_logs orphelins', l.id::text from public.set_logs l left join public.sessions s on s.id=l.session_id where s.id is null
union all select 'feedbacks orphelins', f.id::text from public.exercise_feedbacks f left join public.sessions s on s.id=f.session_id where s.id is null
union all select 'assignment_weeks orphelines', w.id::text from public.assignment_weeks w left join public.assignments a on a.id=w.assignment_id where a.id is null
union all select 'session_media orphelins', m.id::text from public.session_media m left join public.sessions s on s.id=m.session_id where s.id is null;

-- 2. RLS active partout (doit renvoyer 0 ligne)
select relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='r' and not c.relrowsecurity;

-- 3. Chaque table a au moins un GRANT (doit renvoyer 0 ligne)
select t.table_name from information_schema.tables t
left join information_schema.role_table_grants g
  on g.table_name=t.table_name and g.table_schema='public'
  and g.grantee in ('authenticated','anon','service_role')
where t.table_schema='public' and t.table_type='BASE TABLE'
group by 1 having count(g.grantee)=0;

-- 4. Comptages attendus (valeurs source au 2026-08-09)
-- auth.users 9 | profiles 9 | user_roles 9 | exercises 685 | programs 49
-- assignments 28 | assignment_weeks 63 | planned_sessions 88 | sessions 106
-- set_logs 1289 | exercise_feedbacks 338 | exercise_comments 37 | personal_records 151
-- messages 93 | weekly_logbooks 19 | session_media 27 | technique_videos 9
-- invitations 11 | weight_logs 8 | run_stats 3 | pain_reports 2 | glossary 4
-- intensity_codes 7 | member_notification_prefs 6 | email_send_log 40
select 'auth.users' t, count(*) from auth.users
union all select 'profiles', count(*) from public.profiles
union all select 'user_roles', count(*) from public.user_roles
union all select 'exercises', count(*) from public.exercises
union all select 'programs', count(*) from public.programs
union all select 'assignments', count(*) from public.assignments
union all select 'assignment_weeks', count(*) from public.assignment_weeks
union all select 'planned_sessions', count(*) from public.planned_sessions
union all select 'sessions', count(*) from public.sessions
union all select 'set_logs', count(*) from public.set_logs
union all select 'exercise_feedbacks', count(*) from public.exercise_feedbacks
union all select 'personal_records', count(*) from public.personal_records
union all select 'messages', count(*) from public.messages
union all select 'weekly_logbooks', count(*) from public.weekly_logbooks
union all select 'session_media', count(*) from public.session_media
order by 1;
