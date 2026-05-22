'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

// ── constants ─────────────────────────────────────────────────────────────────
const MOCK_USERS = [
  { rank: 1, alias: 'KPOP', clicks: 1204 },
  { rank: 2, alias: 'MRKR', clicks: 988 },
  { rank: 3, alias: 'NEON', clicks: 741 },
  { rank: 4, alias: 'VOID', clicks: 502 },
  { rank: 5, alias: 'PXEL', clicks: 389 },
  { rank: 6, alias: 'LUNA', clicks: 211 },
  { rank: 7, alias: 'FUZZ', clicks: 98 },
]
const MOCK_PET = { happiness: 72, energy: 58, mood: 'HAPPY' as Mood }
const API_BASE = process.env.NEXT_PUBLIC_TAMAGOTCHI_API ?? ''
const FACES = {
  HAPPY:    { el: '◕', er: '◕', m: '‿' },
  CONTENT:  { el: '·', er: '·', m: '—' },
  SAD:      { el: '╥', er: '╥', m: '︵' },
  SLEEPING: { el: '─', er: '─', m: '∿' },
}
const MOOD_ICONS: Record<Mood, string> = { HAPPY: '♥', CONTENT: '♦', SAD: '♣', SLEEPING: '☽' }

// ── types ─────────────────────────────────────────────────────────────────────
type Mood = 'HAPPY' | 'CONTENT' | 'SAD' | 'SLEEPING'
type Pet  = { happiness: number; energy: number; mood: Mood }
type User = { rank: number; alias: string; clicks: number }

function fmtNum(n: number) { return n.toLocaleString() }

async function apiFetch(path: string, opts?: RequestInit) {
  const ctrl = new AbortController()
  const id   = setTimeout(() => ctrl.abort(), 4000)
  try {
    return await fetch(API_BASE + path, { ...opts, signal: ctrl.signal })
  } finally {
    clearTimeout(id)
  }
}

// ── component ─────────────────────────────────────────────────────────────────
export default function TamagotchiPage() {
  const [alias, setAlias]               = useState<string | null>(null)
  const [localClicks, setLocalClicks]   = useState(0)
  const [showModal, setShowModal]       = useState(false)
  const [aliasInput, setAliasInput]     = useState('')
  const [aliasError, setAliasError]     = useState('')
  const [serverOnline, setServerOnline] = useState(false)
  const [pet, setPet]                   = useState<Pet>(MOCK_PET)
  const [board, setBoard]               = useState<User[]>(MOCK_USERS)
  const [myRank, setMyRank]             = useState<number | null>(null)
  const [syncNote, setSyncNote]         = useState('')
  const [animKey, setAnimKey]           = useState(0) // bump to re-trigger click anim
  const [isClicked, setIsClicked]       = useState(false)

  const pendingRef     = useRef(0)
  const flushTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const aliasRef       = useRef<string | null>(null)
  const localRef       = useRef(0)
  const onlineRef      = useRef(false)

  useEffect(() => { aliasRef.current = alias }, [alias])
  useEffect(() => { localRef.current = localClicks }, [localClicks])
  useEffect(() => { onlineRef.current = serverOnline }, [serverOnline])

  const saveClicks = (n: number) => {
    localRef.current = n
    if (typeof window !== 'undefined') localStorage.setItem('mp_clicks', String(n))
  }

  const applySyncNote = (pending: number, online: boolean) => {
    setSyncNote(!online && pending > 0
      ? `${pending} click${pending > 1 ? 's' : ''} will sync when Pi comes online`
      : '')
  }

  const withBoard = useCallback((users: User[], currentAlias: string | null, currentClicks: number): User[] => {
    if (!currentAlias || users.some(u => u.alias === currentAlias)) return users
    if (currentClicks <= 0) return users
    return [...users, { rank: 0, alias: currentAlias, clicks: currentClicks }]
      .sort((a, b) => b.clicks - a.clicks)
      .map((u, i) => ({ ...u, rank: i + 1 }))
  }, [])

  // ── flush ──────────────────────────────────────────────────────────────────
  const flushClicks = useCallback(async () => {
    if (flushTimerRef.current) { clearTimeout(flushTimerRef.current); flushTimerRef.current = null }
    if (!pendingRef.current || !aliasRef.current) return

    const count = pendingRef.current
    pendingRef.current = 0
    try {
      const res  = await apiFetch('/api/click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alias: aliasRef.current, count }),
      })
      const data = await res.json()
      if (res.ok) {
        const online = !!data.piOnline
        setServerOnline(online)
        if (online) {
          // only trust cumulative count from the Pi — mock returns batch size which would reset the counter
          setLocalClicks(data.clicks); saveClicks(data.clicks)
          setMyRank(data.rank)
        }
        if (data.pet) setPet(data.pet)
        setSyncNote('')
      }
    } catch {
      pendingRef.current += count
      setServerOnline(false)
      applySyncNote(pendingRef.current, false)
    }
  }, [])

  // ── poll ───────────────────────────────────────────────────────────────────
  const pollLeaderboard = useCallback(async () => {
    if (pendingRef.current > 0) await flushClicks()
    try {
      const res  = await apiFetch('/api/leaderboard')
      const data = await res.json()
      if (!res.ok) throw new Error()
      const piOnline = !!data.piOnline
      setServerOnline(piOnline)
      if (data.pet) setPet(data.pet)
      setBoard(data.users || [])
      if (!piOnline) applySyncNote(pendingRef.current, false)
      else setSyncNote('')
    } catch {
      setServerOnline(false)
      setPet(MOCK_PET)
      setBoard(withBoard(MOCK_USERS, aliasRef.current, localRef.current))
      applySyncNote(pendingRef.current, false)
    }
  }, [flushClicks, withBoard])

  // ── click ──────────────────────────────────────────────────────────────────
  const onPetClick = useCallback(() => {
    if (!aliasRef.current) { setShowModal(true); return }

    setLocalClicks(prev => { const n = prev + 1; saveClicks(n); return n })
    pendingRef.current++
    applySyncNote(pendingRef.current, onlineRef.current)

    setIsClicked(true)
    setTimeout(() => setIsClicked(false), 400)

    if (pendingRef.current >= 5) {
      flushClicks()
    } else if (!flushTimerRef.current) {
      flushTimerRef.current = setTimeout(flushClicks, 3000)
    }
  }, [flushClicks])

  // ── register ───────────────────────────────────────────────────────────────
  const submitAlias = useCallback(async () => {
    const v = aliasInput.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
    if (v.length !== 4) { setAliasError('Must be exactly 4 characters.'); return }
    setAliasError('')

    setAlias(v); aliasRef.current = v
    if (typeof window !== 'undefined') localStorage.setItem('mp_alias', v)

    try {
      const res  = await apiFetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alias: v }),
      })
      const data = await res.json()
      if (!res.ok) { setAliasError(data.error || 'Error'); return }
      const online = !!data.piOnline
      setServerOnline(online)
      if (online) {
        setLocalClicks(data.clicks ?? 0); saveClicks(data.clicks ?? 0)
        setMyRank(data.rank ?? null)
      }
      if (data.pet) setPet(data.pet)
    } catch {
      setServerOnline(false)
      setPet(MOCK_PET)
    }

    setShowModal(false)
    pollLeaderboard()
  }, [aliasInput, pollLeaderboard])

  // ── init ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return
    const savedAlias  = localStorage.getItem('mp_alias')
    const savedClicks = parseInt(localStorage.getItem('mp_clicks') || '0', 10)

    if (!savedAlias) {
      setShowModal(true)
    } else {
      setAlias(savedAlias); aliasRef.current = savedAlias
      setLocalClicks(savedClicks); localRef.current = savedClicks
      apiFetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alias: savedAlias }),
      }).then(r => r.json()).then(d => {
        const online = !!d.piOnline
        setServerOnline(online)
        if (online) {
          setLocalClicks(d.clicks ?? 0); saveClicks(d.clicks ?? 0)
          setMyRank(d.rank ?? null)
        }
        if (d.pet) setPet(d.pet)
      }).catch(() => { setServerOnline(false); setPet(MOCK_PET) })
    }

    pollLeaderboard()
    const id = setInterval(pollLeaderboard, 10000)
    const onHide = () => { if (document.visibilityState === 'hidden') flushClicks() }
    document.addEventListener('visibilitychange', onHide)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onHide) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── derived ────────────────────────────────────────────────────────────────
  const face         = FACES[pet.mood] || FACES.CONTENT
  const moodClass    = pet.mood === 'HAPPY' ? 'mood-happy' : pet.mood === 'SLEEPING' ? 'mood-sleeping' : pet.mood === 'SAD' ? 'mood-sad' : ''
  const svgClass     = ['pet-svg', moodClass, isClicked ? 'clicked' : ''].filter(Boolean).join(' ')
  const displayBoard = serverOnline ? board : withBoard(MOCK_USERS, alias, localClicks)
  const meInBoard    = displayBoard.some(u => u.alias === alias)

  return (
    <>
      <style>{CSS}</style>

      {/* registration modal */}
      {showModal && (
        <div className="t-modal-bg">
          <div className="t-modal-card">
            <div className="t-modal-title">Enter Your Alias</div>
            <div className="t-modal-sub">
              Choose a 4-letter name to track your clicks on the leaderboard.
              Same alias = shared score.
            </div>
            <input
              className="t-alias-input"
              type="text"
              maxLength={4}
              placeholder="XYZW"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              value={aliasInput}
              onChange={e => setAliasInput(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              onKeyDown={e => e.key === 'Enter' && submitAlias()}
              autoFocus
            />
            {aliasError && <div className="t-modal-err">{aliasError}</div>}
            <button className="t-modal-btn" onClick={submitAlias}>JOIN</button>
          </div>
        </div>
      )}

      {/* main app — fixed wrapper escapes root overflow:hidden */}
      <div className="t-root">
        <div className="t-wrap">

          {/* header */}
          <div className="t-header">
            <div className="t-title">Mildred Pierce — Tamagotchi</div>
            <div className="t-alias-row">
              playing as{' '}
              <span className="t-alias-chip">{alias ?? '????'}</span>
              <button className="t-change-btn" onClick={() => setShowModal(true)}>change</button>
            </div>
            <div className={`t-status-badge ${serverOnline ? 'live' : 'demo'}`}>
              <span className="t-status-dot" />
              <span className="t-status-text">
                {serverOnline ? 'live' : 'demo — pi offline'}
              </span>
            </div>
          </div>

          {/* pet */}
          <div className="t-pet-area">
            <div className="t-pet-wrap">
              <svg
                className={svgClass}
                viewBox="0 0 180 220"
                xmlns="http://www.w3.org/2000/svg"
                onClick={onPetClick}
                onKeyDown={e => (e.key === ' ' || e.key === 'Enter') && onPetClick()}
                role="button"
                tabIndex={0}
                aria-label="Click to feed"
              >
                <rect x="86" y="4" width="8" height="22" rx="4" fill="#C8B090"/>
                <circle cx="90" cy="4" r="5" fill="#00c8ff"/>
                <rect x="30" y="24" width="120" height="90" rx="10" fill="#040e22" stroke="#0d3a6e" strokeWidth="2"/>
                <rect x="40" y="32" width="100" height="72" rx="6" fill="#020a18" stroke="#0a2a50" strokeWidth="1.5"/>
                <rect className="t-tv-screen" x="44" y="36" width="92" height="64" rx="4" fill="#0f0010"/>
                <text x="68"  y="72" textAnchor="middle" fontSize="16" fill="#F5EDD5" fontFamily="monospace">{face.el}</text>
                <text x="112" y="72" textAnchor="middle" fontSize="16" fill="#F5EDD5" fontFamily="monospace">{face.er}</text>
                <text x="90"  y="88" textAnchor="middle" fontSize="14" fill="#F5EDD5" fontFamily="monospace">{face.m}</text>
                <rect x="82" y="114" width="16" height="14" rx="2" fill="#0a2a50"/>
                <rect x="46" y="128" width="88" height="52" rx="8" fill="#040e22" stroke="#0d3a6e" strokeWidth="2"/>
                <rect x="74" y="140" width="32" height="20" rx="4" fill="#020a18" stroke="#0a2a50" strokeWidth="1"/>
                <circle cx="90" cy="150" r="5" fill="#00c8ff" opacity="0.7"/>
                <rect x="20" y="128" width="28" height="12" rx="6" fill="#040e22" stroke="#0d3a6e" strokeWidth="1.5"/>
                <circle cx="16" cy="134" r="7" fill="#040e22" stroke="#0d3a6e" strokeWidth="1.5"/>
                <rect x="132" y="128" width="28" height="12" rx="6" fill="#040e22" stroke="#0d3a6e" strokeWidth="1.5"/>
                <circle cx="164" cy="134" r="7" fill="#040e22" stroke="#0d3a6e" strokeWidth="1.5"/>
                <rect x="58" y="178" width="24" height="32" rx="6" fill="#040e22" stroke="#0d3a6e" strokeWidth="1.5"/>
                <rect x="98" y="178" width="24" height="32" rx="6" fill="#040e22" stroke="#0d3a6e" strokeWidth="1.5"/>
                <ellipse cx="70"  cy="210" rx="16" ry="8" fill="#020a18" stroke="#0a2a50" strokeWidth="1.5"/>
                <ellipse cx="110" cy="210" rx="16" ry="8" fill="#020a18" stroke="#0a2a50" strokeWidth="1.5"/>
              </svg>
              {pet.mood === 'SLEEPING' && (
                <div className="t-zzz-group">
                  <span className="t-zzz" style={{ left: 8, top: 0 }}>z</span>
                  <span className="t-zzz t-zzz2" style={{ left: 16, top: -6 }}>z</span>
                  <span className="t-zzz t-zzz3" style={{ left: 24, top: -12 }}>z</span>
                </div>
              )}
            </div>
            <div className="t-mood-label">{MOOD_ICONS[pet.mood]} {pet.mood}</div>
            <div className="t-tap-hint">tap to feed</div>
          </div>

          {/* stat bars */}
          <div className="t-stats">
            <div className="t-stat-row">
              <div className="t-stat-label">Happiness</div>
              <div className="t-bar-track">
                <div
                  className={`t-bar-fill ${pet.happiness > 70 ? 'high' : ''}`}
                  style={{ width: `${Math.round(pet.happiness)}%` }}
                />
              </div>
              <div className="t-stat-pct">{Math.round(pet.happiness)}%</div>
            </div>
            <div className="t-stat-row">
              <div className="t-stat-label">Energy</div>
              <div className="t-bar-track">
                <div
                  className={`t-bar-fill ${pet.energy > 60 ? 'high' : ''}`}
                  style={{ width: `${Math.round(pet.energy)}%` }}
                />
              </div>
              <div className="t-stat-pct">{Math.round(pet.energy)}%</div>
            </div>
          </div>

          {/* score */}
          <div className="t-score-row">
            <div className="t-score-item">
              <div className="t-score-val">{fmtNum(localClicks)}</div>
              <div className="t-score-sub">Your clicks</div>
            </div>
            <div className="t-score-item">
              <div className="t-score-val">{myRank ? `#${myRank}` : '—'}</div>
              <div className="t-score-sub">Rank</div>
            </div>
          </div>

          {/* leaderboard */}
          <div>
            <div className="t-board-title">Leaderboard</div>
            <div className="t-board-list">
              {displayBoard.map(u => (
                <div key={u.alias} className={`t-board-row ${u.alias === alias ? 'me' : ''}`}>
                  <span className="t-board-rank">#{u.rank}</span>
                  <span className="t-board-alias">{u.alias}</span>
                  <span className="t-board-clicks">{fmtNum(u.clicks)}</span>
                </div>
              ))}
              {alias && !meInBoard && localClicks > 0 && (
                <>
                  <div className="t-board-row separator">· · ·</div>
                  <div className="t-board-row me">
                    <span className="t-board-rank">{myRank ? `#${myRank}` : '—'}</span>
                    <span className="t-board-alias">{alias}</span>
                    <span className="t-board-clicks">{fmtNum(localClicks)}</span>
                  </div>
                </>
              )}
              {!displayBoard.length && (
                <div className="t-board-row">
                  <span className="t-board-alias" style={{ color: 'var(--t-dim)' }}>no clicks yet</span>
                </div>
              )}
            </div>
            {syncNote && <div className="t-sync-note">{syncNote}</div>}
          </div>

        </div>
      </div>
    </>
  )
}

// ── styles ────────────────────────────────────────────────────────────────────
const CSS = `
  :root {
    --t-bg:       #020a18;
    --t-bg2:      #040e22;
    --t-wine:     #051428;
    --t-burg:     #0d3a6e;
    --t-blue:     #00c8ff;
    --t-glow:     #00c8ff88;
    --t-ivory:    #F5EDD5;
    --t-parch:    #C8B090;
    --t-dim:      #1a3a5a;
    --t-font:     'Georgia', 'Bookman Old Style', serif;
  }

  /* full-viewport shell — escapes root overflow:hidden and all global bg */
  .t-root {
    position: fixed;
    inset: 0;
    z-index: 100;
    background: #020a18;
    overflow-y: auto;
    overflow-x: hidden;
    color: var(--t-ivory);
    font-family: var(--t-font);
    -webkit-overflow-scrolling: touch;
  }

  /* scanlines */
  .t-root::after {
    content: '';
    position: fixed;
    inset: 0;
    background: repeating-linear-gradient(
      to bottom,
      transparent 0px, transparent 2px,
      rgba(0,0,0,0.18) 2px, rgba(0,0,0,0.18) 3px
    );
    pointer-events: none;
    z-index: 9999;
  }

  .t-wrap {
    max-width: 420px;
    margin: 0 auto;
    padding: 24px 16px max(24px, env(safe-area-inset-bottom));
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  /* header */
  .t-header { text-align: center; }
  .t-title {
    font-size: clamp(1rem, 5vw, 1.3rem);
    letter-spacing: 0.22em;
    text-transform: uppercase;
    text-shadow: 0 0 18px var(--t-glow);
  }
  .t-alias-row {
    margin-top: 8px;
    font-size: 0.75rem;
    letter-spacing: 0.15em;
    color: var(--t-parch);
  }
  .t-alias-chip {
    display: inline-block;
    background: var(--t-wine);
    border: 1px solid var(--t-burg);
    padding: 2px 10px;
    border-radius: 2px;
    font-size: 0.85rem;
    color: var(--t-ivory);
    letter-spacing: 0.2em;
  }
  .t-change-btn {
    background: none; border: none;
    color: var(--t-parch); font-family: var(--t-font);
    font-size: 0.7rem; letter-spacing: 0.1em;
    cursor: pointer; text-decoration: underline; padding: 0 4px;
  }
  .t-change-btn:hover { color: var(--t-ivory); }

  /* status badge */
  .t-status-badge {
    display: inline-flex; align-items: center; gap: 5px;
    margin-top: 6px; font-size: 0.62rem;
    letter-spacing: 0.2em; text-transform: uppercase;
    color: var(--t-dim);
  }
  .t-status-dot {
    width: 6px; height: 6px; border-radius: 50%;
    background: var(--t-dim); flex-shrink: 0;
  }
  .t-status-badge.live .t-status-dot  { background: #00e060; box-shadow: 0 0 5px #00e06088; }
  .t-status-badge.live .t-status-text { color: #00e060; }
  .t-status-badge.demo .t-status-dot  { background: var(--t-parch); }
  .t-status-badge.demo .t-status-text { color: var(--t-parch); }

  /* pet area */
  .t-pet-area {
    display: flex; flex-direction: column;
    align-items: center; gap: 10px;
  }
  .t-pet-wrap { position: relative; display: inline-block; }

  /* SVG character */
  .pet-svg {
    width: 180px; height: 220px;
    cursor: pointer; user-select: none;
    -webkit-tap-highlight-color: transparent;
    filter: drop-shadow(0 0 10px var(--t-glow));
    animation: t-idle-bob 2s ease-in-out infinite;
    transition: filter 0.2s;
    outline: none;
  }
  .pet-svg:active { transform: scale(0.95); }
  .pet-svg.clicked {
    animation: t-click-jump 0.35s ease-out forwards, t-idle-bob 2s ease-in-out infinite 0.35s;
  }
  .pet-svg.mood-happy   { animation: t-happy-dance 0.8s ease-in-out infinite; filter: drop-shadow(0 0 20px #00c8ffcc); }
  .pet-svg.mood-sleeping{ animation: t-sleep-sway 4s ease-in-out infinite; filter: drop-shadow(0 0 6px #0d3a6e88); }
  .pet-svg.mood-sad     { filter: drop-shadow(0 0 6px #020a1888); }

  .t-tv-screen { transition: fill 0.05s; }
  .pet-svg.clicked .t-tv-screen { fill: #ffffff; }

  @keyframes t-idle-bob {
    0%,100% { transform: translateY(0); }
    50%     { transform: translateY(-6px); }
  }
  @keyframes t-click-jump {
    0%   { transform: translateY(0) scale(1); }
    30%  { transform: translateY(-16px) scale(1.08); }
    60%  { transform: translateY(-8px) scale(1.04); }
    100% { transform: translateY(0) scale(1); }
  }
  @keyframes t-happy-dance {
    0%,100% { transform: translateY(0) rotate(-3deg); }
    25%     { transform: translateY(-10px) rotate(3deg); }
    50%     { transform: translateY(-4px) rotate(-2deg); }
    75%     { transform: translateY(-8px) rotate(2deg); }
  }
  @keyframes t-sleep-sway {
    0%,100% { transform: rotate(-2deg); }
    50%     { transform: rotate(2deg); }
  }
  @keyframes t-zzz-float {
    0%   { opacity: 0; transform: translate(0,0); }
    20%  { opacity: 0.8; }
    100% { opacity: 0; transform: translate(12px,-30px); }
  }

  /* zzz */
  .t-zzz-group { position: absolute; top: 10px; right: -4px; }
  .t-zzz {
    position: absolute; font-size: 1.1rem;
    color: var(--t-parch); opacity: 0; pointer-events: none;
    animation: t-zzz-float 2.5s ease-out infinite;
  }
  .t-zzz2 { animation-delay: 0.8s; font-size: 0.8rem; }
  .t-zzz3 { animation-delay: 1.6s; font-size: 0.65rem; }

  .t-mood-label {
    font-size: 0.8rem; letter-spacing: 0.25em;
    text-transform: uppercase;
    color: var(--t-blue); text-shadow: 0 0 8px var(--t-glow);
  }
  .t-tap-hint { font-size: 0.68rem; letter-spacing: 0.15em; color: var(--t-dim); text-transform: uppercase; }

  /* stat bars */
  .t-stats { display: flex; flex-direction: column; gap: 10px; }
  .t-stat-row { display: flex; align-items: center; gap: 10px; }
  .t-stat-label { font-size: 0.68rem; letter-spacing: 0.18em; color: var(--t-parch); text-transform: uppercase; width: 82px; flex-shrink: 0; }
  .t-bar-track { flex: 1; height: 8px; background: var(--t-wine); border-radius: 2px; overflow: hidden; }
  .t-bar-fill { height: 100%; background: var(--t-burg); border-radius: 2px; transition: width 0.6s ease, background 0.4s; }
  .t-bar-fill.high { background: var(--t-blue); box-shadow: 0 0 6px var(--t-glow); }
  .t-stat-pct { font-size: 0.7rem; color: var(--t-parch); width: 32px; text-align: right; flex-shrink: 0; }

  /* score */
  .t-score-row { display: flex; justify-content: center; gap: 32px; padding: 12px; background: var(--t-bg2); border: 1px solid var(--t-wine); border-radius: 4px; }
  .t-score-item { text-align: center; }
  .t-score-val { font-size: 1.6rem; text-shadow: 0 0 10px var(--t-glow); letter-spacing: 0.05em; }
  .t-score-sub { font-size: 0.62rem; letter-spacing: 0.2em; color: var(--t-parch); text-transform: uppercase; margin-top: 2px; }

  /* leaderboard */
  .t-board-title { font-size: 0.72rem; letter-spacing: 0.28em; text-transform: uppercase; color: var(--t-parch); margin-bottom: 8px; }
  .t-board-list { display: flex; flex-direction: column; gap: 4px; }
  .t-board-row { display: flex; align-items: center; gap: 12px; padding: 7px 10px; background: var(--t-bg2); border: 1px solid transparent; border-radius: 3px; font-size: 0.82rem; letter-spacing: 0.1em; }
  .t-board-row.me { border-color: var(--t-burg); border-left: 3px solid var(--t-blue); background: #020c20; }
  .t-board-row.separator { background: none; border: none; color: var(--t-dim); font-size: 0.65rem; justify-content: center; letter-spacing: 0.2em; padding: 2px; }
  .t-board-rank { color: var(--t-dim); width: 24px; text-align: right; font-size: 0.72rem; }
  .t-board-alias { flex: 1; color: var(--t-ivory); letter-spacing: 0.18em; }
  .t-board-clicks { color: var(--t-parch); text-align: right; font-size: 0.78rem; }

  .t-sync-note { font-size: 0.6rem; letter-spacing: 0.12em; color: var(--t-parch); text-align: center; margin-top: 6px; }

  /* modal */
  .t-modal-bg { position: fixed; inset: 0; background: rgba(0,0,0,0.88); display: flex; align-items: center; justify-content: center; z-index: 10000; padding: 24px; }
  .t-modal-card { background: var(--t-wine); border: 1px solid var(--t-burg); box-shadow: 0 0 32px var(--t-glow); border-radius: 4px; padding: 32px 28px; max-width: 320px; width: 100%; text-align: center; display: flex; flex-direction: column; gap: 18px; }
  .t-modal-title { font-size: 0.9rem; letter-spacing: 0.28em; text-transform: uppercase; text-shadow: 0 0 10px var(--t-glow); }
  .t-modal-sub { font-size: 0.72rem; letter-spacing: 0.12em; color: var(--t-parch); line-height: 1.5; }
  .t-alias-input { background: var(--t-bg); border: 1px solid var(--t-burg); color: var(--t-ivory); font-family: var(--t-font); font-size: 1.8rem; letter-spacing: 0.35em; text-align: center; text-transform: uppercase; padding: 10px 12px; border-radius: 3px; width: 100%; outline: none; caret-color: var(--t-blue); }
  .t-alias-input:focus { border-color: var(--t-blue); box-shadow: 0 0 8px var(--t-glow); }
  .t-modal-err { font-size: 0.68rem; color: var(--t-blue); letter-spacing: 0.1em; }
  .t-modal-btn { background: var(--t-blue); color: #020a18; border: none; font-family: var(--t-font); font-size: 0.78rem; letter-spacing: 0.25em; text-transform: uppercase; padding: 12px 24px; border-radius: 3px; cursor: pointer; box-shadow: 0 0 12px var(--t-glow); font-weight: bold; transition: opacity 0.15s; }
  .t-modal-btn:hover { opacity: 0.85; }
`
