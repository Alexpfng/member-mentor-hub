import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function readSource(path: string) {
  return readFileSync(join(root, path), "utf8");
}

describe("formats spéciaux — coach et live session", () => {
  it("route les circuits et AMRAP vers un écran timer dédié, même avec plusieurs exercices chaînés", () => {
    const source = readSource("src/components/cst/LiveSession.tsx");
    expect(source).toContain('blockType === "circuit" || blockType === "amrap"');
    expect(source).not.toContain('blockType === "circuit" && !isSuperset');
  });

  it("route les EMOM multi-exercices vers un timer minute par minute", () => {
    const source = readSource("src/components/cst/LiveSession.tsx");
    expect(source).toContain('blockType === "emom" && isSuperset');
    expect(source).toContain('kind: "emom"');
    expect(source).toContain("emomMode: emomPlan.mode");
    expect(source).toContain("minutePlan: emomPlan.minutePlan");
    expect(source).not.toContain('blockType === "emom" && !isSuperset');
  });

  it("lit les isométries écrites avec un slash comme une durée", () => {
    const source = readSource("src/components/cst/LiveSession.tsx");
    expect(source).toContain('replace(/\\s*\\/\\s*(?=s|sec|secondes?\\b)/g, "")');
  });

  it("permet au coach de choisir Circuit ou AMRAP dans l'adaptation de semaine", () => {
    const source = readSource("src/pages/coach/AdapterSemaine.tsx");
    expect(source).toContain('"TYPE DE BLOC"');
    expect(source).toContain('"Circuit"');
    expect(source).toContain('"AMRAP"');
    expect(source).toContain('"TOURS"');
    expect(source).toContain('"OBJECTIF"');
  });

  it("garde les phases d'endurance séparées au lieu de les fusionner en un gros bloc", () => {
    const source = readSource("src/pages/coach/AdapterSemaine.tsx");
    expect(source).not.toContain("cardioFragments.push");
    expect(source).not.toContain("Fragment cardio qui suit un autre exercice cardio");

    const programSource = readSource("src/components/cst/ProgramBlocks.tsx");
    expect(programSource).toContain("const blocks = groupBlocks(exercises || [],");
    expect(programSource).not.toContain("mergeCardioBlocks(");
  });

  it("ne transforme pas les repères de phases course en blocs ou supersets muscu", () => {
    const source = readSource("src/pages/coach/AdapterSemaine.tsx");
    expect(source).toContain("!dayIsEndurance &&");

    const programSource = readSource("src/components/cst/ProgramBlocks.tsx");
    expect(programSource).toContain("isRunningSession?: boolean");
    expect(programSource).toContain("disableSupersets: isRunningSession");

    const runningSource = readSource("src/components/cst/RunningSession.tsx");
    expect(runningSource).toContain("<ProgramBlocks exercises={exercises} isRunningSession />");
  });

  it("affiche une édition endurance sans champs muscu charge ni RPE cible", () => {
    const source = readSource("src/pages/coach/AdapterSemaine.tsx");
    expect(source).toContain("isEnduranceEdit");
    expect(source).toContain('"VOLUME / DURÉE"');
    expect(source).toContain('"CONTENU / DISTANCE"');
    expect(source).toContain('"CONSIGNE FOOTING / OBJECTIF"');
    expect(source).toContain("!isEnduranceEdit &&");
    expect(source).toContain("const sugg = dayIsEndurance ? null : suggestFor(ex, fb)");
    expect(source).toContain("suggestion={isEnduranceSession(day) ? null : suggestFor(ex, fb)}");
  });

  it("construit les EMOM depuis buildEmomPlan pour garder le mode explicite", () => {
    const source = readSource("src/components/cst/LiveSession.tsx");
    expect(source).toContain("buildEmomPlan(");
    expect(source).toContain("emomMode: emomPlan.mode");
    expect(source).toContain("minutePlan: emomPlan.minutePlan");
  });

  it("expose les trois modes EMOM dans l'édition coach", () => {
    const source = readSource("src/pages/coach/AdapterSemaine.tsx");
    expect(source).toContain('"MODE EMOM"');
    expect(source).toContain('"Simple : 1 exercice"');
    expect(source).toContain('"Reps paires / impaires"');
    expect(source).toContain('"Exercice pair / impair"');
    expect(source).toContain("onEmomModeChange");
  });

  it("garde le mode EMOM exercice pair/impair dès que le coach choisit un code A1", () => {
    const source = readSource("src/pages/coach/AdapterSemaine.tsx");
    expect(source).toContain(
      'if (/^[A-Z]\\d$/i.test(String(ex.code ?? ""))) return "alternating-exercises";',
    );
  });

  it("affiche explicitement les EMOM alternes par exercice", () => {
    const source = readSource("src/components/cst/LiveSession.tsx");
    expect(source).toContain('emomMode === "alternating-exercises"');
    expect(source).toContain("minutePlan?.[currentMinute]");
    expect(source).toContain("PROCHAINE MINUTE");
  });
});
