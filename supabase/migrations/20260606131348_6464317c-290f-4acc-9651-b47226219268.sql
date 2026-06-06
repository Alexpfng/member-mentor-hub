
-- A2: movement patterns column + auto-classification
ALTER TABLE public.exercises
  ADD COLUMN IF NOT EXISTS movement_patterns text[] NOT NULL DEFAULT '{}';

-- A4: add Pliométrie intensity code
INSERT INTO public.intensity_codes (code, label, color_hex, description)
VALUES (
  'plyo',
  'Pliométrie',
  '#E07B39',
  'Mouvements de saut et de rebond pour développer la puissance et l''élasticité. Cycle étirement-raccourcissement. Qualité d''exécution > quantité. Repos complet entre les séries — jamais dans la fatigue. Exemples : box jumps, depth jumps, bondissements.'
)
ON CONFLICT (code) DO UPDATE SET label = EXCLUDED.label, color_hex = EXCLUDED.color_hex, description = EXCLUDED.description;

-- A2: auto-classify movement patterns from exercise name
UPDATE public.exercises SET movement_patterns = ARRAY(
  SELECT DISTINCT p FROM (
    SELECT 'push' AS p WHERE name ~* '(développé|dvp|bench|press|pompe|push|dips|écarté| fly|overhead|ohp|militaire|élévation|chest)'
    UNION ALL
    SELECT 'pull' WHERE name ~* '(traction|tirage|row|rowing|curl|pull|face pull|shrug|lat|dos|biceps)'
    UNION ALL
    SELECT 'legs' WHERE name ~* '(squat|fente|lunge|leg|jambe|mollet|calf|extension|presse|hack|pistol|step up|cossack|sissy|quadri)'
    UNION ALL
    SELECT 'hinge' WHERE name ~* '(deadlift|soulevé|rdl|ischio|hip thrust|glute|good morning|nordic|pont|bridge|fessier)'
    UNION ALL
    SELECT 'core' WHERE name ~* '(gainage|plank|planche|abdo|crunch|dead bug|bird dog|pallof|hollow|relevé|sit up|iso )'
    UNION ALL
    SELECT 'cardio' WHERE name ~* '(course|run|sprint|fractionné|côte|vélo|rameur|hiit|corde|burpee)'
    UNION ALL
    SELECT 'mobility' WHERE name ~* '(cars|car |mobilité|mobility|pail|rail|rotation|circle|arch|stretch|étirement)'
  ) sub WHERE p IS NOT NULL
);

-- A4: reclassify plyometric exercises into 'plyo' intensity
UPDATE public.exercises
SET intensity_code = 'plyo', category = 'plyo'
WHERE name ~* '(box jump|depth jump|pogo|bondisse|split squat jump|jump squat|broad jump|lateral jump|tuck jump|saut|plyo|plio)';
