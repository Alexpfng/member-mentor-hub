// Excel Import — 3 steps (combined on one artboard, side by side)

const importStyles = {
  step: { background: 'var(--cst-card-light)', border: '1px solid rgba(0,0,0,0.10)', borderRadius: 12, padding: 22, flex: 1, display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 },
  dropZone: { border: '2px dashed rgba(45,90,53,0.4)', borderRadius: 10, padding: '40px 20px', textAlign: 'center', background: 'rgba(45,90,53,0.04)', display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' },
  miniTable: { width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--cst-mono)', fontSize: 10 },
  miniTd: { padding: '6px 8px', borderBottom: '1px solid rgba(0,0,0,0.06)', color: 'var(--cst-text-dark)' },
  miniTh: { padding: '6px 8px', textAlign: 'left', background: 'rgba(0,0,0,0.04)', color: 'var(--cst-text-muted)', borderBottom: '1px solid rgba(0,0,0,0.10)', fontWeight: 600, letterSpacing: '0.14em' },
};

function CSTExcelImport() {
  return (
    <div className="cst-screen cst-light" style={{ flexDirection: 'row' }}>
      <CSTCoachSidebar active="import" />
      <div className="cst-scroll" style={{ flex: 1, padding: '24px 32px', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 18 }}>
          <div>
            <CSTSectionNum num={1} label="IMPORT EXCEL" sub="EXCEL → PROGRAMME INTERACTIF" />
            <h1 className="cst-display" style={{ fontSize: 44, margin: '10px 0 0' }}>DU TABLEUR</h1>
            <div className="cst-italic" style={{ fontSize: 26, color: 'var(--cst-mid-green)' }}>à l'action.</div>
          </div>
          <div className="cst-mono" style={{ color: 'var(--cst-text-dark)' }}>3 ÉTAPES · ≈ 2 MIN</div>
        </div>

        {/* Step indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
          {[['01','UPLOAD',true],['02','MAPPING',true],['03','CONFIRMATION',false]].map(([n,l,done],i,arr) => (
            <React.Fragment key={n}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: done ? 'var(--cst-mid-green)' : '#fff',
                  border: '1.5px solid var(--cst-mid-green)',
                  color: done ? '#fff' : 'var(--cst-mid-green)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'var(--cst-mono)', fontSize: 10, fontWeight: 700,
                }}>{done ? '✓' : n}</div>
                <span className="cst-mono" style={{ color: 'var(--cst-text-dark)', fontWeight: 600 }}>{l}</span>
              </div>
              {i < arr.length - 1 && <div style={{ flex: 1, height: 1, borderTop: '1px dashed rgba(0,0,0,0.2)' }} />}
            </React.Fragment>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 18, alignItems: 'stretch' }}>
          {/* STEP 1 */}
          <div style={importStyles.step}>
            <CSTSectionNum num={1} label="UPLOAD" />
            <h3 className="cst-display" style={{ fontSize: 20, margin: 0 }}>TON FICHIER.</h3>
            <div style={importStyles.dropZone}>
              <div style={{ fontSize: 36, color: 'var(--cst-mid-green)' }}>↥</div>
              <div className="cst-display" style={{ fontSize: 16 }}>GLISSE LE FICHIER ICI</div>
              <div className="cst-mono" style={{ fontSize: 9 }}>OU</div>
              <button className="cst-btn cst-btn-secondary cst-btn-sm">PARCOURIR</button>
              <div className="cst-mono" style={{ fontSize: 9, marginTop: 6, opacity: 0.6 }}>.XLSX · .XLS · .CSV · MAX 5 MB</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, background: 'rgba(45,90,53,0.06)', border: '1px solid rgba(45,90,53,0.2)', borderRadius: 8 }}>
              <div style={{ width: 36, height: 44, background: '#fff', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--cst-display)', fontSize: 13, color: 'var(--cst-mid-green)' }}>XLS</div>
              <div className="cst-col" style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--cst-text-dark)' }}>Programme Jordan F.xlsx</span>
                <span className="cst-mono" style={{ fontSize: 9 }}>34 KB · 8 SEMAINES DÉTECTÉES</span>
              </div>
              <span style={{ color: 'var(--cst-mid-green)' }}>✓</span>
            </div>
          </div>

          {/* STEP 2 */}
          <div style={importStyles.step}>
            <CSTSectionNum num={2} label="MAPPING" />
            <h3 className="cst-display" style={{ fontSize: 20, margin: 0 }}>LES COLONNES.</h3>
            <div className="cst-col" style={{ gap: 6 }}>
              {[
                ['Exercice', 'Nom de l\'exercice', true],
                ['Séries', 'Nombre de séries', true],
                ['Répétitions', 'Reps cibles', true],
                ['Charge (kg)', 'Charge prévue', true],
                ['Jour', 'Jour de la semaine', true],
                ['Semaine', 'Numéro de semaine', true],
                ['Note', 'Notes coach', false],
              ].map(([excel, app, mapped]) => (
                <div key={excel} style={{
                  display: 'grid', gridTemplateColumns: '1fr 16px 1fr',
                  alignItems: 'center', gap: 8,
                  padding: '6px 0',
                }}>
                  <div style={{ background: 'rgba(0,0,0,0.04)', padding: '8px 10px', borderRadius: 6, fontFamily: 'var(--cst-mono)', fontSize: 10, color: 'var(--cst-text-dark)' }}>{excel}</div>
                  <span style={{ color: mapped ? 'var(--cst-mid-green)' : 'rgba(0,0,0,0.3)', textAlign: 'center' }}>→</span>
                  <div style={{
                    padding: '8px 10px', borderRadius: 6, fontSize: 11,
                    background: mapped ? 'rgba(45,90,53,0.08)' : '#fff',
                    border: `1px solid ${mapped ? 'var(--cst-mid-green)' : 'rgba(0,0,0,0.12)'}`,
                    color: 'var(--cst-text-dark)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <span style={{ fontWeight: mapped ? 600 : 400, opacity: mapped ? 1 : 0.5 }}>{mapped ? app : '— choisir —'}</span>
                    <span style={{ opacity: 0.4 }}>▾</span>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ paddingTop: 8, borderTop: '1px solid rgba(0,0,0,0.06)' }}>
              <label className="cst-label" style={{ color: 'var(--cst-text-muted)' }}>NOM DU PROGRAMME</label>
              <input className="cst-input cst-input-light" defaultValue="Force Fondamentale — Cycle 1" />
            </div>
            <button className="cst-btn cst-btn-primary" style={{ marginTop: 'auto' }}>CONVERTIR EN PROGRAMME →</button>
          </div>

          {/* STEP 3 */}
          <div style={importStyles.step}>
            <CSTSectionNum num={3} label="CONFIRMATION" />
            <h3 className="cst-display" style={{ fontSize: 20, margin: 0 }}>APERÇU.</h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[['SEMAINES','8'],['JOURS','32'],['EXERCICES','187'],['SÉRIES','648']].map(([k,v]) => (
                <div key={k} style={{ background: 'rgba(0,0,0,0.04)', padding: '10px 12px', borderRadius: 8 }}>
                  <div className="cst-mono" style={{ fontSize: 9 }}>{k}</div>
                  <div className="cst-display" style={{ fontSize: 22, color: 'var(--cst-text-dark)' }}>{v}</div>
                </div>
              ))}
            </div>

            <div style={{ background: '#1B2E1F', borderRadius: 8, padding: 12, color: '#fff' }} className="cst-hatch">
              <div className="cst-mono" style={{ fontSize: 9, color: 'var(--cst-mid-green)' }}>SEMAINE 01 · JOUR 1 · PUSH A</div>
              <div className="cst-col" style={{ gap: 4, marginTop: 8 }}>
                {[
                  ['● Développé Couché', '4 × 6-8 @ RPE 8'],
                  ['● Overhead Press',   '3 × 10  @ RPE 7'],
                  ['● Dips',             '3 × AMRAP'],
                  ['· · · + 4 exercices',''],
                ].map((r,i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, opacity: i === 3 ? 0.5 : 1 }}>
                    <span>{r[0]}</span>
                    <span className="cst-mono" style={{ fontSize: 9 }}>{r[1]}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="cst-col" style={{ gap: 8, marginTop: 'auto' }}>
              <button className="cst-btn cst-btn-ghost-light cst-btn-sm">MODIFIER DANS LE BUILDER →</button>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="cst-btn cst-btn-secondary cst-btn-sm" style={{ flex: 1 }}>ASSIGNER À UN MEMBRE</button>
                <button className="cst-btn cst-btn-primary cst-btn-sm" style={{ flex: 1 }}>ENREGISTRER ●</button>
              </div>
            </div>
          </div>
        </div>

        {/* Raw preview */}
        <div style={{ marginTop: 20, background: '#fff', border: '1px solid rgba(0,0,0,0.10)', borderRadius: 12, padding: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <CSTSectionNum num={4} label="APERÇU BRUT" sub="PROGRAMME JORDAN F.XLSX" />
            <span className="cst-mono" style={{ color: 'var(--cst-text-dark)' }}>FEUILLE 1 / 8 · LIGNES 1-7 SUR 187</span>
          </div>
          <table style={importStyles.miniTable}>
            <thead>
              <tr>
                {['SEMAINE','JOUR','EXERCICE','SÉRIES','RÉPÉTITIONS','CHARGE (KG)','REPOS','NOTE'].map(h => (
                  <th key={h} style={importStyles.miniTh}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                ['1','LUN','Développé Couché','4','6-8','75','3 min','Échauffement 2 séries'],
                ['1','LUN','Overhead Press','3','10','45','2 min',''],
                ['1','LUN','Dips','3','AMRAP','BW','2 min','Lest si trop facile'],
                ['1','MER','Tractions','4','6-10','BW','3 min',''],
                ['1','MER','Row Barre','4','8','60','2 min',''],
                ['1','VEN','Squat Barre','5','5','85','4 min','Tempo 3-1-1'],
                ['1','VEN','Romanian DL','4','8','70','3 min',''],
              ].map((r,i) => (
                <tr key={i}>
                  {r.map((c,ci) => <td key={ci} style={importStyles.miniTd}>{c}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { CSTExcelImport });
