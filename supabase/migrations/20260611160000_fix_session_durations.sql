-- Corrige les durées de séance aberrantes (ex. « 15401 min », « 9402 min »).
--
-- Cause : la durée était calculée en horloge murale (ended_at - started_at).
-- Une séance démarrée puis terminée/laissée ouverte plusieurs heures ou jours
-- plus tard produisait une durée énorme (15401 min = 10,7 jours).
--
-- Le code borne désormais la durée à 240 min (4 h) à l'écriture. Ici on nettoie
-- l'existant : toute durée > 240 min est implausible pour UNE séance → NULL.
-- Côté UI, NULL s'affiche proprement en « — » / « Durée non enregistrée ».

update public.sessions
set duration_minutes = null
where duration_minutes is not null
  and duration_minutes > 240;
