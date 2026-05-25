import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Play,
  RefreshCw,
  TimerReset,
  Dumbbell,
  Flame,
  CheckCircle2,
  ExternalLink,
  Maximize2,
  Minimize2,
  X,
  Trash2,
  Sparkles,
} from "lucide-react";
import "./style.css";
import { AuthProvider, useAuth, AuthScreen, LogoutButton } from "./auth.jsx";
import { api } from "./api.js";
import { EmailVerificationBanner, AiCreditsIndicator } from "./EmailVerificationBanner.jsx";
import { VerifyEmailPage } from "./VerifyEmailPage.jsx";

const API_ORIGIN = "https://oss.exercisedb.dev";
const API_BASE = import.meta.env.DEV ? "/exercise-api" : `${API_ORIGIN}/api/v1/exercises`;
const STATIC_BASE = "https://static.exercisedb.dev/media/";
const GIF_CACHE_KEY = "adam_shred_react_gifs_v3";
const PROGRESS_KEY = "adam_shred_react_progress_v2";
const ENABLE_EXERCISEDB_LOOKUP = true;
const FALLBACK_GIFS = {
  "incline dumbbell press": "https://static.exercisedb.dev/media/ns0SIbU.gif",
};
const NO_GIF_SEARCHES = new Set([
  "incline treadmill walk",
  "walking",
  "stretching",
  "stomach vacuum",
  "dragon flag",
  "l sit",
  "hanging windshield wiper",
  "stir the pot",
  "sled push",
  "assault bike",
]);

const defaultDays = [
  {
    key: "mon",
    label: "Lun",
    title: "Push pesado + Abs vol",
    focus: "Pecho · Hombro · Tríceps · Abs avanzados",
    duration: "80-90 min",
    desc: "Banca 5×5 RPE 8, supersets ⚡, drop set en lateral, rest-pause en tríceps. Abs: dragon flag.",
    exercises: [
      ex("Barbell Bench Press", "barbell bench press", "5", "5", "120s", "RPE 8. Escápulas retraídas. Bajada 3s. Empuja con piernas."),
      ex("Seated Dumbbell Shoulder Press", "seated dumbbell shoulder press", "4", "8", "90s", "RPE 8. Costillas abajo, no arquees lumbar."),
      ex("⚡ Incline Dumbbell Press", "incline dumbbell press", "3", "10", "0s", "Superset con remo invertido — sin descanso."),
      ex("⚡ Inverted Row", "inverted row", "3", "12", "75s", "Pausa 1s arriba. Aprieta omóplatos."),
      ex("Dumbbell Lateral Raise (drop set)", "dumbbell lateral raise", "3", "12", "60s", "Última serie: drop ×AMRAP al 30% menos peso, repite 2 drops."),
      ex("Cable Triceps Rope Pushdown (rest-pause)", "cable triceps pushdown rope", "3", "12", "60s", "Última: pausa 15s al fallo, AMRAP ×2."),
      ex("Dragon Flag Negative", "dragon flag", "4", "6", "75s", "Bajada 5s estricta. Cuerpo recto. Si no, hollow body hold.", true),
      ex("Hanging Toes-to-Bar", "hanging toes to bar", "4", "AMRAP", "75s", "Sin balanceo. Piernas rectas hasta tocar barra.", true),
      ex("Cable Woodchopper", "cable woodchopper", "3", "12/side", "45s", "Carga pesada. Rotación con core, no con brazos.", true),
    ],
  },
  {
    key: "tue",
    label: "Mar",
    title: "Pull pesado + Abs rotacional",
    focus: "Espalda · Bíceps · Trapecio · Abs",
    duration: "85-95 min",
    desc: "Peso muerto 4×5, dominadas lastradas, remo Pendlay. Abs: windshield wipers.",
    exercises: [
      ex("Barbell Deadlift", "barbell deadlift", "4", "5", "150s", "RPE 8. Técnica perfecta. Empuja el suelo, no jales."),
      ex("Weighted Pull Up", "weighted pull up", "4", "6-8", "120s", "Lastra cuando puedas. Si no, dominada estricta o asistida."),
      ex("Pendlay Row", "pendlay row", "4", "8", "90s", "Concéntrico explosivo, descansa la barra cada rep."),
      ex("⚡ Seated Cable Row", "seated cable row", "3", "10", "0s", "Superset con face pull."),
      ex("⚡ Face Pull", "face pull", "3", "15", "75s", "Pull a la frente. Rotación externa al final."),
      ex("Barbell Curl (drop set)", "barbell curl", "3", "8", "60s", "Última: drop ×AMRAP al 30% menos."),
      ex("Hammer Curl", "hammer curl", "3", "12", "60s", "Neutro. Eccentric controlado 3s."),
      ex("Hanging Windshield Wiper", "hanging windshield wiper", "3", "8/side", "75s", "Avanzado. Si no, lying windshield wiper en el suelo.", true),
      ex("Weighted Russian Twist", "russian twist", "3", "20", "60s", "Disco 10 kg. Pies elevados. Rotación lenta.", true),
      ex("Weighted Plank", "weighted plank", "3", "60s", "60s", "10-20 kg en espalda. Glúteos tensos.", true),
    ],
  },
  {
    key: "wed",
    label: "Mié",
    title: "Legs pesado + Core estabilidad",
    focus: "Cuádriceps · Glúteos · Femoral · Core",
    duration: "90-100 min",
    desc: "Sentadilla 5×5, RDL pesado, prensa rest-pause. Core: ab wheel de pie + L-sit.",
    exercises: [
      ex("Barbell Back Squat", "barbell back squat", "5", "5", "150s", "RPE 8. Bajo paralelo. Brace duro. Bajada 3s."),
      ex("Romanian Deadlift", "romanian deadlift", "4", "8", "90s", "Hinge cadera. Estiramiento máximo. Barra pegada."),
      ex("Leg Press (rest-pause)", "leg press", "3", "12", "90s", "Última: pausa 15s al fallo, AMRAP ×2."),
      ex("Dumbbell Walking Lunge", "dumbbell walking lunge", "3", "10/leg", "75s", "Pasos largos. Tibia frontal vertical."),
      ex("Lying Leg Curl", "lying leg curl", "4", "12", "60s", "Tempo 3-1-1. Aprieta hasta abajo."),
      ex("Standing Calf Raise (drop set)", "standing calf raise", "4", "15", "45s", "Última: 2 drops del 25%."),
      ex("Standing Ab Wheel Rollout", "ab wheel rollout", "3", "AMRAP", "90s", "De pie si puedes. Si no, de rodillas con extensión completa.", true),
      ex("L-Sit Hold", "l sit", "3", "20-30s", "60s", "Paralelas. Piernas rectas, cadera bloqueada. Si no, tucked L-sit.", true),
      ex("Pallof Press Hold", "pallof press", "3", "30s/side", "45s", "Anti-rotación. Mantén caderas y hombros cuadrados.", true),
    ],
  },
  {
    key: "thu",
    label: "Jue",
    title: "Push hipertrofia + Abs aislamiento",
    focus: "Pecho superior · Hombro · Tríceps · Abs",
    duration: "80-95 min",
    desc: "Inclinado primero, mechanical drop en lateral, fondos lastrados. Abs: situp con disco.",
    exercises: [
      ex("Incline Barbell Bench Press", "incline barbell bench press", "4", "8", "90s", "Pecho superior. No flares de codos."),
      ex("Standing Barbell Overhead Press", "standing barbell overhead press", "4", "8", "90s", "Glúteos y core tensos. Sin piernas."),
      ex("⚡ Cable Chest Fly Crossover", "cable crossover", "3", "12", "0s", "Superset con fondos lastrados."),
      ex("⚡ Weighted Triceps Dip", "weighted dip", "3", "8-10", "90s", "Lean forward para pecho. Lockout completo."),
      ex("Mechanical Drop Lateral Raise", "dumbbell lateral raise", "3", "8+8", "60s", "8 reps pesado → 8 reps al 50% sin descanso."),
      ex("EZ Bar Skull Crusher (rest-pause)", "skull crusher", "3", "10", "60s", "Última: pausa 15s al fallo, AMRAP ×2."),
      ex("Overhead Cable Triceps Extension", "overhead cable triceps extension", "3", "12", "60s", "Estiramiento largo de cabeza larga."),
      ex("Weighted Decline Sit-Up", "weighted decline sit up", "4", "12", "75s", "Disco 10-15 kg sobre el pecho. Bajada controlada.", true),
      ex("Cable Crunch (heavy)", "cable crunch", "4", "12", "60s", "Pesado. Redondea columna hasta que la espalda baja se involucre.", true),
      ex("Stir-the-Pot on Stability Ball", "stir the pot", "3", "10/dir", "45s", "Plancha en pelota. Círculos lentos con codos.", true),
    ],
  },
  {
    key: "fri",
    label: "Vie",
    title: "Pull hipertrofia + Abs bajos",
    focus: "Anchura espalda · Bíceps · Rear delts · Abs bajos",
    duration: "85-95 min",
    desc: "Jalón ancho, remo a una mano, predicador con drop. Abs: leg raise estricto + reverse crunch lastrado.",
    exercises: [
      ex("Wide Grip Lat Pulldown", "lat pulldown", "4", "8", "90s", "Agarre ancho. Pull al pecho superior."),
      ex("Single Arm Dumbbell Row", "single arm dumbbell row", "4", "10/side", "75s", "Estiramiento completo abajo. Pull a la cadera."),
      ex("⚡ Cable Pullover", "cable pullover", "3", "12", "0s", "Superset con reverse pec deck."),
      ex("⚡ Reverse Pec Deck", "reverse pec deck", "3", "15", "75s", "Lidera con codos. Aprieta rear delts."),
      ex("Incline Dumbbell Curl", "incline dumbbell curl", "3", "10", "60s", "Brazo detrás del cuerpo. Estiramiento máximo."),
      ex("Preacher Curl (drop set)", "preacher curl", "3", "10", "60s", "Última: drop ×AMRAP al 30% menos."),
      ex("Heavy Dumbbell Shrug", "dumbbell shrug", "3", "12", "60s", "Pausa 1s arriba. Sin rotación."),
      ex("Strict Hanging Leg Raise", "hanging leg raise", "4", "12-15", "75s", "Sin balanceo. Piernas rectas. Curl de pelvis al final.", true),
      ex("Decline Reverse Crunch (weighted)", "decline reverse crunch", "4", "15", "60s", "Mancuerna entre tobillos. Curl de pelvis estricto.", true),
      ex("Slow Bicycle Crunch", "bicycle crunch", "3", "30", "45s", "Tempo 2-2. Codo a rodilla opuesta tocando.", true),
    ],
  },
  {
    key: "sat",
    label: "Sáb",
    title: "Legs hipertrofia + Circuito ABS quema",
    duration: "90-105 min",
    focus: "Cuádriceps · Glúteos · Femoral · Circuito core",
    desc: "Pierna con máquinas + búlgara. Cierre con circuito de 4 rondas brutal.",
    exercises: [
      ex("Hack Squat", "hack squat", "4", "10", "90s", "Profundo. Empuja con talones."),
      ex("Bulgarian Split Squat", "bulgarian split squat", "4", "10/leg", "75s", "Mancuernas pesadas. Caída vertical."),
      ex("Barbell Hip Thrust", "barbell hip thrust", "4", "10", "90s", "Pausa 1s arriba. Glúteos en lockout."),
      ex("Seated Leg Curl (drop set)", "seated leg curl", "3", "12", "60s", "Última: drop ×AMRAP."),
      ex("Leg Extension (rest-pause)", "leg extension", "3", "15", "60s", "Última: 2 pausas de 15s."),
      ex("Seated Calf Raise", "seated calf raise", "4", "20", "45s", "Bombeo extremo. Rango completo."),
      ex("CIRCUIT: Hanging Knee Raise", "hanging knee raise", "4", "15", "0s", "4 rondas. Sin descanso entre A-E. 30s entre rondas.", true),
      ex("CIRCUIT: Cable Crunch", "cable crunch", "4", "15", "0s", "Pesado. Sigue de inmediato.", true),
      ex("CIRCUIT: V-Up", "v up", "4", "15", "0s", "Toca pies. Sigue.", true),
      ex("CIRCUIT: Side Plank with Hip Lift", "side plank hip lift", "4", "20s/side", "0s", "Cadera arriba y abajo lento. Sigue.", true),
      ex("CIRCUIT: Mountain Climber", "mountain climber", "4", "30s", "30s", "Explosivo. Cierra la ronda. Descansa 30s.", true),
    ],
  },
  {
    key: "sun",
    label: "Dom",
    title: "Descanso + Refeed",
    focus: "Recuperación · Pasos · Carbos a TDEE",
    duration: "Easy day",
    desc: "Sube calorías a ~2,500 (refeed). Camina 12k pasos. Estira. Recupera mente y glucógeno.",
    exercises: [
      ex("Easy Walk", "walking", "1", "60 min", "0s", "Pasos largos. Outdoor. 12k pasos meta del día."),
      ex("Full Body Mobility", "stretching", "1", "15 min", "0s", "Cadera, isquios, hombros, t-spine."),
    ],
  },
];

function ex(name, search, sets, reps, rest, cue, abs = false) {
  return { name, search, sets, reps, rest, cue, abs };
}

function App() {
  const { user } = useAuth();
  const todayKey = useMemo(() => getTodayKey(), []);
  const [active, setActive] = useState(todayKey);
  const [gifCache, setGifCache] = useLocalStorage(GIF_CACHE_KEY, {});
  const [progress, setProgress] = useLocalStorage(PROGRESS_KEY, {});
  const [days, setDays] = useState(defaultDays);
  const [planMeta, setPlanMeta] = useState(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [open, setOpen] = useState({});
  const [media, setMedia] = useState(null);
  const [mediaExpanded, setMediaExpanded] = useState(true);
  const [timer, setTimer] = useState(null);

  const day = useMemo(() => days.find((d) => d.key === active) || days[0], [active, days]);

  // On login: pull the user's saved plan (if any) and server-side progress.
  // The synced flag gates the save effect so we don't overwrite the server
  // with empty local state before the initial fetch resolves.
  const synced = React.useRef(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { plan } = await api.getPlan();
        if (!cancelled && plan?.days?.length) {
          setDays(plan.days);
          setPlanMeta(plan.meta || null);
        }
      } catch (e) {
        console.warn("plan load failed", e.message);
      }
      try {
        const { progress: remote } = await api.getProgress();
        if (!cancelled && remote && Object.keys(remote).length) setProgress(remote);
      } catch (e) {
        console.warn("progress load failed", e.message);
      }
      if (!cancelled) synced.current = true;
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced push of progress to the server after the initial sync.
  useEffect(() => {
    if (!synced.current) return;
    const id = setTimeout(() => {
      api.saveProgress(progress).catch((e) => console.warn("progress save failed", e.message));
    }, 800);
    return () => clearTimeout(id);
  }, [progress]);

  function applyPlan(plan) {
    if (plan?.days?.length) {
      setDays(plan.days);
      setPlanMeta(plan.meta || null);
      setActive(plan.days.find((d) => d.key === todayKey) ? todayKey : plan.days[0].key);
    }
  }

  function resetToDefaultPlan() {
    setDays(defaultDays);
    setPlanMeta(null);
  }

  useEffect(() => {
    day.exercises.forEach((exercise) => {
      if (!gifCache[exercise.search]?.gif && gifCache[exercise.search]?.status !== "loading") {
        loadGif(exercise.search, gifCache, setGifCache);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  useEffect(() => {
    if (!timer || timer.left <= 0) return;
    const id = setInterval(() => {
      setTimer((t) => {
        if (!t) return null;
        if (t.left <= 1) {
          try {
            navigator.vibrate?.([250, 120, 250]);
          } catch {}
          return null;
        }
        return { ...t, left: t.left - 1 };
      });
    }, 1000);
    return () => clearInterval(id);
  }, [timer]);

  useEffect(() => {
    if (media) setMediaExpanded(true);
  }, [media]);

  function refreshGif(search) {
    if (!ENABLE_EXERCISEDB_LOOKUP || NO_GIF_SEARCHES.has(search)) {
      setGifCache((prev) => ({
        ...prev,
        [search]: {
          ...(prev[search] || {}),
          status: "failed",
          ts: Date.now(),
        },
      }));
      return;
    }

    setGifCache((prev) => {
      const current = prev[search] || {};
      return {
        ...prev,
        [search]: { ...current, status: "loading" },
      };
    });
    setTimeout(() => loadGif(search, gifCache, setGifCache, true), 50);
  }

  function setSetValue(exId, setNo, field, value) {
    setProgress((prev) => ({
      ...prev,
      [exId]: {
        ...(prev[exId] || {}),
        [setNo]: {
          ...((prev[exId] || {})[setNo] || {}),
          [field]: value,
        },
      },
    }));
  }

  function toggleDone(exId, setNo, rest) {
    const nextDone = !progress?.[exId]?.[setNo]?.done;
    setSetValue(exId, setNo, "done", nextDone);
    if (nextDone) {
      const seconds = parseRest(rest);
      if (seconds > 0) setTimer({ left: seconds, total: seconds });
    }
  }

  return (
    <main className="app">
      <header className="hero">
        <div className="topbar">
          <button className="ai-btn" onClick={() => setAiOpen(true)}>
            <Sparkles size={15} /> Generar plan con IA
          </button>
          <div className="topbar-right">
            <AiCreditsIndicator user={user} />
            <LogoutButton />
          </div>
        </div>
        <div className="eyebrow">EXTREME CUT 4 sem · PPL×2 · Abs avanzados · RPE 8-9</div>
        <h1>ADAM.SHRED</h1>
        {planMeta?.summary && <div className="plan-banner">🤖 {planMeta.summary}</div>}
        <p>
          Plan extremo de 4 semanas. Compuestos pesados, drop sets, rest-pause,
          supersets antagonistas, abs avanzados (dragon flag, windshield wipers,
          ab wheel de pie). Cardio quirúrgico. Déficit periodizado.
        </p>

        <div className="stats">
          <Stat value="1,950" label="kcal target" />
          <Stat value="160g" label="protein" />
          <Stat value="8k → 10k" label="steps/día" />
          <Stat value={day.label} label="today" />
        </div>
      </header>

      <nav className="tabs">
        {days.map((d) => (
          <button
            key={d.key}
            className={d.key === active ? "active" : ""}
            onClick={() => setActive(d.key)}
          >
            {d.label}
          </button>
        ))}
      </nav>

      <section className="day-card">
        <div className="day-head">
          <div>
            <h2>{day.title}</h2>
            <p>
              {day.focus} · {day.desc}
            </p>
          </div>
          <span className="pill">{day.duration}</span>
        </div>

        <div className="exercise-list">
          {day.exercises.map((exercise, index) => {
            const exId = `${day.key}-${slug(exercise.name)}-${index}`;
            const gif = gifCache[exercise.search]?.gif || "";
            const status = gifCache[exercise.search]?.status || "idle";
            const isOpen = !!open[exId];

            return (
              <article
                key={exId}
                className={`exercise ${exercise.abs ? "abs" : ""}`}
              >
                <button
                  className="exercise-top"
                  onClick={() => setOpen((o) => ({ ...o, [exId]: !o[exId] }))}
                >
                  <GifBox
                    name={exercise.name}
                    gif={gif}
                    status={status}
                    onOpen={() => setMedia({ name: exercise.name, gif })}
                  />
                  <div className="exercise-info">
                    <h3>{exercise.abs ? "★ " : ""}{exercise.name}</h3>
                    <div className="chips">
                      <span>{exercise.sets} sets</span>
                      <span>{exercise.reps}</span>
                      <span>{exercise.rest} rest</span>
                    </div>
                    <p>{exercise.cue}</p>
                  </div>
                </button>

                {isOpen && (
                  <div className="exercise-body">
                    <div className="actions">
                      <button
                        className="primary"
                        onClick={() => setMedia({ name: exercise.name, gif })}
                        disabled={!gif}
                      >
                        <Play size={16} /> Ver GIF grande
                      </button>
                      <button onClick={() => openShorts(exercise.name)}>
                        <ExternalLink size={16} /> YouTube Shorts
                      </button>
                      <button onClick={() => refreshGif(exercise.search)}>
                        <RefreshCw size={16} /> Refresh GIF
                      </button>
                      <button onClick={() => setTimer({ left: parseRest(exercise.rest), total: parseRest(exercise.rest) })}>
                        <TimerReset size={16} /> Rest
                      </button>
                    </div>

                    <p className="cue">
                      <b>Form cue:</b> {exercise.cue}
                    </p>

                    <SetTracker
                      exId={exId}
                      sets={exercise.sets}
                      rest={exercise.rest}
                      progress={progress}
                      setSetValue={setSetValue}
                      toggleDone={toggleDone}
                    />
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>

      <section className="plan">
        <div className="day-head">
          <div>
            <h2>Plan & Macros</h2>
            <p>
              El objetivo es bajar grasa total para revelar abs bajos. La parte
              baja sale al final, así que manda el déficit, pasos y constancia.
            </p>
          </div>
          <span className="pill">Health-adjusted</span>
        </div>

        <div className="grid">
          <Info title="Macros periodizados (4 sem)">
            <ul>
              <li><b>Sem 1-2:</b> 1,950 kcal · 175P / 210C / 55F</li>
              <li><b>Sem 3:</b> 1,850 kcal · 180P / 180C / 55F</li>
              <li><b>Sem 4 (final push):</b> 1,750 kcal · 180P / 150C / 55F</li>
              <li><b>Refeed dom:</b> 2,500 kcal — repón glucógeno</li>
              <li><b>Pre-entreno:</b> 40g carbo + 30g proteína (60 min antes)</li>
              <li><b>Post-entreno:</b> 50g carbo rápido + 40g whey</li>
            </ul>
          </Info>
          <Info title="Cardio quirúrgico">
            <ul>
              <li><b>Pasos:</b> 12,000/día (no negociable)</li>
              <li><b>Ayunas LISS</b> 3×/sem — 30 min cinta 12% / 5 km/h</li>
              <li><b>HIIT assault bike</b> 2×/sem post-pesas (lun + jue) — 10 min: 20s sprint / 40s easy ×10</li>
              <li><b>Sled push</b> sáb post circuito — 6×20m</li>
              <li>Nunca HIIT antes de pesas. Nunca cardio ayunas &gt; 30 min.</li>
            </ul>
          </Info>
          <Info title="Suplementación + reglas">
            <ul>
              <li><b>Creatina:</b> 5g/día (preserva fuerza en cut)</li>
              <li><b>Cafeína:</b> 200mg pre-entreno (no &gt; 4pm)</li>
              <li><b>Electrolitos:</b> sodio 4g + potasio 3.5g/día</li>
              <li><b>Sueño:</b> 7-8h (sin esto, cortisol arruina cut)</li>
              <li>Cero alcohol · ayuno 14h opcional</li>
              <li>Foto + medidas: sem 0 y sem 4</li>
            </ul>
          </Info>
          <Info title="Periodización 4 semanas">
            <ul>
              <li><b>Sem 1:</b> Acumulación · RPE 7-8</li>
              <li><b>Sem 2:</b> Acumulación + 10% peso/reps · RPE 8</li>
              <li><b>Sem 3:</b> Intensificación brutal · drops en TODO · RPE 9</li>
              <li><b>Sem 4:</b> Peak week · -20% volumen · RPE 8-9 · foto final</li>
            </ul>
          </Info>
          <Info title="Reglas de intensidad (no negociables)">
            <ul>
              <li><b>RPE 8-9</b> compuestos · <b>RPE 9-10</b> aislamientos</li>
              <li>Última serie de cada aislamiento → <b>drop o rest-pause</b></li>
              <li>Tempo 3-1-1 en compuestos (3s bajada)</li>
              <li>⚡ = superset antagonista, sin descanso</li>
              <li>Cero celular entre sets · diario de pesos obligatorio</li>
            </ul>
          </Info>
          <Info title="Sobre los GIFs">
            <p>
              Los GIFs vienen de ExerciseDB. Si salen cortados, toca “Ver GIF grande”.
              Si siguen mal, usa Shorts: normalmente es mejor para forma.
            </p>
          </Info>
          <Info title="Reset">
            <div className="actions">
              <button onClick={() => setGifCache({})}>
                <RefreshCw size={16} /> Clear GIF cache
              </button>
              <button onClick={() => confirm("Reset progress?") && setProgress({})}>
                <Trash2 size={16} /> Reset progress
              </button>
            </div>
          </Info>
        </div>
      </section>

      {media && (
        <div className="modal" onClick={() => setMedia(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <b>{media.name}</b>
              <button onClick={() => setMedia(null)}>
                <X size={18} />
              </button>
            </div>
            {media.gif ? (
              <img
                className={`modal-gif ${mediaExpanded ? "expanded" : ""}`}
                src={media.gif}
                alt={`${media.name} exercise GIF`}
              />
            ) : (
              <div className="empty">No GIF loaded</div>
            )}
            <div className="actions modal-actions">
              {media.gif && (
                <button onClick={() => setMediaExpanded((v) => !v)}>
                  {mediaExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                  {mediaExpanded ? " Tamaño real" : " Grande"}
                </button>
              )}
              <button className="primary" onClick={() => openShorts(media.name)}>
                <ExternalLink size={16} /> Video HD
              </button>
            </div>
          </div>
        </div>
      )}

      {timer && timer.left > 0 && (
        <div className={`timer ${timer.left <= 5 ? "danger" : ""}`}>
          <div>
            <span>Rest timer</span>
            <b>{formatTime(timer.left)}</b>
          </div>
          <button onClick={() => setTimer(null)}>Stop</button>
        </div>
      )}

      {aiOpen && (
        <AiPlanModal
          onClose={() => setAiOpen(false)}
          onApply={(plan) => {
            applyPlan(plan);
            setAiOpen(false);
          }}
          onReset={() => {
            resetToDefaultPlan();
            setAiOpen(false);
          }}
          hasCustomPlan={!!planMeta}
        />
      )}
    </main>
  );
}

function AiPlanModal({ onClose, onApply, onReset, hasCustomPlan }) {
  const [goals, setGoals] = useState("");
  const [daysPerWeek, setDaysPerWeek] = useState(5);
  const [experience, setExperience] = useState("intermediate");
  const [equipment, setEquipment] = useState("full gym");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function generate() {
    setBusy(true);
    setError("");
    try {
      const { plan } = await api.generatePlan({
        goals,
        daysPerWeek: Number(daysPerWeek),
        experience,
        equipment,
        notes,
      });
      onApply(plan);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-card ai-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <b><Sparkles size={16} /> Generar plan con IA</b>
          <button onClick={onClose}><X size={18} /></button>
        </div>

        <label className="ai-field">
          <span>Objetivo</span>
          <input
            type="text"
            placeholder="ej. perder grasa y marcar abdomen"
            value={goals}
            onChange={(e) => setGoals(e.target.value)}
          />
        </label>

        <label className="ai-field">
          <span>Días por semana</span>
          <select value={daysPerWeek} onChange={(e) => setDaysPerWeek(e.target.value)}>
            {[3, 4, 5, 6, 7].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>

        <label className="ai-field">
          <span>Nivel</span>
          <select value={experience} onChange={(e) => setExperience(e.target.value)}>
            <option value="beginner">Principiante</option>
            <option value="intermediate">Intermedio</option>
            <option value="advanced">Avanzado</option>
          </select>
        </label>

        <label className="ai-field">
          <span>Equipo</span>
          <input
            type="text"
            placeholder="ej. full gym, mancuernas, casa"
            value={equipment}
            onChange={(e) => setEquipment(e.target.value)}
          />
        </label>

        <label className="ai-field">
          <span>Notas</span>
          <input
            type="text"
            placeholder="lesiones, preferencias…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>

        {error && <div className="auth-error">{error}</div>}

        <div className="actions modal-actions">
          <button className="primary" onClick={generate} disabled={busy}>
            <Sparkles size={16} /> {busy ? "Generando…" : "Generar"}
          </button>
          {hasCustomPlan && (
            <button onClick={onReset} disabled={busy}>
              <RefreshCw size={16} /> Volver al plan original
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Auth gate: shows the login/register screen until a session exists.
function Root() {
  const { user, loading } = useAuth();
  
  // Simple routing for email verification
  const path = window.location.pathname;
  const isVerifyPage = path === "/verify-email" || window.location.search.includes("token=");
  
  if (isVerifyPage) {
    return <VerifyEmailPage />;
  }
  
  if (loading) return <div className="boot">Cargando…</div>;
  if (!user) return <AuthScreen />;
  
  return (
    <>
      <EmailVerificationBanner user={user} />
      <App />
    </>
  );
}

function GifBox({ name, gif, status, onOpen }) {
  return (
    <div
      className="gif-box"
      onClick={(e) => {
        e.stopPropagation();
        if (gif) onOpen();
      }}
    >
      {gif ? (
        <img src={gif} alt={`${name} GIF`} />
      ) : (
        <div className="placeholder">
          <Dumbbell size={26} />
          <span>{status === "loading" ? "Loading GIF" : "No GIF"}</span>
        </div>
      )}
      {gif && <div className="tap">Tap</div>}
    </div>
  );
}

function SetTracker({ exId, sets, rest, progress, setSetValue, toggleDone }) {
  const count = Math.max(1, Number(String(sets).match(/\d+/)?.[0] || 1));
  return (
    <div className="sets">
      {Array.from({ length: count }).map((_, i) => {
        const setNo = String(i + 1);
        const row = progress?.[exId]?.[setNo] || {};
        return (
          <div className="set-row" key={setNo}>
            <b>{setNo}</b>
            <input
              inputMode="decimal"
              placeholder="lb"
              value={row.weight || ""}
              onChange={(e) => setSetValue(exId, setNo, "weight", e.target.value)}
            />
            <input
              inputMode="decimal"
              placeholder="reps"
              value={row.reps || ""}
              onChange={(e) => setSetValue(exId, setNo, "reps", e.target.value)}
            />
            <button
              className={row.done ? "done" : ""}
              onClick={() => toggleDone(exId, setNo, rest)}
            >
              {row.done ? <CheckCircle2 size={17} /> : "○"}
            </button>
          </div>
        );
      })}
    </div>
  );
}

function Stat({ value, label }) {
  return (
    <div className="stat">
      <b>{value}</b>
      <span>{label}</span>
    </div>
  );
}

function Info({ title, children }) {
  return (
    <div className="info-card">
      <h3>{title}</h3>
      {children}
    </div>
  );
}

async function loadGif(search, cache, setCache, force = false) {
  if (!force && cache?.[search]?.gif) return cache[search].gif;

  if (!ENABLE_EXERCISEDB_LOOKUP || NO_GIF_SEARCHES.has(search)) {
    setCache((prev) => ({
      ...prev,
      [search]: {
        ...(prev[search] || {}),
        status: "failed",
        ts: Date.now(),
      },
    }));
    return "";
  }

  // Curated overrides win over the ExerciseDB search — these are searches whose
  // best API match is a known-wrong exercise, so never let the lookup override them.
  if (FALLBACK_GIFS[search]) {
    setCache((prev) => ({
      ...prev,
      [search]: { gif: FALLBACK_GIFS[search], id: "", name: search, status: "loaded", ts: Date.now() },
    }));
    return FALLBACK_GIFS[search];
  }

  setCache((prev) => ({
    ...prev,
    [search]: { ...(prev[search] || {}), status: "loading" },
  }));

  const queries = uniq([
    search,
    search.replace("dumbbell ", ""),
    search.replace("stationary ", ""),
    search.replace("incline treadmill walk", "walking"),
    search.replace("romanian deadlift dumbbell", "dumbbell romanian deadlift"),
    search.replace("stomach vacuum", "vacuum"),
  ]);

  for (const q of queries) {
    try {
      const data = await fetchJson(`${API_BASE}/search?search=${encodeURIComponent(q)}`, 9000);
      const list = normalizeExerciseList(data);
      const match = pickBestMatch(q, list);
      if (!match) continue;

      const id = match.exerciseId || match.id || match._id || match.exercise_id;
      const gif = match.gifUrl || match.gif || match.image || match.imageUrl || match.mediaUrl || (id ? `${STATIC_BASE}${id}.gif` : "");
      if (!gif) continue;

      setCache((prev) => ({
        ...prev,
        [search]: {
          gif,
          id: id || "",
          name: match.name || q,
          status: "loaded",
          ts: Date.now(),
        },
      }));
      return gif;
    } catch {
      // try next query
    }
  }

  setCache((prev) => ({
    ...prev,
    [search]: {
      ...(prev[search] || {}),
      status: "failed",
      ts: Date.now(),
    },
  }));
  return "";
}

async function fetchJson(url, ms) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, {
      headers: { accept: "application/json" },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`API ${res.status}`);
    if (!res.headers.get("content-type")?.includes("application/json")) {
      throw new Error("API returned non-json");
    }
    return await res.json();
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeExerciseList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.data?.exercises)) return data.data.exercises;
  if (Array.isArray(data?.exercises)) return data.exercises;
  if (Array.isArray(data?.results)) return data.results;
  return [];
}

function pickBestMatch(search, list) {
  if (!list?.length) return null;
  const s = norm(search);
  const words = s.split(" ").filter((w) => w.length > 2);

  const best = list
    .map((item) => {
      const n = norm(item.name || item.exerciseName || "");
      const substr = n === s || n.includes(s) || s.includes(n);
      let score = 0;
      let hits = 0;
      if (n === s) score += 100;
      if (substr) score += 50;
      words.forEach((w) => {
        if (n.includes(w)) {
          score += 8;
          hits += 1;
        }
      });
      return { item, score, hits, substr };
    })
    .sort((a, b) => b.score - a.score)[0];

  if (!best) return null;
  // Confidence gate: only trust exact/substring matches, or matches that share a
  // clear majority of the search's significant words. Otherwise return null so
  // the caller falls back to "No GIF" + YouTube instead of showing a wrong GIF.
  if (best.substr) return best.item;
  if (words.length && best.hits >= Math.max(2, Math.ceil(words.length * 0.6))) {
    return best.item;
  }
  return null;
}

function useLocalStorage(key, fallback) {
  const [value, setValue] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(key)) ?? fallback;
    } catch {
      return fallback;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }, [key, value]);

  return [value, setValue];
}

function openShorts(name) {
  const q = `${name} exercise form shorts #shorts`;
  window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`, "_blank", "noopener,noreferrer");
}

function parseRest(rest) {
  const match = String(rest).match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function slug(v) {
  return norm(v).replace(/\s+/g, "-");
}

function getTodayKey() {
  return ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][new Date().getDay()];
}

function norm(v) {
  return String(v).toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

function uniq(arr) {
  return [...new Set(arr.filter(Boolean))];
}

createRoot(document.getElementById("root")).render(
  <AuthProvider>
    <Root />
  </AuthProvider>
);
