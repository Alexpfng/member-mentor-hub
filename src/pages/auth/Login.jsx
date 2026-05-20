import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CSTLogo, CSTSectionNum, CSTDuoTitle } from '../../components/Atoms';

const DEMO_ACCOUNTS = [
  { email: 'coach@colosmart.fr',  password: 'coach123',  label: 'Léo Colognesi',  role: 'coach',  dest: '/coach' },
  { email: 'jordan@colosmart.fr', password: 'membre123', label: 'Jordan Ferrer',   role: 'membre', dest: '/membre' },
];

const hatchOverlay = {
  position: 'absolute', inset: 0, pointerEvents: 'none',
  backgroundImage: 'repeating-linear-gradient(135deg, rgba(255,255,255,0.025) 0 1px, transparent 1px 11px)',
};

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function fillDemo(account) {
    setEmail(account.email);
    setPassword(account.password);
    setError('');
  }

  function handleLogin(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    setTimeout(() => {
      const match = DEMO_ACCOUNTS.find(
        a => a.email === email.trim().toLowerCase() && a.password === password
      );
      setLoading(false);
      if (match) {
        navigate(match.dest);
      } else {
        setError('Email ou mot de passe incorrect.');
      }
    }, 600);
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--cst-dark-green)' }}>
      <div className="cst-screen cst-hatch" style={{ width: 390, height: 780, padding: '20px 24px 28px', position: 'relative', borderRadius: 16, overflow: 'hidden' }}>
        <div style={hatchOverlay} />
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 8 }}>
            <CSTLogo />
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 24 }}>
            <div className="cst-col" style={{ gap: 10 }}>
              <CSTSectionNum num={1} label="ACCÈS · L'ESPACE" />
              <CSTDuoTitle top="TON ESPACE." bottom="Connecte-toi." size={48} />
              <p style={{ margin: 0, fontSize: 13, opacity: 0.7, lineHeight: 1.55, maxWidth: 280 }}>
                Entraîne-toi. Note. Progresse.
              </p>
            </div>

            {/* Demo quick-access */}
            <div className="cst-col" style={{ gap: 8 }}>
              <span className="cst-mono" style={{ fontSize: 9, opacity: 0.5, letterSpacing: '0.2em' }}>— ACCÈS DÉMO —</span>
              <div style={{ display: 'flex', gap: 8 }}>
                {DEMO_ACCOUNTS.map(a => (
                  <button key={a.role} type="button" onClick={() => fillDemo(a)} style={{
                    flex: 1, padding: '12px 10px', borderRadius: 10, cursor: 'pointer',
                    background: a.role === 'coach' ? 'rgba(45,90,53,0.18)' : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${a.role === 'coach' ? 'rgba(45,90,53,0.5)' : 'rgba(255,255,255,0.12)'}`,
                    textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 4,
                  }}>
                    <span style={{
                      fontFamily: 'var(--cst-mono)', fontSize: 8, letterSpacing: '0.18em', textTransform: 'uppercase',
                      color: a.role === 'coach' ? 'var(--cst-mid-green)' : 'rgba(255,255,255,0.5)',
                    }}>
                      {a.role === 'coach' ? '★ COACH' : '○ MEMBRE'}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{a.label}</span>
                    <span style={{ fontFamily: 'var(--cst-mono)', fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>{a.email}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleLogin} className="cst-card-dark cst-hatch" style={{ padding: 22 }}>
              <div className="cst-col" style={{ gap: 14 }}>
                <div>
                  <span className="cst-label">EMAIL</span>
                  <input className="cst-input" placeholder="ton.email@domaine.fr" type="email"
                    value={email} onChange={e => { setEmail(e.target.value); setError(''); }} />
                </div>
                <div>
                  <span className="cst-label">MOT DE PASSE</span>
                  <input className="cst-input" type="password" placeholder="••••••••••"
                    value={password} onChange={e => { setPassword(e.target.value); setError(''); }} />
                </div>

                {error && (
                  <div style={{ padding: '10px 14px', background: 'rgba(139,35,24,0.15)', border: '1px solid rgba(139,35,24,0.4)', borderRadius: 8, fontSize: 12, color: '#C56A60' }}>
                    {error}
                  </div>
                )}

                <button type="submit" className="cst-btn cst-btn-primary" style={{ width: '100%', marginTop: 4, opacity: loading ? 0.7 : 1 }} disabled={loading}>
                  {loading ? 'CONNEXION…' : 'SE CONNECTER →'}
                </button>

                <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--cst-text-muted)' }}>
                  Mot de passe oublié ?
                </div>
              </div>
            </form>
          </div>

          <div className="cst-col" style={{ gap: 12, alignItems: 'center', paddingTop: 16 }}>
            <div style={{ width: 32, height: 1, background: 'rgba(255,255,255,0.1)' }} />
            <div className="cst-mono" style={{ fontSize: 8, opacity: 0.4 }}>
              COLOSMARTRAINING™ · VICHY · FR · EST. 2024
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
