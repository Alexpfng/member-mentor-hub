#!/bin/bash
set -e
OUT=02_data_public.sql
{
echo "-- Données public (UUID d'origine préservés)"
echo "begin;"
echo "set session_replication_role = replica;"
} > $OUT
TABLES=$(psql -Atc "select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' order by 1")
for t in $TABLES; do
  n=$(psql -Atc "select count(*) from public.\"$t\"")
  echo "-- $t: $n rows" >> $OUT
  if [ "$n" != "0" ]; then
    psql -Atc "select format('insert into public.%I select * from jsonb_populate_record(null::public.%I, %L::jsonb);','$t','$t', row_to_json(x)::text) from public.\"$t\" x" >> $OUT
  fi
  echo "$t=$n"
done
{
echo "set session_replication_role = default;"
echo "commit;"
} >> $OUT
