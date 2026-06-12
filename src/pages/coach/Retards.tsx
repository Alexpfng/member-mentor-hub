import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { useQuery } from '@tanstack/react-query';
import CoachSidebar from '../../components/CoachSidebar';
import { CSTSectionNum } from '../../components/Atoms';
import { getLateSessions, remindLateMember } from '@/lib/coach-dashboard.functions';

export default function CoachRetards() {
  return <CoachRetardsInner />;
}

function CoachRetardsInner() {
  const navigate = useNavigate();
  const lateFn = useServerFn(getLateSessions);
  const remindFn = useServerFn(remindLateMember);
  const { data: groups, isLoading } = useQuery({ queryKey: ['coach', 'late-sessions'], queryFn: () => lateFn() });
  const [remindedIds, setRemindedIds] = useState<Set<string>>(() => new Set());
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  async function remind(memberId: string, lateCount: number) {
    try {
      await remindFn({ data: { memberId, lateCount } });
      setRemindedIds((s) => new Set([...s, memberId]));
    } catch (e) {
      console.error('[remind]', e);
    }
  }

  function toggleExpand(memberId: string) {
    setExpanded((s) => {
      const next = new Set(s);
      next.has(memberId) ? next.delete(memberId) : next.add(memberId);
      return next;
    });
  }

  const memberCount = groups?.length ?? 0;

  return (
    <div className="cst-screen" style={{ flexDirection: 'row' }}>
      <CoachSidebar />
      <div className="cst-col cst-scroll" style={{ flex: 1, minWidth: 0 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', padding: '24px 32px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexWrap: 'wrap', gap: 12 }}>
          <CSTSectionNum
            num={1}
            label="SÉANCES EN RETARD"
            sub={isLoading ? 'CHARGEMENT…' : memberCount > 0 ? `${memberCount} COACHÉ${memberCount > 1 ? 'S' : ''} À RELANCER` : 'TOUS À JOUR'}
          />
          <button className="cst-btn cst-btn-ghost-dark cst-btn-sm" onClick={() => navigate({ to: '/coach' })}>
            ← TABLEAU DE BORD
          </button>
        </div>

        {/* Info band */}
        <div className="cst-mono" style={{ fontSize: 10, opacity: 0.5, padding: '10px 32px', borderBottom: '1px solid rgba(255,255,255,0.04)', letterSpacing: '0.15em' }}>
          SÉANCES PLANIFIÉES NON COMMENCÉES · RETARD ≥ 3 JOURS · FENÊTRE 30 JOURS
        </div>

        {/* Content */}
        <div style={{ padding: '24px 32px 32px' }}>
          {isLoading ? (
            <div className="cst-mono" style={{ fontSize: 11, opacity: 0.5, padding: 16 }}>CHARGEMENT…</div>
          ) : memberCount === 0 ? (
            <div className="cst-card-dark" style={{ padding: 32, textAlign: 'center', opacity: 0.7 }}>
              Tous tes coachés sont à jour ✅ — aucune séance en retard sur les 30 derniers jours.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {(groups ?? []).map((g) => {
                const sent = remindedIds.has(g.memberId);
                const open = expanded.has(g.memberId);
                const validatedPct = g.totalPlanned > 0 ? Math.round((g.doneCount / g.totalPlanned) * 100) : 0;

                return (
                  <div key={g.memberId} className="cst-card-dark" style={{ borderRadius: 10, overflow: 'hidden' }}>
                    {/* Member header */}
                    <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: g.maxDaysLate >= 7 ? '#C0392B' : '#E07B39', flexShrink: 0 }} />

                      <div style={{ flex: 1, minWidth: 160 }}>
                        <div style={{ fontWeight: 700, fontSize: 15 }}>{g.memberName}</div>
                        {/* Ratio séances validées */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 5 }}>
                          <div style={{ flex: 1, maxWidth: 140, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${validatedPct}%`, background: validatedPct >= 75 ? 'var(--cst-mid-green)' : validatedPct >= 40 ? '#E07B39' : '#C0392B', borderRadius: 2, transition: 'width 0.3s' }} />
                          </div>
                          <span className="cst-mono" style={{ fontSize: 10, color: 'rgba(255,255,255,0.65)' }}>
                            {g.doneCount}/{g.totalPlanned} validée{g.totalPlanned > 1 ? 's' : ''} · {validatedPct}%
                          </span>
                        </div>
                      </div>

                      {/* Badge retard */}
                      <span className="cst-mono" style={{ fontSize: 10, color: '#E07B39', letterSpacing: '0.1em', flexShrink: 0 }}>
                        {g.lateCount} SÉANCE{g.lateCount > 1 ? 'S' : ''} EN RETARD · MAX +{g.maxDaysLate}J
                      </span>

                      {/* Actions */}
                      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                        <button
                          className="cst-btn cst-btn-ghost-dark cst-btn-sm"
                          onClick={() => toggleExpand(g.memberId)}
                        >
                          {open ? '▲ RÉDUIRE' : '▼ DÉTAIL'}
                        </button>
                        <button
                          className="cst-btn cst-btn-primary cst-btn-sm"
                          disabled={sent}
                          style={{ opacity: sent ? 0.55 : 1 }}
                          onClick={() => remind(g.memberId, g.lateCount)}
                        >
                          {sent ? '✓ RELANCÉ' : 'RELANCER →'}
                        </button>
                        <button
                          className="cst-btn cst-btn-ghost-dark cst-btn-sm"
                          onClick={() => navigate({ to: '/coach/membre/$memberId', params: { memberId: g.memberId } })}
                        >
                          FICHE
                        </button>
                      </div>
                    </div>

                    {/* Expandable session list */}
                    {open && (
                      <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '10px 18px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {g.sessions.map((s) => (
                          <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
                            <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'rgba(224,123,57,0.7)', flexShrink: 0 }} />
                            <span style={{ flex: 1, fontSize: 13 }}>{s.dayLabel || 'Séance'}</span>
                            <span className="cst-mono" style={{ fontSize: 10, opacity: 0.55 }}>
                              {new Date(`${s.plannedDate}T00:00:00`).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                            </span>
                            <span className="cst-mono" style={{ fontSize: 10, color: '#E07B39' }}>+{s.daysLate}j</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
