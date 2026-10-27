import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Activity, ArrowRightLeft, BookOpen, Bot, FileUp, CalendarDays, CloudOff, PenLine, Timer, Trophy, Check, ChevronDown, ChevronLeft, ChevronRight, CircleUserRound, Dumbbell, Flame, Footprints, History, Image as ImageIcon, LoaderCircle, Minus, MessageCircle, Moon, Pause, Play, Plus, RotateCcw, Send, Sparkles, Trash2, TrendingUp, Undo2, Utensils, Volume2, VolumeX, X, Video } from "lucide-react";
import "./style.css";
import { AuthProvider, AuthScreen, LogoutButton, useAuth } from "./auth.jsx";
import { EmailVerificationBanner } from "./EmailVerificationBanner.jsx";
import { VerifyEmailPage } from "./VerifyEmailPage.jsx";
import { api } from "./api.js";
import { DEFAULT_PLAN, PLAN_GUIDE, PLAN_VERSION, WEEKDAY_IDS, exerciseMedia } from "./planData.js";

const GIF_CACHE_KEY = "plan_coach_gifs_v3";
// Copia local del progreso para no perder series si falla la conexión en el gimnasio.
const PROGRESS_CACHE_KEY = "plan_coach_progress_cache_v1";
const EMPTY_PROGRESS = { log: {}, alternatives: {}, foodLogs: {}, cardio: {}, checkins: {}, fatigue: {}, notes: {}, settings: { unit: "lb", sound: true } };
const FATIGUE = [
  { id: "green", label: "Verde", text: "Descansado, sin dolor → rutina completa." },
  { id: "yellow", label: "Amarillo", text: "Mal sueño o agujetas fuertes → 1 serie menos en accesorios y sin fallo." },
  { id: "red", label: "Rojo", text: "Fiebre, mareo, dolor torácico, falta de aire o lesión aguda → hoy no entrenes. Ante dolor torácico intenso o dificultad respiratoria, atención urgente." },
];

function App() {
  const { user } = useAuth();
  const today = localDate();
  const [plan, setPlan] = useState(DEFAULT_PLAN);
  const [progress, setProgress] = useState(EMPTY_PROGRESS);
  const [view, setView] = useState("train");
  const [sessionId, setSessionId] = useState(null);
  const [gifCache, setGifCache] = useLocalStorage(GIF_CACHE_KEY, {});
  const [timer, setTimer] = useState(null);
  const [timerNow, setTimerNow] = useState(Date.now());
  const [chatOpen, setChatOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [unsaved, setUnsaved] = useState(false);
  const [welcome, setWelcome] = useState(false);
  const synced = useRef(false);
  const latest = useRef(EMPTY_PROGRESS);
  const audio = useRef(null);

  const days = plan.blocks?.[plan.activeBlock]?.days || [];
  const settings = { ...EMPTY_PROGRESS.settings, ...progress.settings };
  const week = programWeek(plan, today);
  const phase = (plan.phases || []).find((item) => week >= item.from && week <= item.to) || null;
  const todayEntry = plan.week?.find((item) => item.id === WEEKDAY_IDS[new Date().getDay()]);
  const doneSessions = useMemo(() => completedSessions(plan, progress.log, week), [plan, progress.log, week]);
  const nextPending = days.find((item) => !doneSessions.has(item.id));
  const activeSession = sessionId || todayEntry?.dayId || (todayEntry?.type === "cardio" ? "cardio" : "rest");
  const selectedDay = days.find((item) => item.id === activeSession);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [{ plan: savedPlan }, { progress: savedProgress }] = await Promise.all([api.getPlan(), api.getProgress()]);
        if (cancelled) return;
        // Un plan guardado de otra versión se reemplaza por el plan de 8 semanas.
        // Los planes importados desde PDF se conservan aunque cambie PLAN_VERSION.
        if (savedPlan?.blocks && (savedPlan.version === PLAN_VERSION || savedPlan.source === "import")) setPlan(savedPlan);
        else {
          // Un usuario nuevo recibe el plan como ejemplo, sin los datos personales de Adam.
          const fresh = savedPlan && !savedPlan.sample ? DEFAULT_PLAN : { ...DEFAULT_PLAN, sample: true, nutrition: { ...DEFAULT_PLAN.nutrition, note: "Punto de partida orientativo: ajusta las calorías con tu peso y cintura cada dos semanas." } };
          setPlan(fresh);
          await api.savePlan(fresh);
        }
        if (!savedPlan) setWelcome(true);
        const cached = readProgressCache(user.id);
        // Si quedaron series sin subir (sin conexión), la copia local gana y se sube ahora.
        const source = cached?.dirty ? cached.progress : savedProgress;
        if (source && typeof source === "object") setProgress(normalizeProgress(source));
        synced.current = true;
      } catch (error) {
        console.warn("Workspace sync failed", error.message);
        const cached = readProgressCache(user.id);
        if (cached?.progress) { setProgress(normalizeProgress(cached.progress)); synced.current = true; setUnsaved(true); }
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    latest.current = progress;
    if (!synced.current) return;
    writeProgressCache(user.id, progress, true);
    const id = setTimeout(() => pushProgress(progress), 700);
    return () => clearTimeout(id);
  }, [progress]);

  useEffect(() => {
    if (!unsaved) return;
    const retry = () => pushProgress(latest.current);
    window.addEventListener("online", retry);
    const id = setInterval(retry, 20_000);
    return () => { window.removeEventListener("online", retry); clearInterval(id); };
  }, [unsaved]);

  async function pushProgress(value) {
    try {
      await api.saveProgress(value);
      if (latest.current === value) writeProgressCache(user.id, value, false);
      setUnsaved(false);
    } catch {
      setUnsaved(true);
    }
  }

  useEffect(() => {
    if (!synced.current) return;
    const id = setTimeout(() => api.savePlan(plan).catch(() => {}), 700);
    return () => clearTimeout(id);
  }, [plan]);

  // Solo los ejercicios sin demostración verificada pasan por el buscador del servidor.
  useEffect(() => {
    if (!selectedDay) return;
    let cancelled = false;
    (async () => {
      const pending = selectedDay.exercises.map((exercise) => currentAlternative(exercise, progress.alternatives).search).filter((search) => !exerciseMedia(search));
      for (let start = 0; start < pending.length; start += 3) {
        if (cancelled) break;
        await Promise.all(pending.slice(start, start + 3).map((search) => ensureGif(search, gifCache, setGifCache, false)));
      }
    })();
    return () => { cancelled = true; };
  }, [selectedDay?.id, progress.alternatives]);

  useEffect(() => {
    if (!timer || timer.paused) return;
    const id = setInterval(() => setTimerNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [timer]);

  const timerLeft = timer ? (timer.paused ? timer.remaining : Math.max(0, Math.ceil(((timer.end || 0) - timerNow) / 1000))) : 0;
  useEffect(() => {
    if (timer && !timer.paused && timerLeft === 0) {
      navigator.vibrate?.([220, 120, 220]);
      if (settings.sound) beep(audio);
      const id = setTimeout(() => setTimer(null), 2500);
      return () => clearTimeout(id);
    }
  }, [timerLeft]);

  function patchProgress(key, value) { setProgress((current) => ({ ...current, [key]: typeof value === "function" ? value(current[key] || {}) : value })); }
  function updateSet(exerciseId, setIndex, patch) {
    setProgress((current) => {
      const dayLog = current.log?.[today] || {};
      const rows = [...(dayLog[exerciseId] || [])];
      rows[setIndex] = { ...(rows[setIndex] || {}), ...patch };
      return { ...current, log: { ...current.log, [today]: { ...dayLog, [exerciseId]: rows } } };
    });
  }
  function rotateAlternative(exercise) {
    patchProgress("alternatives", (current) => ({ ...current, [exercise.id]: ((current[exercise.id] || 0) + 1) % exercise.alternatives.length }));
  }
  function resetDay(day) {
    if (!window.confirm("¿Borrar las series registradas hoy en esta sesión?")) return;
    const ids = new Set(day.exercises.map((exercise) => exercise.id));
    patchProgress("log", (current) => ({ ...current, [today]: Object.fromEntries(Object.entries(current[today] || {}).filter(([key]) => !ids.has(key))) }));
  }
  function startTimer(seconds, label) {
    unlockAudio(audio);
    setTimerNow(Date.now());
    setTimer({ end: Date.now() + seconds * 1000, total: seconds, paused: false, remaining: seconds, label });
    navigator.wakeLock?.request?.("screen").catch(() => {});
  }
  function toggleTimer() {
    setTimer((current) => {
      if (!current) return current;
      if (current.paused) return { ...current, paused: false, end: Date.now() + current.remaining * 1000 };
      return { ...current, paused: true, remaining: timerLeft };
    });
  }
  function shiftTimer(seconds) {
    setTimer((current) => current && (current.paused
      ? { ...current, remaining: Math.max(0, current.remaining + seconds) }
      : { ...current, end: Math.max(Date.now(), current.end + seconds * 1000), total: Math.max(current.total, timerLeft + seconds) }));
  }
  function openSession(id) { setSessionId(id); setView("train"); window.scrollTo({ top: 0, behavior: "smooth" }); }
  function setWeek(target) {
    const start = new Date(`${today}T12:00:00`);
    start.setDate(start.getDate() - (start.getDay() + 6) % 7 - (target - 1) * 7);
    setPlan((current) => ({ ...current, startDate: localDate(start) }));
  }

  if (!ready) return <div className="boot"><LoaderCircle className="spin" /> Sincronizando tu plan…</div>;

  return (
    <main className={`app-shell ${timer ? "with-timer" : ""}`}>
      <header className="app-header">
        <div className="phase-pill">
          <span className="week-badge"><small>Semana</small><b>{week}</b><small>/{plan.totalWeeks || 8}</small></span>
          <span className="phase-copy"><b>{phase?.title || plan.name}</b><small>{phase?.rir}{phase?.deload ? " · descarga" : ""}</small></span>
        </div>
        <div className="user-menu"><CircleUserRound size={22} /><LogoutButton /></div>
      </header>
      {unsaved && <div className="offline-bar" role="status"><CloudOff /> Sin conexión: tus series se guardan en el móvil y se subirán solas.</div>}

      <section className="content">
        {view === "train" && <SessionPicker days={days} week={plan.week} active={activeSession} todayEntry={todayEntry} done={doneSessions} onPick={openSession} />}
        {view === "train" && selectedDay && <WorkoutView key={selectedDay.id} day={selectedDay} plan={plan} phase={phase} today={today} progress={progress} settings={settings} gifCache={gifCache} onSet={updateSet} onRotate={rotateAlternative} onReset={() => resetDay(selectedDay)} onRetryGif={(search) => ensureGif(search, gifCache, setGifCache, true)} onTimer={startTimer} onFatigue={(value) => patchProgress("fatigue", (current) => ({ ...current, [today]: value }))} onNote={(text) => patchProgress("notes", (current) => ({ ...current, [today]: { ...current[today], [selectedDay.id]: text } }))} />}
        {view === "train" && !selectedDay && <RestDayView kind={activeSession} plan={plan} phase={phase} today={today} progress={progress} nextPending={nextPending} onOpen={openSession} onCardio={(minutes) => patchProgress("cardio", (current) => ({ ...current, [today]: current[today] ? 0 : minutes }))} />}
        {view === "week" && <WeekView plan={plan} week={week} phase={phase} today={today} progress={progress} settings={settings} done={doneSessions} onOpen={openSession} onWeek={setWeek} onCheckin={(patch) => patchProgress("checkins", (current) => ({ ...current, [today]: { ...current[today], ...patch } }))} onSettings={(patch) => patchProgress("settings", (current) => ({ ...current, ...patch }))} onPlan={setPlan} />}
        {view === "progress" && <ProgressView plan={plan} progress={progress} settings={settings} week={week} />}
        {view === "food" && <FoodView nutrition={plan.nutrition} progress={progress} setProgress={setProgress} imported={plan.source === "import"} />}
      </section>

      <nav className="bottom-nav" aria-label="Navegación principal">
        <NavButton active={view === "train"} icon={<Dumbbell />} label="Entreno" onClick={() => { setView("train"); setSessionId(null); }} />
        <NavButton active={view === "week"} icon={<CalendarDays />} label="Plan" onClick={() => setView("week")} />
        <NavButton active={view === "progress"} icon={<Activity />} label="Progreso" onClick={() => setView("progress")} />
        <NavButton active={view === "food"} icon={<Utensils />} label="Comida" onClick={() => setView("food")} />
        <NavButton active={chatOpen} icon={<MessageCircle />} label="Coach" onClick={() => setChatOpen(true)} accent />
      </nav>

      {timer && <RestTimer timer={timer} left={timerLeft} sound={settings.sound} onSound={() => patchProgress("settings", (current) => ({ ...current, sound: !settings.sound }))} onShift={shiftTimer} onToggle={toggleTimer} onClose={() => setTimer(null)} />}
      {welcome && <div className="sheet-backdrop" onClick={() => setWelcome(false)}><section className="welcome-sheet" onClick={(event) => event.stopPropagation()}><h2>Bienvenido</h2><p>¿Tienes tu rutina en PDF? Súbela y la convierto en tu plan semanal. Si no, empieza con el plan de ejemplo y cámbialo cuando quieras desde la pestaña Plan.</p><PlanImport plan={plan} onPlan={(next) => { setPlan(next); setWelcome(false); }} compact /><button className="auth-switch" onClick={() => setWelcome(false)}>Usar el plan de ejemplo</button></section></div>}
      {chatOpen && <CoachSheet user={user} plan={plan} onPlan={setPlan} onClose={() => setChatOpen(false)} />}
    </main>
  );
}

function SessionPicker({ days, week = [], active, todayEntry, done, onPick }) {
  const short = Object.fromEntries(week.filter((item) => item.dayId).map((item) => [item.dayId, item.label.slice(0, 3)]));
  const cardioDays = week.filter((item) => item.type === "cardio").map((item) => item.label.slice(0, 3));
  return <div className="session-picker" role="tablist" aria-label="Elegir sesión">
    {days.map((item) => <button key={item.id} role="tab" aria-selected={active === item.id} className={`${active === item.id ? "active" : ""} ${done.has(item.id) ? "done" : ""}`} onClick={() => onPick(item.id)}>
      <small>{short[item.id] || "Día"}{todayEntry?.dayId === item.id && <em>hoy</em>}</small><b>{item.title}</b>{done.has(item.id) && <Check className="chip-check" />}
    </button>)}
    {!!cardioDays.length && <button role="tab" aria-selected={active === "cardio"} className={active === "cardio" ? "active cardio" : "cardio"} onClick={() => onPick("cardio")}><small>{cardioDays.join(" · ")}{todayEntry?.type === "cardio" && <em>hoy</em>}</small><b>Cardio</b></button>}
  </div>;
}

function WorkoutView({ day, plan, phase, today, progress, settings, gifCache, onSet, onRotate, onReset, onRetryGif, onTimer, onFatigue, onNote }) {
  const fatigue = progress.fatigue?.[today] || "green";
  const todayLog = progress.log?.[today] || {};
  const targets = day.exercises.map((exercise) => targetSets(exercise, phase, fatigue));
  const doneCounts = day.exercises.map((exercise, index) => (todayLog[exercise.id] || []).slice(0, targets[index]).filter((row) => row?.done).length);
  const totals = { all: targets.reduce((a, b) => a + b, 0), done: doneCounts.reduce((a, b) => a + b, 0) };
  const firstOpen = day.exercises.findIndex((_, index) => doneCounts[index] < targets[index]);
  const [open, setOpen] = useState(firstOpen === -1 ? null : day.exercises[firstOpen].id);
  const cardRefs = useRef({});
  const percent = totals.all ? Math.round((totals.done / totals.all) * 100) : 0;
  const minutes = sessionMinutes(day, todayLog);

  function finishSet(index, exercise, setIndex, row) {
    onSet(exercise.id, setIndex, { ...row, done: true });
    const counts = doneCounts.map((count, i) => (i === index ? count + 1 : count));
    const pending = (i) => counts[i] < targets[i];
    const lastOfExercise = !pending(index);
    const after = day.exercises.findIndex((_, i) => i > index && pending(i));
    const nextIndex = after !== -1 ? after : day.exercises.findIndex((_, i) => pending(i));
    const sessionFinished = nextIndex === -1;
    if (!sessionFinished) onTimer(Number(exercise.rest) || 90, lastOfExercise ? `Siguiente: ${currentAlternative(day.exercises[nextIndex], progress.alternatives).name}` : `${currentAlternative(exercise, progress.alternatives).name} · serie ${setIndex + 2}`);
    if (lastOfExercise && nextIndex !== -1) {
      const nextId = day.exercises[nextIndex].id;
      setOpen(nextId);
      setTimeout(() => cardRefs.current[nextId]?.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
    }
  }

  return <div className="view-enter">
    <div className="session-head">
      <div><span className="eyebrow">{[day.subtitle, day.duration].filter(Boolean).join(" · ")}</span><h1>{day.title}</h1></div>
      <button className="icon-text" onClick={onReset}><RotateCcw /> Reiniciar</button>
    </div>
    <div className="session-progress"><div className="progress-track"><i style={{ width: `${percent}%` }} /></div><strong>{totals.done}<small>/{totals.all} series</small></strong></div>
    {minutes !== null && <p className="session-time"><Timer /> {minutes} min desde la primera serie{day.duration ? ` · objetivo ${day.duration}` : ""}</p>}

    <div className="fatigue" role="radiogroup" aria-label="Control de fatiga">
      {FATIGUE.map((item) => <button key={item.id} role="radio" aria-checked={fatigue === item.id} className={`${item.id} ${fatigue === item.id ? "active" : ""}`} onClick={() => onFatigue(item.id)}><i />{item.label}</button>)}
    </div>
    {fatigue !== "green" && <p className={`fatigue-note ${fatigue}`}>{FATIGUE.find((item) => item.id === fatigue).text}</p>}
    {phase?.deload && <p className="fatigue-note deload">Semana de descarga: 50–60 % de las series y RIR 3–4. Las series ya están reducidas.</p>}

    {plan.warmup && <details className="warmup"><summary><Flame /> Calentamiento{plan.source === "import" ? "" : " · 0–7 min"}</summary><p>{plan.warmup}</p></details>}

    <div className="exercise-stack">
      {day.exercises.map((exercise, index) => <ExerciseCard key={exercise.id} refCallback={(node) => { cardRefs.current[exercise.id] = node; }} index={index} exercise={exercise} target={targets[index]} rows={todayLog[exercise.id] || []} previous={lastSession(progress.log, exercise.id, today)} alternatives={progress.alternatives} phase={phase} settings={settings} gifCache={gifCache} open={open === exercise.id} onToggle={() => setOpen(open === exercise.id ? null : exercise.id)} onSet={onSet} onFinish={(setIndex, row) => finishSet(index, exercise, setIndex, { ...row, a: currentAlternative(exercise, progress.alternatives).search, t: Date.now() })} onRotate={() => onRotate(exercise)} onRetryGif={onRetryGif} />)}
    </div>
    <label className="session-note"><span><PenLine /> Nota de la sesión (dolor, sensaciones, máquina ocupada…)</span><textarea rows="2" value={progress.notes?.[today]?.[day.id] || ""} onChange={(event) => onNote(event.target.value.slice(0, 500))} placeholder="Ej. Hombro derecho molesto en el press inclinado" /></label>
    {day.note && <article className="coach-note"><Sparkles /><p>{day.note}</p></article>}
    <div className="timer-presets"><span>Descanso manual</span>{[60, 90, 120, 180].map((seconds) => <button key={seconds} onClick={() => onTimer(seconds, "Descanso")}>{formatTime(seconds)}</button>)}</div>
  </div>;
}

function ExerciseCard({ refCallback, index, exercise, target, rows, previous, alternatives, phase, settings, gifCache, open, onToggle, onSet, onFinish, onRotate, onRetryGif }) {
  const alternative = currentAlternative(exercise, alternatives);
  const media = exerciseMedia(alternative.search);
  const lookup = gifCache[alternative.search];
  const doneRows = rows.slice(0, target).map((row, setIndex) => ({ ...row, setIndex })).filter((row) => row.done);
  const activeIndex = Array.from({ length: target }, (_, setIndex) => setIndex).find((setIndex) => !rows[setIndex]?.done);
  const complete = activeIndex === undefined;
  const timed = isTimed(exercise.reps);
  const hint = progressionHint(exercise, previous, settings.unit);
  const suggestion = activeIndex === undefined ? null : suggestSet(exercise, rows, activeIndex, previous, hint);
  const previousText = previous ? previous.rows.filter((row) => row?.done).map((row) => timed ? `${row.r}s` : `${fmtNum(row.w)}×${row.r}`).join(" · ") : "";

  return <article ref={refCallback} className={`exercise-card ${exercise.tag || ""} ${complete ? "complete" : ""} ${open ? "open" : ""}`}>
    <button className="exercise-summary" onClick={onToggle} aria-expanded={open}>
      <span className="exercise-number">{complete ? <Check /> : index + 1}</span>
      <span className="exercise-copy">
        <b>{alternative.name}</b>
        <span className="exercise-meta"><strong>{target} × {exercise.reps}</strong><span>{formatTime(exercise.rest)} desc.</span>{exercise.main && <em>Base</em>}</span>
        <span className="pips">{Array.from({ length: target }, (_, i) => <i key={i} className={rows[i]?.done ? "on" : ""} />)}</span>
      </span>
      {!open && <Thumb media={media} lookup={lookup} name={alternative.name} />}
      <ChevronDown className="chevron" />
    </button>

    {open && <div className="exercise-body">
      <ExerciseMedia key={alternative.search} media={media} lookup={lookup} name={alternative.name} search={alternative.search} onRetry={() => onRetryGif(alternative.search)} />
      <p className="cue"><Sparkles /> {exercise.cue}</p>
      <div className="history-line">
        <span><History /> {previous ? <>Última vez <b>{previousText || "sin series"}</b></> : timed ? <>Primera vez: aguanta con técnica limpia</> : <>Primera vez: elige un peso con {phase?.rir || "RIR 2"}</>}</span>
        {hint && <span className="hint-up"><TrendingUp /> Sube a {fmtNum(hint.weight)} {settings.unit}</span>}
      </div>
      {exercise.alternatives.length > 1 && <button className="swap-button" onClick={onRotate}><ArrowRightLeft /> Cambiar a {exercise.alternatives[((alternatives?.[exercise.id] || 0) + 1) % exercise.alternatives.length].name}</button>}

      {!!doneRows.length && <ol className="done-sets">{doneRows.map((row) => <li key={row.setIndex}>
        <span className="set-tag">S{row.setIndex + 1}</span>
        <b>{timed ? `${row.r} s` : <>{fmtNum(row.w)} <small>{settings.unit}</small> × {row.r}</>}</b>
        {row.rir !== undefined && row.rir !== null && <span className="rir-tag">RIR {row.rir}</span>}
        <button onClick={() => onSet(exercise.id, row.setIndex, { done: false })} aria-label={`Deshacer serie ${row.setIndex + 1}`}><Undo2 /> Deshacer</button>
      </li>)}</ol>}

      {complete ? <div className="exercise-done"><Check /> Ejercicio completo</div> : <SetEditor key={`${activeIndex}-${alternative.search}`} exercise={exercise} setIndex={activeIndex} target={target} timed={timed} suggestion={suggestion} unit={settings.unit} rir={phase?.rir} onDone={(row) => onFinish(activeIndex, row)} />}
    </div>}
  </article>;
}

function SetEditor({ exercise, setIndex, target, timed, suggestion, unit, rir, onDone }) {
  const [weight, setWeight] = useState(suggestion.w);
  const [reps, setReps] = useState(suggestion.r);
  const [effort, setEffort] = useState(null);
  const step = unit === "kg" ? 2.5 : 5;
  return <div className="set-editor">
    <div className="set-editor-head"><b>Serie {setIndex + 1} <small>de {target}</small></b><span>Objetivo {exercise.reps}{timed ? "" : " reps"} · {rir || "RIR 2"}</span></div>
    <div className={`steppers ${timed ? "single" : ""}`}>
      {!timed && <Stepper label={`Peso · ${unit}`} value={weight} step={step} onChange={setWeight} decimal />}
      <Stepper label={timed ? "Segundos" : "Reps"} value={reps} step={timed ? 5 : 1} onChange={setReps} />
    </div>
    <div className="rir-picker" role="radiogroup" aria-label="Repeticiones en reserva">
      <span>RIR</span>{[0, 1, 2, 3, 4].map((value) => <button key={value} role="radio" aria-checked={effort === value} className={effort === value ? "active" : ""} onClick={() => setEffort(effort === value ? null : value)}>{value === 4 ? "4+" : value}</button>)}
    </div>
    <button className="done-button" onClick={() => onDone({ w: timed ? 0 : Number(weight) || 0, r: Number(reps) || 0, rir: effort })}><Check /><span>Serie hecha<small>Descanso {formatTime(exercise.rest)}</small></span></button>
  </div>;
}

function Stepper({ label, value, step, onChange, decimal }) {
  const set = (next) => onChange(Math.max(0, Math.round(next * 10) / 10));
  return <div className="stepper">
    <span>{label}</span>
    <div>
      <button onClick={() => set(Number(value || 0) - step)} aria-label={`Restar ${step}`}><Minus /></button>
      <input inputMode={decimal ? "decimal" : "numeric"} value={value} onFocus={(event) => event.target.select()} onChange={(event) => onChange(event.target.value.replace(",", ".").replace(/[^0-9.]/g, ""))} aria-label={label} />
      <button onClick={() => set(Number(value || 0) + step)} aria-label={`Sumar ${step}`}><Plus /></button>
    </div>
  </div>;
}

function ExerciseMedia({ media, lookup, name, search, onRetry }) {
  const gif = media?.gif || (lookup?.status === "loaded" ? lookup.gif : null);
  const youtube = media?.youtube || null;
  const [mode, setMode] = useState("gif");
  const [playing, setPlaying] = useState(false);
  const shown = mode === "video" && youtube ? "video" : gif ? "gif" : youtube ? "video" : null;
  const loading = !media && (!lookup || lookup.status === "loading");
  return <div className="media">
    <div className="media-frame">
      {shown === "gif" && <img src={gif} alt={`Técnica de ${name}`} onError={media ? undefined : onRetry} />}
      {shown === "video" && (playing
        ? <iframe src={`https://www.youtube-nocookie.com/embed/${youtube}?autoplay=1&playsinline=1&rel=0&modestbranding=1`} title={`Video de técnica: ${name}`} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen />
        : <button className="video-poster" onClick={() => setPlaying(true)} aria-label={`Reproducir video de ${name}`}><img src={`https://i.ytimg.com/vi/${youtube}/hqdefault.jpg`} alt="" /><span><Play /></span></button>)}
      {!shown && (loading
        ? <div className="media-empty"><LoaderCircle className="spin" /> Buscando animación…</div>
        : <div className="media-empty"><span>Sin animación para este ejercicio.</span><button onClick={onRetry}><RotateCcw /> Reintentar</button><a href={`https://www.youtube.com/results?search_query=${encodeURIComponent(`${name} técnica`)}`} target="_blank" rel="noopener noreferrer"><Video /> Buscar en YouTube</a></div>)}
    </div>
    {gif && youtube && <div className="media-tabs" role="tablist">
      <button role="tab" aria-selected={shown === "gif"} className={shown === "gif" ? "active" : ""} onClick={() => setMode("gif")}><ImageIcon /> Animación</button>
      <button role="tab" aria-selected={shown === "video"} className={shown === "video" ? "active" : ""} onClick={() => setMode("video")}><Video /> Video</button>
    </div>}
    {!media && search && gif && <small className="media-credit">Coincidencia automática del catálogo</small>}
  </div>;
}

function Thumb({ media, lookup, name }) {
  const gif = media?.gif || (lookup?.status === "loaded" ? lookup.gif : null);
  if (gif) return <span className="thumb"><img src={gif} alt="" loading="lazy" /></span>;
  if (media?.youtube) return <span className="thumb video"><img src={`https://i.ytimg.com/vi/${media.youtube}/mqdefault.jpg`} alt="" loading="lazy" /><Play /></span>;
  return <span className="thumb empty" aria-label={`Sin vista previa de ${name}`}>{lookup?.status === "loading" ? <LoaderCircle className="spin" /> : <Dumbbell />}</span>;
}

function RestTimer({ timer, left, sound, onSound, onShift, onToggle, onClose }) {
  const pct = timer.total ? Math.min(100, (left / timer.total) * 100) : 0;
  return <div className={`rest-timer ${left === 0 ? "finished" : left <= 10 ? "urgent" : ""}`} role="timer" aria-live="polite">
    <div className="rest-bar"><i style={{ width: `${pct}%` }} /></div>
    <div className="rest-main">
      <div className="rest-copy"><small>{left === 0 ? "¡A por la siguiente!" : "Descanso"}</small><strong>{left === 0 ? "¡Ya!" : formatTime(left)}</strong><span>{timer.label}</span></div>
      <button className="round" onClick={onToggle} aria-label={timer.paused ? "Reanudar" : "Pausar"}>{timer.paused ? <Play /> : <Pause />}</button>
    </div>
    <div className="rest-actions">
      <button onClick={() => onShift(-15)}>−15 s</button>
      <button onClick={() => onShift(15)}>+15 s</button>
      <button onClick={onSound} aria-label={sound ? "Silenciar aviso" : "Activar sonido"}>{sound ? <Volume2 /> : <VolumeX />}</button>
      <button onClick={onClose}><X /> Saltar</button>
    </div>
  </div>;
}

function RestDayView({ kind, plan, phase, today, progress, nextPending, onOpen, onCardio }) {
  const cardioDone = Number(progress.cardio?.[today] || 0) > 0;
  const minutes = phase?.cardioMinutes || 30;
  return <div className="view-enter">
    {kind === "cardio" ? <>
      <div className="session-head"><div><span className="eyebrow">Cardio sostenible · movilidad</span><h1>Cardio</h1></div></div>
      <div className="cardio-hero"><Footprints /><strong>{minutes}<small> min</small></strong><span>Caminata rápida, bici o elíptica</span></div>
      <p className="phase-text">{phase?.cardio || plan.cardio?.liss || plan.week?.filter((item) => item.type === "cardio").map((item) => `${item.label}: ${item.activity}`).join(" · ")}</p>
      <button className={`done-button big ${cardioDone ? "is-done" : ""}`} onClick={() => onCardio(minutes)}><Check /> {cardioDone ? "Cardio hecho · deshacer" : `Marcar ${minutes} min hechos`}</button>
      {phase?.steps && <InfoCard icon={<Footprints />} title={`Pasos: ${perDay(phase.steps)}`} text="Más constancia que récords. Ajusta si afecta la recuperación." />}
      {plan.cardio?.hiit && <InfoCard icon={<Flame />} title="Sin HIIT obligatorio" text={plan.cardio.hiit} />}
    </> : <>
      <div className="session-head"><div><span className="eyebrow">Recuperación</span><h1>Descanso</h1></div></div>
      <InfoCard icon={<Moon />} title="Dormir antes de sumar entreno" text="Apunta a 7–9 h con horario regular. Si falta tiempo, recorta cardio opcional antes que sueño." />
    </>}
    {nextPending && <button className="next-pending" onClick={() => onOpen(nextPending.id)}><span><small>¿Te saltaste una sesión? Siguiente pendiente</small><b>{nextPending.title}</b></span><ChevronRight /></button>}
  </div>;
}

function WeekView({ plan, week, phase, today, progress, settings, done, onOpen, onWeek, onCheckin, onSettings, onPlan }) {
  const imported = plan.source === "import";
  const dayById = Object.fromEntries((plan.blocks?.[plan.activeBlock]?.days || []).map((day) => [day.id, day]));
  const todayIndex = (new Date().getDay() + 6) % 7;
  const checkin = progress.checkins?.[today] || {};
  const avgWeight = averageWeight(progress.checkins, today);
  const guide = PLAN_GUIDE;
  return <div className="view-enter">
    <div className="session-head"><div><span className="eyebrow">{imported ? `Importado · ${plan.totalWeeks || 8} semanas` : "Plan de 8 semanas"}</span><h1>{imported ? plan.name : "Tu plan"}</h1></div></div>
    <article className="phase-card">
      <div className="week-stepper">
        <button onClick={() => onWeek(Math.max(1, week - 1))} aria-label="Semana anterior" disabled={week <= 1}><ChevronLeft /></button>
        <div><small>Semana</small><b>{week}<span>/{plan.totalWeeks || 8}</span></b></div>
        <button onClick={() => onWeek(Math.min(plan.totalWeeks || 8, week + 1))} aria-label="Semana siguiente" disabled={week >= (plan.totalWeeks || 8)}><ChevronRight /></button>
      </div>
      <div className="phase-body"><b>{phase?.title}</b>{phase?.rir && <span className="rir-tag">{phase.rir}</span>}{phase?.detail && <p>{phase.detail}</p>}{phase?.steps && <p><Footprints /> Pasos: {perDay(phase.steps)}</p>}</div>
    </article>

    <div className="week-list">{plan.week.map((item, index) => {
      const isDone = item.dayId ? done.has(item.dayId) : false;
      return <button key={item.id} className={`week-row ${index === todayIndex ? "today" : ""} ${item.type || "training"} ${isDone ? "done" : ""}`} onClick={() => onOpen(item.dayId || (item.type === "cardio" ? "cardio" : "rest"))}>
        <span className="week-day">{item.label.slice(0, 3)}{index === todayIndex && <em>hoy</em>}</span>
        <span><b>{item.activity}</b><small>{item.dayId ? `Pesas${dayById[item.dayId]?.duration ? ` · ${dayById[item.dayId].duration}` : ""}` : item.type === "rest" ? "Recuperación" : `Cardio · ${phase?.cardioMinutes || 30} min`}</small></span>
        {isDone ? <Check className="row-check" /> : <ChevronRight />}
      </button>;
    })}</div>

    <h2 className="section-label">Registro de hoy</h2>
    <div className="checkin">
      <label><span>Peso ({settings.unit}) · en ayunas</span><input inputMode="decimal" placeholder="—" value={checkin.weight ?? ""} onChange={(event) => onCheckin({ weight: event.target.value.replace(",", ".") })} /></label>
      <label><span>Cintura (cm) · 1×/sem</span><input inputMode="decimal" placeholder="—" value={checkin.waist ?? ""} onChange={(event) => onCheckin({ waist: event.target.value.replace(",", ".") })} /></label>
      <label><span>Pasos de hoy</span><input inputMode="numeric" placeholder={phase?.steps || "—"} value={checkin.steps ?? ""} onChange={(event) => onCheckin({ steps: event.target.value.replace(/\D/g, "") })} /></label>
      <label><span>Sueño (h)</span><input inputMode="decimal" placeholder="7–9" value={checkin.sleepHours ?? ""} onChange={(event) => onCheckin({ sleepHours: event.target.value.replace(",", ".") })} /></label>
      <div className="scale"><span>Sueño y fatiga (1 mal – 5 genial)</span><div>{[1, 2, 3, 4, 5].map((value) => <button key={value} className={Number(checkin.sleep) === value ? "active" : ""} onClick={() => onCheckin({ sleep: value })}>{value}</button>)}</div></div>
      {avgWeight && <p className="avg">Media 7 días: <b>{fmtNum(avgWeight.value)} {settings.unit}</b> ({avgWeight.count} registros)</p>}
    </div>

    {imported ? <>
      {!!plan.notes?.length && <><h2 className="section-label">Reglas del plan</h2><div className="guide">{plan.notes.map((item, index) => <Guide key={index} title={item.title}><p>{item.text}</p></Guide>)}</div></>}
      {plan.phases?.some((item) => item.detail || item.cardio) && <><h2 className="section-label">Fases</h2><div className="guide"><Guide title="Semana a semana">{plan.phases.map((item) => <p key={item.from}><b>Semanas {item.from === item.to ? item.from : `${item.from}–${item.to}`}{item.title ? ` · ${item.title}` : ""}:</b> {[item.rir, item.detail, item.cardio].filter(Boolean).join(" ")}</p>)}</Guide></div></>}
    </> : <>
    <h2 className="section-label">Reglas del plan</h2>
    <div className="guide">{guide.rules.map((item) => <Guide key={item.title} title={item.title}><p>{item.text}</p></Guide>)}</div>

    <h2 className="section-label">Cardio, sueño y seguimiento</h2>
    <div className="guide">
      <Guide title="Cardio por fases">{plan.phases.map((item) => <p key={item.from}><b>Semanas {item.from === item.to ? item.from : `${item.from}–${item.to}`}:</b> {item.cardio} Pasos {item.steps}.</p>)}<p>No necesitas cardio intenso ni HIIT para definir; el objetivo de 150 min/semana sigue la recomendación del CDC.</p></Guide>
      {guide.recovery.map((item) => <Guide key={item.title} title={item.title}><p>{item.text}</p></Guide>)}
      <Guide title="Revisión semanal: 5 datos"><table className="guide-table"><thead><tr><th>Métrica</th><th>Frecuencia</th><th>Qué buscas</th></tr></thead><tbody>{guide.tracking.map((row) => <tr key={row.metric}><td>{row.metric}</td><td>{row.when}</td><td>{row.look}</td></tr>)}</tbody></table></Guide>
      <Guide title="Cómo saber si funciona"><p>{guide.success}</p></Guide>
    </div>

    {!plan.sample && <h2 className="section-label">Tu punto de partida</h2>}
    <div className="guide">
      {!plan.sample && <Guide title="Datos tenidos en cuenta"><div className="stat-row">{guide.profile.stats.map((item) => <div key={item.label}><b>{item.value}</b><span>{item.label}</span></div>)}</div><p>{guide.profile.goal}</p><p className="muted">{guide.profile.source}</p><p className="warn">{guide.profile.pending}</p></Guide>}
      <Guide title="Evidencia consultada">{guide.evidence.map((item) => <p key={item.url}><b>{item.title}.</b> {item.text} <a href={item.url} target="_blank" rel="noopener noreferrer">Fuente</a></p>)}</Guide>
      <p className="disclaimer">{guide.profile.medical}</p>
    </div>
    </>}

    <h2 className="section-label">Cambiar de plan</h2>
    <PlanImport plan={plan} onPlan={onPlan} />

    <h2 className="section-label">Ajustes</h2>
    <div className="settings-row">
      <div className="segmented">{["lb", "kg"].map((unit) => <button key={unit} className={settings.unit === unit ? "active" : ""} onClick={() => onSettings({ unit })}>{unit}</button>)}</div>
      <button className={`toggle ${settings.sound ? "active" : ""}`} onClick={() => onSettings({ sound: !settings.sound })}>{settings.sound ? <Volume2 /> : <VolumeX />} Sonido al terminar descanso</button>
    </div>
  </div>;
}

function FoodView({ nutrition, progress, setProgress, imported }) {
  const date = localDate();
  const log = progress.foodLogs?.[date] || [];
  const [manual, setManual] = useState({ name: "", protein: "", calories: "" });
  const totals = log.reduce((sum, item) => ({ protein: sum.protein + Number(item.protein || 0), calories: sum.calories + Number(item.calories || 0) }), { protein: 0, calories: 0 });
  const guide = PLAN_GUIDE.nutrition;
  function changeLog(next) { setProgress((current) => ({ ...current, foodLogs: { ...current.foodLogs, [date]: next } })); }
  function add(item) { changeLog([...log, { ...item, logId: `${Date.now()}-${Math.random()}` }]); }
  return <div className="view-enter">
    <div className="session-head"><div><span className="eyebrow">Definición · hoy</span><h1>Comida</h1></div></div>
    <div className="nutrition-dashboard"><Metric label="Proteína" value={totals.protein} target={nutrition.proteinTarget} unit="g" color="green" /><Metric label="Calorías" value={totals.calories} target={nutrition.calorieTarget} unit="kcal" color="orange" />{nutrition.note && <p>{nutrition.note}</p>}</div>
    <h2 className="section-label">Añadir rápido</h2>
    <div className="food-grid">{nutrition.foods.map((food) => <button key={food.id} onClick={() => add(food)}><Plus /><b>{food.name}</b><span>{food.protein} g · {food.calories} kcal</span></button>)}</div>
    <div className="manual-food"><h3>Otro alimento</h3><input placeholder="Nombre" value={manual.name} onChange={(event) => setManual({ ...manual, name: event.target.value })} /><div><input inputMode="numeric" placeholder="Proteína g" value={manual.protein} onChange={(event) => setManual({ ...manual, protein: event.target.value })} /><input inputMode="numeric" placeholder="Calorías" value={manual.calories} onChange={(event) => setManual({ ...manual, calories: event.target.value })} /></div><button onClick={() => { if (manual.protein || manual.calories) { add({ name: manual.name || "Alimento", protein: manual.protein, calories: manual.calories }); setManual({ name: "", protein: "", calories: "" }); } }}><Plus /> Añadir</button></div>
    <div className="food-log"><h2 className="section-label">Consumido hoy</h2>{!log.length && <p className="empty-state">Todavía no has registrado comida.</p>}{log.map((item) => <div key={item.logId}><span><b>{item.name}</b><small>{item.protein} g proteína · {item.calories} kcal</small></span><button onClick={() => changeLog(log.filter((row) => row.logId !== item.logId))} aria-label={`Quitar ${item.name}`}><Trash2 /></button></div>)}</div>
    {!imported && <><h2 className="section-label">Guía del plan</h2>
    <div className="guide">
      <Guide title="Prioridades diarias" open><table className="guide-table"><tbody>{guide.macros.map((row) => <tr key={row.label}><td><b>{row.label}</b></td><td>{row.value}</td><td>{row.note}</td></tr>)}</tbody></table><p className="muted">{guide.example}</p></Guide>
      <Guide title="Un día simple">{guide.meals.map((meal) => <p key={meal.label}><b>{meal.label}:</b> {meal.text}</p>)}</Guide>
      <Guide title="Revisión cada dos semanas"><p>{guide.review}</p></Guide>
      <Guide title="Creatina (opcional)"><p>{guide.creatine}</p></Guide>
    </div></>}
  </div>;
}

function ProgressView({ plan, progress, settings, week }) {
  const [selected, setSelected] = useState(null);
  const days = plan.blocks?.[plan.activeBlock]?.days || [];
  const log = progress.log || {};
  const totalWeeks = plan.totalWeeks || 8;
  const sessions = useMemo(() => Object.keys(log).sort().reverse().flatMap((date) => days.map((day) => {
    const sets = day.exercises.reduce((sum, exercise) => sum + (log[date]?.[exercise.id] || []).filter((row) => row?.done).length, 0);
    return sets ? { date, day, sets, minutes: sessionMinutes(day, log[date]), note: progress.notes?.[date]?.[day.id] } : null;
  }).filter(Boolean)), [log, days, progress.notes]);
  const grid = Array.from({ length: totalWeeks }, (_, index) => {
    const [from, to] = weekRange(plan, index + 1);
    const done = completedSessions(plan, log, index + 1);
    const cardio = Object.entries(progress.cardio || {}).filter(([date, minutes]) => date >= from && date < to && Number(minutes) > 0).length;
    return { week: index + 1, done, cardio };
  });
  const cardioPerWeek = (plan.week || []).filter((item) => item.type === "cardio").length;
  const doneTotal = grid.reduce((sum, item) => sum + item.done.size, 0);
  const setTotal = sessions.reduce((sum, item) => sum + item.sets, 0);
  const checkins = Object.entries(progress.checkins || {}).sort(([a], [b]) => a.localeCompare(b));
  const weightSeries = checkins.filter(([, item]) => Number(item?.weight) > 0).map(([date, item]) => ({ label: shortDate(date), value: Number(item.weight) }));
  const waistSeries = checkins.filter(([, item]) => Number(item?.waist) > 0).map(([date, item]) => ({ label: shortDate(date), value: Number(item.waist) }));

  if (selected) {
    const day = days.find((item) => item.exercises.some((exercise) => exercise.id === selected));
    const exercise = day?.exercises.find((item) => item.id === selected);
    if (exercise) return <ExerciseHistory exercise={exercise} day={day} log={log} unit={settings.unit} onBack={() => setSelected(null)} />;
  }

  return <div className="view-enter">
    <div className="session-head"><div><span className="eyebrow">Historial · 8 semanas</span><h1>Progreso</h1></div></div>
    <div className="stat-tiles">
      <div><b>{doneTotal}<small>/{totalWeeks * days.length}</small></b><span>Sesiones de pesas</span></div>
      <div><b>{setTotal}</b><span>Series registradas</span></div>
      <div><b>{grid[week - 1]?.done.size || 0}<small>/{days.length}</small></b><span>Esta semana</span></div>
    </div>

    <h2 className="section-label">Constancia por semana</h2>
    <div className="adherence">
      <div className="adherence-head"><span>Sem</span>{days.map((day) => <span key={day.id}>{day.title.replace("Piernas", "Pier.")}</span>)}<span>Cardio</span></div>
      {grid.map((row) => <div key={row.week} className={`adherence-row ${row.week === week ? "current" : ""}`}>
        <b>{row.week}</b>
        {days.map((day) => <i key={day.id} className={row.done.has(day.id) ? "on" : ""} aria-label={`Semana ${row.week}, ${day.title}: ${row.done.has(day.id) ? "hecha" : "pendiente"}`}>{row.done.has(day.id) && <Check />}</i>)}
        <em>{row.cardio}/{cardioPerWeek}</em>
      </div>)}
    </div>

    <h2 className="section-label">Peso y cintura</h2>
    <div className="chart-card">
      <LineChart title={`Peso (${settings.unit})`} points={weightSeries} unit={settings.unit} empty="Registra tu peso por la mañana en la pestaña Plan (3–5 días por semana)." />
      <LineChart title="Cintura (cm)" points={waistSeries} unit="cm" empty="Mide la cintura una vez por semana, a la misma altura." />
    </div>

    <h2 className="section-label">Ejercicios</h2>
    {days.map((day) => <div key={day.id} className="history-group">
      <h3>{day.title}</h3>
      {day.exercises.map((exercise) => {
        const history = exerciseHistory(exercise, log);
        const last = history[history.length - 1];
        const timed = isTimed(exercise.reps);
        return <button key={exercise.id} className="history-row" onClick={() => { setSelected(exercise.id); window.scrollTo({ top: 0 }); }}>
          <span><b>{exercise.alternatives[0].name}</b><small>{last ? `${shortDate(last.date)} · ${last.rows.map((row) => timed ? `${row.r}s` : `${fmtNum(row.w)}×${row.r}`).join(" · ")}` : "Sin registros todavía"}</small></span>
          {history.length > 1 ? <Sparkline values={history.map((item) => item.top)} /> : <span className="spark-empty">{history.length ? "1 sesión" : "—"}</span>}
          <ChevronRight />
        </button>;
      })}
    </div>)}

    <h2 className="section-label">Sesiones</h2>
    {!sessions.length && <p className="empty-state">Cuando marques series, cada sesión aparecerá aquí con su fecha, duración y notas.</p>}
    <div className="session-log">{sessions.map((item) => <article key={`${item.date}-${item.day.id}`}>
      <div><b>{item.day.title}</b><span>{longDate(item.date)}</span></div>
      <p>{item.sets} series{item.minutes !== null ? ` · ${item.minutes} min` : ""}</p>
      {item.note && <p className="muted">“{item.note}”</p>}
    </article>)}</div>
  </div>;
}

function ExerciseHistory({ exercise, day, log, unit, onBack }) {
  const history = exerciseHistory(exercise, log);
  const timed = isTimed(exercise.reps);
  const best = history.reduce((top, item) => (item.best && (!top || item.best.e1rm > top.e1rm) ? { ...item.best, date: item.date } : top), null);
  const names = Object.fromEntries(exercise.alternatives.map((item) => [item.search, item.name]));
  return <div className="view-enter">
    <button className="back-button" onClick={onBack}><ChevronLeft /> Progreso</button>
    <div className="session-head"><div><span className="eyebrow">{day.title} · {exercise.sets} × {exercise.reps}</span><h1 className="small">{exercise.alternatives[0].name}</h1></div></div>
    {!history.length && <p className="empty-state">Todavía no hay series registradas de este ejercicio.</p>}
    {!!history.length && <>
      <div className="stat-tiles">
        <div><b>{history.length}</b><span>Sesiones</span></div>
        <div><b>{timed ? `${history[history.length - 1].top}s` : fmtNum(history[history.length - 1].top)}<small>{timed ? "" : ` ${unit}`}</small></b><span>Última carga</span></div>
        {!timed && best && <div><b>{fmtNum(best.w)}×{best.r}</b><span><Trophy /> Mejor serie</span></div>}
      </div>
      <div className="chart-card"><LineChart title={timed ? "Mejor tiempo (s)" : `Carga más alta por sesión (${unit})`} points={history.map((item) => ({ label: shortDate(item.date), value: item.top }))} unit={timed ? "s" : unit} empty="Hace falta más de una sesión para ver la tendencia." /></div>
      <h2 className="section-label">Todas las sesiones</h2>
      <div className="session-log">{[...history].reverse().map((item) => <article key={item.date}>
        <div><b>{longDate(item.date)}</b>{item.variant && names[item.variant] && names[item.variant] !== exercise.alternatives[0].name && <span>{names[item.variant]}</span>}</div>
        <ol className="set-list">{item.rows.map((row, index) => <li key={index}><span>S{index + 1}</span><b>{timed ? `${row.r} s` : `${fmtNum(row.w)} ${unit} × ${row.r}`}</b>{row.rir !== undefined && row.rir !== null && <em>RIR {row.rir}</em>}</li>)}</ol>
      </article>)}</div>
    </>}
  </div>;
}

function LineChart({ title, points, unit, empty }) {
  const [active, setActive] = useState(null);
  const width = 320; const height = 120; const pad = { top: 18, right: 12, bottom: 22, left: 12 };
  if (points.length < 2) return <div className="line-chart"><h3>{title}</h3><p className="empty-inline">{points.length === 1 ? `Un registro: ${fmtNum(points[0].value)} ${unit}. ` : ""}{empty}</p></div>;
  const values = points.map((item) => item.value);
  const min = Math.min(...values); const max = Math.max(...values); const span = max - min || 1;
  const x = (index) => pad.left + (index / (points.length - 1)) * (width - pad.left - pad.right);
  const y = (value) => pad.top + (1 - (value - min) / span) * (height - pad.top - pad.bottom);
  const path = points.map((item, index) => `${index ? "L" : "M"}${x(index).toFixed(1)},${y(item.value).toFixed(1)}`).join(" ");
  const shown = active ?? points.length - 1;
  const change = values[values.length - 1] - values[0];
  function pick(event) {
    const box = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - box.left) / box.width;
    setActive(Math.max(0, Math.min(points.length - 1, Math.round(((ratio * width - pad.left) / (width - pad.left - pad.right)) * (points.length - 1)))));
  }
  return <div className="line-chart">
    <h3>{title} <span className={change < 0 ? "down" : change > 0 ? "up" : ""}>{change > 0 ? "+" : ""}{fmtNum(change)} {unit} desde el inicio</span></h3>
    <div className="readout"><b>{fmtNum(points[shown].value)} {unit}</b><span>{points[shown].label}</span></div>
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${title}: de ${fmtNum(values[0])} a ${fmtNum(values[values.length - 1])} ${unit}`} onPointerMove={pick} onPointerDown={pick} onPointerLeave={() => setActive(null)}>
      <line className="grid" x1={pad.left} x2={width - pad.right} y1={y(max)} y2={y(max)} />
      <line className="grid" x1={pad.left} x2={width - pad.right} y1={y(min)} y2={y(min)} />
      <text className="axis" x={width - pad.right} y={y(max) - 5} textAnchor="end">{fmtNum(max)}</text>
      <text className="axis" x={width - pad.right} y={y(min) + 14} textAnchor="end">{fmtNum(min)}</text>
      <line className="crosshair" x1={x(shown)} x2={x(shown)} y1={pad.top - 6} y2={height - pad.bottom} />
      <path className="series" d={path} />
      {points.map((item, index) => <circle key={index} className={index === shown ? "dot active" : "dot"} cx={x(index)} cy={y(item.value)} r={index === shown ? 5 : 3}><title>{`${item.label}: ${fmtNum(item.value)} ${unit}`}</title></circle>)}
      <text className="axis" x={pad.left} y={height - 4}>{points[0].label}</text>
      <text className="axis" x={width - pad.right} y={height - 4} textAnchor="end">{points[points.length - 1].label}</text>
    </svg>
  </div>;
}

function Sparkline({ values }) {
  const width = 72; const height = 28;
  const min = Math.min(...values); const max = Math.max(...values); const span = max - min || 1;
  const points = values.map((value, index) => `${(index / (values.length - 1)) * (width - 6) + 3},${(1 - (value - min) / span) * (height - 6) + 3}`).join(" ");
  const last = points.split(" ").pop().split(",");
  return <svg className="sparkline" viewBox={`0 0 ${width} ${height}`} aria-hidden="true"><polyline points={points} /><circle cx={last[0]} cy={last[1]} r="3" /></svg>;
}

function PlanImport({ plan, onPlan, compact }) {
  const [state, setState] = useState({ step: "idle", error: "", draft: null, name: "" });
  const inputRef = useRef(null);
  const imported = plan.source === "import";

  async function upload(file) {
    if (!file) return;
    if (file.type && file.type !== "application/pdf") return setState({ step: "idle", error: "Elige un archivo PDF.", draft: null, name: "" });
    if (file.size > 6 * 1024 * 1024) return setState({ step: "idle", error: "El PDF pesa demasiado (máximo 6 MB).", draft: null, name: "" });
    setState({ step: "loading", error: "", draft: null, name: file.name });
    try {
      const { plan: draft } = await api.importPlanPdf(file);
      setState({ step: "preview", error: "", draft, name: file.name });
    } catch (error) {
      setState({ step: "idle", error: error.message, draft: null, name: "" });
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }
  async function apply(next, summary) {
    setState((current) => ({ ...current, step: "saving", error: "" }));
    try {
      const monday = new Date(); monday.setDate(monday.getDate() - (monday.getDay() + 6) % 7);
      const ready = { ...next, sample: plan.sample, version: PLAN_VERSION, startDate: localDate(monday), ...(next.source === "import" ? { importedFrom: state.name.slice(0, 80) } : {}) };
      const { plan: saved } = await api.applyPlan(ready, summary);
      onPlan(saved);
      setState({ step: "done", error: "", draft: null, name: "" });
    } catch (error) {
      setState((current) => ({ ...current, step: current.draft ? "preview" : "idle", error: error.message }));
    }
  }

  const draft = state.draft;
  return <div className={`plan-import ${compact ? "compact" : ""}`}>
    {state.step !== "preview" && <>
      {!compact && <p className="muted">Sube el PDF de tu rutina y la IA lo convierte en un plan semanal: días, ejercicios, series, reps y descansos tal como vienen en el documento. Antes de guardarlo verás una vista previa.</p>}
      <input ref={inputRef} type="file" accept="application/pdf,.pdf" hidden onChange={(event) => upload(event.target.files?.[0])} />
      <button className="import-button" disabled={state.step === "loading" || state.step === "saving"} onClick={() => inputRef.current?.click()}>
        {state.step === "loading" ? <><LoaderCircle className="spin" /> Leyendo “{state.name}”… (hasta 1 min)</> : <><FileUp /> Subir PDF de ejercicios</>}
      </button>
      {state.step === "done" && <p className="import-ok"><Check /> Plan guardado. Ya lo tienes en Entreno. Si no te convence, el Coach puede deshacer el cambio.</p>}
      {imported && !compact && <button className="swap-button" disabled={state.step === "saving"} onClick={() => { if (window.confirm("¿Volver al plan de definición de 8 semanas?")) apply(DEFAULT_PLAN, "Vuelta al plan de definición de 8 semanas"); }}><RotateCcw /> Volver al plan de definición original</button>}
    </>}
    {state.error && <p className="auth-error">{state.error}</p>}
    {draft && (state.step === "preview" || state.step === "saving") && <div className="import-preview">
      <div className="import-head"><b>{draft.name}</b><span>{draft.blocks.A.days.length} sesiones · {draft.totalWeeks} semanas</span>{draft.subtitle && <p>{draft.subtitle}</p>}</div>
      <ol className="import-week">{draft.week.map((item) => <li key={item.id} className={item.type || "training"}><span>{item.label.slice(0, 3)}</span>{item.activity}</li>)}</ol>
      {draft.blocks.A.days.map((day) => <details key={day.id} className="guide-item" open={day.id === "d1"}>
        <summary><Dumbbell /> {day.title} · {day.exercises.length} ejercicios<ChevronDown className="chevron" /></summary>
        <div><table className="guide-table"><tbody>{day.exercises.map((exercise) => <tr key={exercise.id}><td><b>{exercise.alternatives[0].name}</b>{exercise.alternatives.length > 1 && <small className="alt-list"> · alt: {exercise.alternatives.slice(1).map((item) => item.name).join(", ")}</small>}</td><td>{exercise.sets} × {exercise.reps}</td><td>{formatTime(exercise.rest)}</td></tr>)}</tbody></table></div>
      </details>)}
      <p className="muted">Revisa que los ejercicios y números coinciden con tu PDF. Las animaciones se buscarán automáticamente; si alguna no coincide, tendrás un enlace a YouTube.</p>
      <div className="import-actions">
        <button className="done-button" disabled={state.step === "saving"} onClick={() => apply(draft, `Plan importado desde PDF: ${draft.name}`)}>{state.step === "saving" ? <LoaderCircle className="spin" /> : <Check />}<span>Usar este plan</span></button>
        <button className="swap-button" disabled={state.step === "saving"} onClick={() => setState({ step: "idle", error: "", draft: null, name: "" })}><X /> Descartar</button>
      </div>
    </div>}
  </div>;
}

function Guide({ title, children, open }) { return <details className="guide-item" open={open}><summary><BookOpen /> {title}<ChevronDown className="chevron" /></summary><div>{children}</div></details>; }

function CoachSheet({ user, plan, onPlan, onClose }) {
  const [data, setData] = useState({ messages: [], memories: [], changes: [] });
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const listRef = useRef(null);
  useEffect(() => { api.getChat().then(setData).catch((err) => setError(err.message)); }, []);
  useEffect(() => {
    const feed = listRef.current;
    if (!feed) return;
    if (typeof feed.scrollTo === "function") feed.scrollTo({ top: feed.scrollHeight, behavior: "smooth" });
    else feed.scrollTop = feed.scrollHeight;
  }, [data.messages, busy]);
  async function send(text = message) {
    const clean = text.trim(); if (!clean || busy) return;
    setBusy(true); setError(""); setMessage(""); setData((current) => ({ ...current, messages: [...current.messages, { role: "user", content: clean }] }));
    try {
      await api.savePlan(plan);
      const response = await api.sendChat(clean);
      onPlan(response.plan);
      setData((current) => ({ ...current, messages: [...current.messages, { role: "assistant", content: response.reply }], changes: response.changed ? [{ id: Date.now(), summary: response.summary || "Plan actualizado" }, ...current.changes] : current.changes }));
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  async function undo() {
    try { const response = await api.undoPlanChange(); onPlan(response.plan); setData((current) => ({ ...current, changes: current.changes.slice(1), messages: [...current.messages, { role: "assistant", content: `Deshice: ${response.undone}` }] })); } catch (err) { setError(err.message); }
  }
  return <div className="sheet-backdrop" onClick={onClose}><section className="coach-sheet" onClick={(event) => event.stopPropagation()}><header><div className="coach-avatar"><Bot /></div><div><b>Plan Coach</b><span>{user.emailVerified ? "Con memoria privada" : "Verifica tu email para conversar"}</span></div><button onClick={onClose} aria-label="Cerrar"><X /></button></header><div className="chat-feed" ref={listRef}>{!data.messages.length && <div className="coach-welcome"><Sparkles /><h3>Habla con tu plan.</h3><p>Pídeme mover un día, cambiar un ejercicio o adaptar el volumen. Cada cambio queda registrado y se puede deshacer.</p></div>}{data.messages.map((item, index) => <div key={`${item.id || index}-${item.role}`} className={`bubble ${item.role}`}>{item.content}</div>)}{busy && <div className="bubble assistant thinking"><i /><i /><i /></div>}{error && <div className="chat-error">{error}</div>}</div>{!data.messages.length && <div className="quick-prompts"><button onClick={() => send("Hoy no puedo entrenar, ¿qué hago con la sesión que me toca?")}>Me salté un día</button><button onClick={() => send("La máquina Smith está ocupada, ¿qué alternativa uso hoy?")}>Smith ocupada</button><button onClick={() => send("Recuerda que prefiero entrenar por la mañana")}>Guardar preferencia</button></div>}{!!data.changes.length && <div className="undo-bar"><span><History /> {data.changes[0].summary}</span><button onClick={undo}><RotateCcw /> Deshacer</button></div>}<form className="composer" onSubmit={(event) => { event.preventDefault(); send(); }}><textarea maxLength={1600} rows="1" placeholder="Ej. Mueve Piernas B al sábado…" value={message} onChange={(event) => setMessage(event.target.value)} disabled={busy || !user.emailVerified} /><button type="submit" disabled={busy || !message.trim() || !user.emailVerified} aria-label="Enviar"><Send /></button></form></section></div>;
}

function InfoCard({ icon, title, text }) { return <article className="info-card">{icon}<div><h3>{title}</h3><p>{text}</p></div></article>; }
function Metric({ label, value, target, unit, color }) { return <div className="metric"><div><span>{label}</span><strong>{value}<small> / {target} {unit}</small></strong></div><div className="metric-track"><i className={color} style={{ width: `${Math.min(100, value / target * 100)}%` }} /></div></div>; }
function NavButton({ active, icon, label, onClick, accent }) { return <button className={`${active ? "active" : ""} ${accent ? "accent" : ""}`} onClick={onClick}>{React.cloneElement(icon, { size: 24 })}<span>{label}</span></button>; }
function currentAlternative(exercise, alternatives = {}) { const index = alternatives?.[exercise.id] || 0; return exercise.alternatives[index % exercise.alternatives.length]; }

function programWeek(plan, today) {
  const start = new Date(`${plan.startDate || today}T12:00:00`);
  const now = new Date(`${today}T12:00:00`);
  const week = Math.floor((now - start) / (7 * 86_400_000)) + 1;
  return Math.min(plan.totalWeeks || 8, Math.max(1, week));
}
function weekRange(plan, week) {
  const start = new Date(`${plan.startDate}T12:00:00`);
  start.setDate(start.getDate() + (week - 1) * 7);
  const end = new Date(start); end.setDate(end.getDate() + 7);
  return [localDate(start), localDate(end)];
}
function completedSessions(plan, log = {}, week) {
  const [from, to] = weekRange(plan, week);
  const done = new Set();
  for (const day of plan.blocks?.[plan.activeBlock]?.days || []) {
    const ids = day.exercises.map((exercise) => exercise.id);
    const hit = Object.entries(log).some(([date, entries]) => date >= from && date < to && ids.some((id) => (entries?.[id] || []).some((row) => row?.done)));
    if (hit) done.add(day.id);
  }
  return done;
}
function targetSets(exercise, phase, fatigue) {
  const sets = Number(exercise.sets) || 1;
  if (phase?.deload) return Math.max(1, Math.round(sets * 0.6));
  if (fatigue === "yellow" && !exercise.main) return Math.max(1, sets - 1);
  return sets;
}
function lastSession(log = {}, exerciseId, before) {
  const date = Object.keys(log).filter((key) => key < before && (log[key]?.[exerciseId] || []).some((row) => row?.done)).sort().pop();
  return date ? { date, rows: log[date][exerciseId] } : null;
}
function repRange(reps) { const numbers = String(reps).match(/\d+/g)?.map(Number) || [10]; return { low: numbers[0], high: numbers[1] || numbers[0] }; }
function isTimed(reps) { return /\d\s*s\b/.test(String(reps)); }
function progressionHint(exercise, previous, unit) {
  if (!previous || isTimed(exercise.reps)) return null;
  const done = previous.rows.filter((row) => row?.done);
  const { high } = repRange(exercise.reps);
  if (done.length < Number(exercise.sets) || !done.every((row) => Number(row.r) >= high && Number(row.w) > 0)) return null;
  const top = Math.max(...done.map((row) => Number(row.w)));
  // PDF: el menor incremento disponible, ≈2–5 % en torso y 2–10 % en piernas.
  const step = unit === "kg" ? 2.5 : 5;
  const legs = /^d[24]-/.test(exercise.id);
  const increment = Math.max(step, Math.round((top * (legs ? 0.05 : 0.025)) / step) * step);
  return { weight: top + increment };
}
function suggestSet(exercise, rows, setIndex, previous, hint) {
  const { low } = repRange(exercise.reps);
  const before = rows.slice(0, setIndex).reverse().find((row) => row?.done);
  if (before) return { w: before.w, r: before.r };
  if (hint) return { w: hint.weight, r: low };
  const last = previous?.rows?.[setIndex] || previous?.rows?.filter((row) => row?.done).pop();
  return { w: last?.w ?? 0, r: last?.r ?? low };
}
function averageWeight(checkins = {}, today) {
  const from = new Date(`${today}T12:00:00`); from.setDate(from.getDate() - 6);
  const values = Object.entries(checkins).filter(([date, item]) => date >= localDate(from) && date <= today && Number(item?.weight) > 0).map(([, item]) => Number(item.weight));
  return values.length ? { value: values.reduce((a, b) => a + b, 0) / values.length, count: values.length } : null;
}
function sessionMinutes(day, entries = {}) {
  const times = day.exercises.flatMap((exercise) => (entries?.[exercise.id] || []).filter((row) => row?.done && row.t).map((row) => row.t));
  return times.length > 1 ? Math.max(1, Math.round((Math.max(...times) - Math.min(...times)) / 60_000)) : null;
}
function exerciseHistory(exercise, log = {}) {
  const timed = isTimed(exercise.reps);
  return Object.keys(log).sort().map((date) => {
    const rows = (log[date]?.[exercise.id] || []).filter((row) => row?.done);
    if (!rows.length) return null;
    const best = timed ? null : rows.map((row) => ({ w: Number(row.w) || 0, r: Number(row.r) || 0, e1rm: (Number(row.w) || 0) * (1 + (Number(row.r) || 0) / 30) })).sort((a, b) => b.e1rm - a.e1rm)[0];
    const top = Math.max(...rows.map((row) => Number(timed ? row.r : row.w) || 0));
    return { date, rows, top, best, variant: rows.find((row) => row.a)?.a };
  }).filter(Boolean);
}
function shortDate(date) { const [, month, dayOfMonth] = date.split("-"); return `${Number(dayOfMonth)}/${Number(month)}`; }
function longDate(date) { return new Date(`${date}T12:00:00`).toLocaleDateString("es", { weekday: "short", day: "numeric", month: "short" }); }
function normalizeProgress(value) { return { ...EMPTY_PROGRESS, ...value, settings: { ...EMPTY_PROGRESS.settings, ...value?.settings } }; }
function readProgressCache(userId) { try { const cached = JSON.parse(localStorage.getItem(PROGRESS_CACHE_KEY)); return cached?.userId === userId ? cached : null; } catch { return null; } }
function writeProgressCache(userId, progress, dirty) { try { localStorage.setItem(PROGRESS_CACHE_KEY, JSON.stringify({ userId, progress, dirty, at: Date.now() })); } catch {} }
function perDay(steps) { return /d[ií]a/i.test(steps) ? steps : `${steps}/día`; }
function fmtNum(value) { const number = Number(value) || 0; return Number.isInteger(number) ? String(number) : number.toFixed(1); }
function unlockAudio(ref) {
  try { ref.current ||= new (window.AudioContext || window.webkitAudioContext)(); ref.current.resume?.(); } catch {}
}
function beep(ref) {
  const context = ref.current; if (!context) return;
  [0, 0.35, 0.7].forEach((offset) => {
    const osc = context.createOscillator(); const gain = context.createGain();
    osc.frequency.value = 880; gain.gain.setValueAtTime(0.25, context.currentTime + offset); gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + offset + 0.25);
    osc.connect(gain).connect(context.destination); osc.start(context.currentTime + offset); osc.stop(context.currentTime + offset + 0.26);
  });
}

async function ensureGif(search, cache, setCache, force) {
  const current = cache?.[search];
  if (!force && current?.gif && current.status === "loaded") return;
  if (!force && current?.status === "loading" && Date.now() - Number(current.at || 0) < 30_000) return;
  if (!force && current?.status === "failed" && Date.now() - Number(current.at || 0) < 5 * 60_000) return;
  setCache((previous) => ({ ...previous, [search]: { ...(previous[search] || {}), status: "loading", at: Date.now() } }));
  try {
    const { exercise } = await api.getExerciseGif(search);
    if (!exercise?.gif) throw new Error("No GIF");
    await preloadImage(exercise.gif);
    setCache((previous) => ({ ...previous, [search]: { ...exercise, status: "loaded", at: Date.now() } }));
  } catch { setCache((previous) => ({ ...previous, [search]: { status: "failed", at: Date.now() } })); }
}
function preloadImage(src) { return new Promise((resolve, reject) => { const image = new Image(); const timer = setTimeout(() => reject(new Error("GIF timeout")), 12_000); image.onload = () => { clearTimeout(timer); resolve(); }; image.onerror = () => { clearTimeout(timer); reject(new Error("GIF failed")); }; image.src = src; }); }
function useLocalStorage(key, fallback) { const [value, setValue] = useState(() => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }); useEffect(() => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} }, [key, value]); return [value, setValue]; }
function localDate(date = new Date()) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
function formatTime(seconds) { const value = Math.max(0, Math.round(Number(seconds) || 0)); return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")}`; }

function Root() {
  const { user, loading } = useAuth();
  const verifyPath = `${import.meta.env.BASE_URL}verify-email`.replace(/\/$/, "");
  if (window.location.pathname === verifyPath || window.location.search.includes("token=")) return <VerifyEmailPage />;
  if (loading) return <div className="boot"><LoaderCircle className="spin" /> Preparando tu espacio…</div>;
  if (!user) return <AuthScreen />;
  return <><EmailVerificationBanner user={user} /><App /></>;
}

createRoot(document.getElementById("root")).render(<AuthProvider><Root /></AuthProvider>);
