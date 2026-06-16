-- Ajout de Hip Thrust et Abduction Machine dans la table exercises
-- Date: 2026-06-16

INSERT INTO exercises (id, name, category, muscle_group, equipement, default_tempo, description, is_global, is_archived, movement_patterns)
VALUES
  (
    'a1b2c3d4-e5f6-7890-abcd-ef1234567891',
    'Hip Thrust',
    'Renforcement',
    'Fessiers',
    'Barre / Banc',
    '2-1-2-1',
    'Dos appuyé sur le banc, barre sur les hanches. Pousse les hanches vers le haut en contractant les fessiers. Contrôle la descente.',
    true,
    false,
    '{}'
  ),
  (
    'b2c3d4e5-f6a7-8901-bcde-f12345678912',
    'Abduction Machine',
    'Renforcement',
    'Fessiers',
    'Machine',
    '2-1-2-0',
    'Assis sur la machine, pousse les jambes vers l''extérieur de façon contrôlée. Contracte les fessiers en fin de mouvement. Reviens lentement.',
    true,
    false,
    '{}'
  )
ON CONFLICT (id) DO NOTHING;
