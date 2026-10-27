// Plan de definición personalizado · 8 semanas (PDF del 26 oct 2026).
// Las tablas de series/reps/descansos reflejan exactamente el PDF.
const alt = (name, search) => ({ name, search });
const exercise = (id, sets, reps, rest, cue, alternatives, extra = {}) => ({ id, sets, reps, rest, cue, alternatives, ...extra });
const day = (id, title, subtitle, exercises, note = "") => ({ id, title, subtitle, duration: "50–60 min", exercises, note });

export const PLAN_VERSION = 3;

// Alternativas: solo las que permite el PDF ("Smith ↔ mancuernas / máquina equivalente;
// jalón ↔ dominadas asistidas; zancada ↔ step-up; crunch ↔ dead bug").
export const DEFAULT_PLAN = {
  version: PLAN_VERSION,
  name: "Definición",
  subtitle: "Menos grasa, más definición, sin perder músculo ni fuerza.",
  startDate: "2026-10-26",
  totalWeeks: 8,
  activeBlock: "A",
  blocks: {
    A: {
      label: "8 semanas · Definición",
      days: [
        day("d1", "Torso A", "Empuje + tirón", [
          exercise("d1-press", 3, "6–8", 120, "Escápulas firmes; barra controlada", [alt("Press plano Smith", "smith bench press"), alt("Press plano con mancuernas", "dumbbell bench press"), alt("Press plano en máquina", "lever chest press")], { main: true }),
          exercise("d1-pulldown", 3, "8–12", 90, "Codos hacia costillas; sin balanceo", [alt("Jalón al pecho", "cable pulldown"), alt("Dominadas asistidas", "assisted pull up")], { main: true }),
          exercise("d1-incline", 2, "8–12", 90, "Recorrido cómodo; sin rebotes", [alt("Press inclinado mancuernas", "dumbbell incline bench press")]),
          exercise("d1-row", 2, "8–12", 90, "Espalda neutra; llevar codos atrás", [alt("Remo sentado polea", "cable seated row")]),
          exercise("d1-lateral", 2, "12–20", 60, "Subir sin impulso", [alt("Elevaciones laterales", "dumbbell lateral raise")]),
          exercise("d1-triceps", 2, "10–15", 60, "Codos quietos junto al cuerpo", [alt("Extensión tríceps con cuerda", "cable pushdown with rope attachment")]),
          exercise("d1-curl", 2, "10–15", 60, "Sin balancear la espalda", [alt("Curl bíceps mancuernas", "dumbbell biceps curl")]),
        ], "Ahorro de tiempo opcional: alterna solo las 2 últimas series de tríceps y bíceps; descansa 60–75 s después de completar la pareja. Mantén presses y jalones pesados por separado."),
        day("d2", "Piernas A", "Piernas completas + abdomen", [
          exercise("d2-squat", 3, "6–10", 120, "Rodillas siguen pies; rango seguro", [alt("Sentadilla Smith", "smith squat"), alt("Sentadilla goblet con mancuerna", "dumbbell goblet squat"), alt("Prensa de piernas (máquina)", "sled 45 leg press")], { main: true }),
          exercise("d2-rdl", 3, "8–10", 120, "Cadera atrás; espalda neutra", [alt("Peso muerto rumano con mancuernas", "dumbbell romanian deadlift")], { main: true }),
          exercise("d2-lunge", 2, "8–10/lado", 90, "Paso controlado; estabilidad", [alt("Zancada hacia atrás", "dumbbell rear lunge"), alt("Step-up", "dumbbell step up")]),
          exercise("d2-legcurl", 2, "10–15", 75, "Controlar vuelta", [alt("Curl femoral máquina/polea", "lever lying leg curl"), alt("Curl femoral máquina sentado", "lever seated leg curl")]),
          exercise("d2-calf", 3, "12–20", 60, "Pausa breve arriba y abajo", [alt("Elevación de talones", "lever standing calf raise")]),
          exercise("d2-plank", 2, "30–45 s", 60, "Costillas abajo, abdomen firme", [alt("Plancha frontal", "front plank")], { tag: "core" }),
        ], "Si falta tiempo: elimina primero la plancha extra o deja 2 series de pantorrillas; no sacrifiques las series principales de sentadilla o bisagra de cadera."),
        day("d3", "Torso B", "Variantes · segundo estímulo", [
          exercise("d3-incline", 3, "6–10", 120, "Controlar descenso, sin rebotes", [alt("Press inclinado Smith", "smith incline bench press"), alt("Press inclinado mancuernas", "dumbbell incline bench press"), alt("Press inclinado en máquina", "lever incline chest press")], { main: true }),
          exercise("d3-row", 3, "8–12", 90, "Evita tirar con la zona lumbar", [alt("Remo pecho apoyado", "dumbbell incline row")], { main: true }),
          exercise("d3-pulldown", 2, "8–12", 90, "Codos hacia abajo", [alt("Jalón agarre neutro", "twin handle parallel grip lat pulldown"), alt("Dominadas asistidas (agarre neutro)", "assisted parallel close grip pull up")]),
          exercise("d3-fly", 2, "12–15", 60, "Abrazo amplio, codo levemente flexionado", [alt("Aperturas con cable", "cable standing fly")]),
          exercise("d3-shoulder", 2, "8–12", 90, "Evita arquear la espalda", [alt("Press hombro sentado", "dumbbell seated shoulder press")]),
          exercise("d3-facepull", 2, "12–20", 60, "Tira a la altura de la cara", [alt("Face pull", "cable standing rear delt row with rope")]),
          exercise("d3-curl", 2, "10–15", 60, "Brazo superior estable", [alt("Curl bíceps polea", "cable curl")]),
          exercise("d3-triceps", 2, "10–15", 60, "Codos apuntan adelante", [alt("Tríceps sobre cabeza polea", "cable overhead triceps extension rope attachment")]),
        ], "Superserie opcional: alterna curl y extensión de tríceps; descansa 60–75 s tras cada pareja. Si se eleva demasiado el cansancio, hazlas por separado."),
        day("d4", "Piernas B", "Segundo estímulo + core", [
          exercise("d4-squat", 3, "8–12", 120, "Buena profundidad individual", [alt("Sentadilla Smith (moderada)", "smith squat"), alt("Sentadilla goblet con mancuerna", "dumbbell goblet squat"), alt("Prensa de piernas (máquina)", "sled 45 leg press")], { main: true }),
          exercise("d4-hipthrust", 3, "8–12", 90, "Cadera extendida, no hiperextender espalda", [alt("Hip thrust Smith", "smith hip thrust"), alt("Hip thrust con mancuerna", "dumbbell hip thrust"), alt("Hip thrust en máquina", "machine hip thrust")], { main: true }),
          exercise("d4-bulgarian", 2, "8–10/lado", 90, "Apóyate si hace falta equilibrio", [alt("Sentadilla búlgara", "dumbbell single leg split squat")]),
          exercise("d4-legcurl", 3, "10–15", 75, "Sin balanceo", [alt("Curl femoral máquina/polea", "lever lying leg curl"), alt("Curl femoral máquina sentado", "lever seated leg curl")]),
          exercise("d4-calf", 2, "12–20", 60, "Recorrido completo cómodo", [alt("Elevación de talones", "lever standing calf raise")]),
          exercise("d4-crunch", 2, "12–15", 60, "Flexionar tronco, no tirar con brazos", [alt("Crunch en polea", "cable kneeling crunch"), alt("Dead bug", "dead bug")], { tag: "core" }),
        ], "Alternativas: Smith ↔ mancuernas / máquina equivalente; jalón ↔ dominadas asistidas; zancada ↔ step-up; crunch ↔ dead bug. Elige la variante estable que puedas hacer sin dolor."),
      ],
    },
  },
  week: [
    { id: "mon", label: "Lunes", activity: "Torso A", dayId: "d1" },
    { id: "tue", label: "Martes", activity: "Piernas A + abdomen", dayId: "d2" },
    { id: "wed", label: "Miércoles", activity: "Caminar rápido / bici + movilidad", type: "cardio" },
    { id: "thu", label: "Jueves", activity: "Torso B", dayId: "d3" },
    { id: "fri", label: "Viernes", activity: "Piernas B + core", dayId: "d4" },
    { id: "sat", label: "Sábado", activity: "Cardio moderado + movilidad", type: "cardio" },
    { id: "sun", label: "Domingo", activity: "Descanso", type: "rest" },
  ],
  phases: [
    { from: 1, to: 2, title: "Aprender cargas", rir: "RIR 2–3", detail: "Ajusta duración. Si hay fatiga, empieza con 2 series en accesorios.", cardio: "25 min caminata rápida, bici o elíptica (mié y sáb). Que puedas hablar en frases.", cardioMinutes: 25, steps: "6.500–7.000" },
    { from: 3, to: 4, title: "Series completas", rir: "RIR 1–2", detail: "Usa todas las series previstas. Progresa si completas los rangos.", cardio: "35 min (mié y sáb). Si es fácil, suma caminatas cortas lejos de las pesas.", cardioMinutes: 35, steps: "7.000–8.000" },
    { from: 5, to: 7, title: "Consolidar", rir: "RIR 1–2", detail: "Mismas series; sube carga o reps, no volumen automáticamente.", cardio: "35 min mié + 35 min sáb + 20 min caminata rápida 4 mañanas = 150 min/semana.", cardioMinutes: 35, steps: "8.000–9.000" },
    { from: 8, to: 8, title: "Descarga y medición", rir: "RIR 3–4", detail: "50–60 % de las series. Revisa cintura, peso medio y cargas.", cardio: "35 min mié + 35 min sáb + caminatas suaves.", cardioMinutes: 35, steps: "8.000–9.000", deload: true },
  ],
  warmup: "0–7 min: movilidad dinámica y calentamiento específico; 1–2 series ligeras del primer ejercicio (no cuentan). Últimos 5–10 min: caminata suave si queda tiempo.",
  cardio: {
    liss: "Miércoles y sábado: caminata rápida, bici o elíptica a ritmo en el que puedas hablar en frases. Termina fresco.",
    hiit: "No necesitas HIIT para definir. La actividad moderada suma gasto sin competir con la fuerza.",
    steps: "Sube los pasos según tolerancia: 6.500–7.000 → 7.000–8.000 → 8.000–9.000.",
  },
  nutrition: {
    proteinTarget: 170,
    calorieTarget: 2350,
    fatTarget: 70,
    fiberTarget: "25–35 g",
    note: "Punto de partida si sigues cerca de 185 lb (84 kg): 2.250–2.450 kcal/día durante 2 semanas. Recalibra con tu peso y cintura actuales.",
    foods: [
      { id: "eggs", name: "2 huevos + 3 claras", protein: 23, calories: 245 },
      { id: "oats", name: "Avena · 60 g", protein: 8, calories: 230 },
      { id: "yogurt", name: "Yogur griego alto en proteína", protein: 20, calories: 140 },
      { id: "whey", name: "Batido de proteína", protein: 25, calories: 120 },
      { id: "chicken", name: "Pollo o pavo · 150 g", protein: 45, calories: 245 },
      { id: "fish", name: "Pescado blanco · 180 g", protein: 40, calories: 190 },
      { id: "beef", name: "Carne magra · 150 g", protein: 35, calories: 290 },
      { id: "tofu", name: "Tofu firme · 150 g", protein: 22, calories: 215 },
      { id: "legumes", name: "Legumbres · 1 taza", protein: 15, calories: 230 },
      { id: "rice", name: "Arroz cocido · 1 taza", protein: 4, calories: 205 },
      { id: "potato", name: "Patata · 250 g", protein: 5, calories: 215 },
      { id: "fruit", name: "Fruta · 1 pieza", protein: 1, calories: 95 },
      { id: "oil", name: "Aceite de oliva · 1 cda", protein: 0, calories: 120 },
    ],
  },
};

// Demostraciones verificadas a mano. `gif` es la ruta exacta en ExerciseGymGifsDB
// (sin búsqueda difusa); `youtube` es un video corto de técnica que se puede embeber.
// Las claves son el campo `search` de cada alternativa; si el coach IA cambia
// el ejercicio, su nuevo `search` cae al buscador del servidor.
export const GIF_CDN = "https://cdn.jsdelivr.net/gh/JahelCuadrado/ExerciseGymGifsDB@v1.1.0/";
export const EXERCISE_MEDIA = {
  "smith bench press": { gif: "pectorals/smith-bench-press.gif", youtube: "CQ6V6o7VXcQ" },
  "dumbbell bench press": { gif: "pectorals/dumbbell-bench-press.gif" },
  "lever chest press": { gif: "pectorals/lever-chest-press.gif" },
  "cable pulldown": { gif: "lats/cable-pulldown.gif", youtube: "oLQj4fySWQQ" },
  "assisted pull up": { gif: "lats/assisted-pull-up.gif" },
  "dumbbell incline bench press": { gif: "pectorals/dumbbell-incline-bench-press.gif", youtube: "qhKStczz27Q" },
  "lever incline chest press": { gif: "pectorals/lever-incline-chest-press.gif" },
  "cable seated row": { gif: "upper-back/cable-seated-row.gif", youtube: "JtTusrYzAos" },
  "lever seated row": { gif: "upper-back/lever-seated-row.gif" },
  "dumbbell lateral raise": { gif: "delts/dumbbell-lateral-raise.gif", youtube: "hgLpdwMtEEs" },
  "cable lateral raise": { gif: "delts/cable-lateral-raise.gif" },
  "cable pushdown with rope attachment": { gif: "triceps/cable-pushdown-with-rope-attachment.gif", youtube: "uZg6VtRhwQY" },
  "cable pushdown": { gif: "triceps/cable-pushdown.gif" },
  "dumbbell biceps curl": { gif: "biceps/dumbbell-biceps-curl.gif", youtube: "PY9QylAMtyE" },
  "dumbbell hammer curl": { gif: "biceps/dumbbell-hammer-curl.gif" },
  "smith squat": { gif: "glutes/smith-squat.gif", youtube: "4r9o_rqFZX4" },
  "dumbbell goblet squat": { gif: "quads/dumbbell-goblet-squat.gif" },
  "sled 45 leg press": { gif: "glutes/sled-45-leg-press.gif" },
  "dumbbell romanian deadlift": { gif: "glutes/dumbbell-romanian-deadlift.gif", youtube: "yxLk9X5C7RU" },
  "barbell romanian deadlift": { gif: "glutes/barbell-romanian-deadlift.gif" },
  "dumbbell rear lunge": { gif: "glutes/dumbbell-rear-lunge.gif", youtube: "35wjdbdXK-8" },
  "dumbbell step up": { gif: "glutes/dumbbell-step-up.gif" },
  "lever lying leg curl": { gif: "hamstrings/lever-lying-leg-curl.gif", youtube: "9xbBr5Ytl8c" },
  "lever seated leg curl": { gif: "hamstrings/lever-seated-leg-curl.gif", youtube: "CBCPBnMzsMI" },
  "lever standing calf raise": { gif: "calves/lever-standing-calf-raise.gif", youtube: "dMxCXx7CQFo" },
  "sled calf press on leg press": { gif: "calves/sled-calf-press-on-leg-press.gif" },
  "dumbbell standing calf raise": { gif: "calves/dumbbell-standing-calf-raise.gif" },
  // El catálogo solo tiene plancha con disco: mejor el video.
  "front plank": { youtube: "hAqEhJb9oDs" },
  "dead bug": { gif: "abs/dead-bug.gif", youtube: "XkTtXA3-IqU" },
  "dumbbell hip thrust": { youtube: "fWdFKm56euc" },
  "machine hip thrust": { youtube: "gdUC0EFGWfQ" },
  "smith incline bench press": { gif: "pectorals/smith-incline-bench-press.gif", youtube: "Oe1jgXf9f0Q" },
  "dumbbell incline row": { gif: "upper-back/dumbbell-incline-row.gif", youtube: "D6lpHgyDItk" },
  "twin handle parallel grip lat pulldown": { gif: "lats/twin-handle-parallel-grip-lat-pulldown.gif", youtube: "VUJYixXx5I8" },
  "assisted parallel close grip pull up": { gif: "lats/assisted-parallel-close-grip-pull-up.gif" },
  "cable standing fly": { gif: "pectorals/cable-standing-fly.gif", youtube: "WNtBIde3Qks" },
  "lever seated fly": { gif: "pectorals/lever-seated-fly.gif" },
  "dumbbell seated shoulder press": { gif: "delts/dumbbell-seated-shoulder-press.gif", youtube: "GELRUlUSxeI" },
  "lever shoulder press": { gif: "delts/lever-shoulder-press.gif" },
  "smith seated shoulder press": { gif: "delts/smith-seated-shoulder-press.gif" },
  "cable standing rear delt row with rope": { gif: "delts/cable-standing-rear-delt-row-with-rope.gif", youtube: "X-xCQ1gh-kA" },
  "dumbbell rear lateral raise": { gif: "delts/dumbbell-rear-lateral-raise.gif" },
  "cable curl": { gif: "biceps/cable-curl.gif", youtube: "OGI2K-Qc2z0" },
  "cable overhead triceps extension rope attachment": { gif: "triceps/cable-overhead-triceps-extension-rope-attachment.gif", youtube: "P40-DvgM9qI" },
  // No hay GIF de hip thrust en Smith en el catálogo.
  "smith hip thrust": { youtube: "AuBaFFGBoHc" },
  "barbell glute bridge": { gif: "glutes/barbell-glute-bridge.gif" },
  "dumbbell single leg split squat": { gif: "quads/dumbbell-single-leg-split-squat.gif", youtube: "ulNCO1lgv_w" },
  "cable kneeling crunch": { gif: "abs/cable-kneeling-crunch.gif", youtube: "ui3iEsYbXtI" },
};

export function exerciseMedia(search) {
  const media = EXERCISE_MEDIA[String(search || "").toLowerCase().trim()];
  if (!media) return null;
  return { gif: media.gif ? `${GIF_CDN}${media.gif}` : null, youtube: media.youtube || null };
}

// getDay(): 0 = domingo … 6 = sábado.
export const WEEKDAY_IDS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

// Contenido de referencia del PDF para consultar en el gimnasio (no se guarda en la BD).
export const PLAN_GUIDE = {
  profile: {
    stats: [
      { label: "Edad", value: "30 años" },
      { label: "Sueño medio", value: "6,8 h" },
      { label: "Pasos/día", value: "6.137" },
      { label: "Pulso reposo", value: "53 lpm" },
    ],
    source: "Apple Health (sep–oct 2026): sueño 21 noches, pasos 30 días, pulso 15 días. Registro parcial.",
    goal: "Mejorar la composición corporal —menos grasa y más definición— sin perder músculo ni fuerza. No perseguir una bajada rápida en la báscula.",
    pending: "Peso de referencia ≈185 lb (84 kg) de junio de 2026, no verificado. Las calorías son un punto de partida: ajústalas con tu peso y cintura actuales.",
    medical: "Es una propuesta general de entrenamiento y nutrición, no una valoración médica. Si hay dolor, lesión, síntomas cardiacos o restricciones clínicas, adapta el plan con un profesional.",
  },
  rules: [
    { title: "RIR · repeticiones en reserva", text: "RIR 2 = terminar la serie sintiendo que podrías hacer otras dos repeticiones con buena técnica. Semanas 1–2: RIR 2–3; después, normalmente RIR 1–2. No hace falta llegar al fallo." },
    { title: "Doble progresión", text: "Ejemplo: press plano 3 × 6–8. Si haces 8, 8 y 8 con buena técnica y 1–2 reps en reserva, sube la carga la próxima vez (el menor incremento: ≈2–5 % en torso y 2–10 % en piernas). Vuelve al extremo bajo del rango y repite. Si no llegas al mínimo o la técnica empeora, mantén o baja la carga." },
    { title: "Descansos", text: "120 s en sentadilla, peso muerto rumano y press principal (hasta ~180 s si no recuperas respiración o fuerza). 75–90 s en remos, jalones, hip thrust y movimientos medianos. 60 s en aislados y abdomen. En superserie, el descanso cuenta tras la pareja." },
    { title: "Control de fatiga (antes de entrenar)", text: "Verde: descansado, sin dolor → rutina completa. Amarillo: dos noches de mal sueño, fatiga notable o agujetas fuertes → quita 1 serie de cada accesorio y evita el fallo. Rojo: fiebre, mareo, dolor torácico, falta de aire inusual, lesión aguda → no entrenes y busca atención; ante dolor torácico intenso o dificultad respiratoria, atención urgente." },
    { title: "Si se termina la técnica, se termina la serie", text: "Registra peso (siempre en la misma unidad), reps reales, RIR aproximado y si la completaste. Guarda también duración, sueño, dolor y una nota corta." },
    { title: "Si te saltas un día", text: "No hay que \"recuperar\" sesiones. Haz el siguiente entrenamiento de fuerza pendiente y, cuando sea posible, deja al menos un día de descanso entre piernas intensas." },
    { title: "Por qué 4 días y no 6", text: "El volumen semanal (≈10 series por músculo) importa más que entrenar más días a igual volumen. Cuatro días dejan margen para descansar y dormir." },
  ],
  recovery: [
    { title: "Dormir antes de sumar entreno", text: "Prioriza al menos 7 h (idealmente 7–9) y horario regular. Si falta tiempo, conserva las series importantes y recorta cardio opcional antes que sueño." },
    { title: "Mide rendimiento, no calorías del reloj", text: "Las calorías del Apple Watch no son exactas. Evalúa con cintura + peso promedio + cargas/reps + recuperación." },
  ],
  tracking: [
    { metric: "Peso medio (no el de un día)", when: "3–5 mañanas/semana", look: "Tendencia gradual" },
    { metric: "Cintura (misma altura)", when: "1 vez/semana", look: "Tendencia descendente" },
    { metric: "Carga y reps de 4 ejercicios base", when: "Cada sesión", look: "Mantener o subir" },
    { metric: "Sueño y fatiga (1–5)", when: "Diaria", look: "Recuperación suficiente" },
    { metric: "Pasos y minutos moderados", when: "Diaria / semana", look: "Progreso sostenible" },
  ],
  success: "Buen resultado a las 8 semanas = cintura menor y rendimiento mantenido o mejorado, con o sin gran caída en la báscula. Si bajas kilos pero pierdes mucha fuerza y te sientes agotado, hace falta menos déficit o menos carga. Foto opcional con la misma luz cada 2–4 semanas.",
  nutrition: {
    macros: [
      { label: "Proteína", value: "~170 g", note: "Rango 150–185 g si ≈84 kg · mantener/ganar músculo en déficit" },
      { label: "Grasas", value: "60–75 g", note: "Suficiencia dietética y saciedad" },
      { label: "Carbohidratos", value: "Resto", note: "Combustible para las sesiones" },
      { label: "Fibra", value: "25–35 g", note: "Subir gradualmente" },
      { label: "Agua", value: "Según sed", note: "Más con calor o sudor" },
    ],
    example: "Ejemplo de 2.300 kcal: 170 g proteína (680 kcal) + 70 g grasa (630 kcal) + ~248 g carbohidratos (992 kcal). Posible, no obligatorio.",
    meals: [
      { label: "Desayuno", text: "Huevos y claras + avena + fruta; o yogur griego + cereal integral." },
      { label: "Almuerzo", text: "Pollo, pavo o tofu + arroz/patata + verduras + aceite de oliva medido." },
      { label: "Merienda", text: "Yogur alto en proteína o batido; fruta." },
      { label: "Cena", text: "Pescado, carne magra o legumbres + verduras + carbohidratos según presupuesto." },
    ],
    review: "Cada 2 semanas: pésate por la mañana 3–5 días/semana y compara promedios; cintura 1 vez/semana. Busca ≈0,25–0,5 % del peso/semana. Si el peso se mantiene pero baja la cintura y sube la fuerza, no recortes. Si nada cambia en 2–3 semanas con registro fiable, prueba 100–150 kcal menos/día o algo más de caminata. Si caen fuerza, sueño o energía, revisa primero recuperación y déficit.",
    creatine: "Creatina monohidrato (opcional): 3–5 g/día es la dosis habitual en adultos sanos. No cambies la suplementación sin consultar si hay enfermedad renal o indicación médica. Hinchazón abdominal persistente, dolor o cambios intestinales importantes no son \"grasa\".",
  },
  evidence: [
    { title: "ACSM 2026 — position stand", text: "≈10 series/semana por músculo; a igual volumen, más frecuencia no garantiza más; fallo no obligatorio.", url: "https://pubmed.ncbi.nlm.nih.gov/41843416/" },
    { title: "Metaanálisis 2025 — superseries", text: "Ahorran tiempo con adaptaciones similares; más esfuerzo percibido.", url: "https://pubmed.ncbi.nlm.nih.gov/39903375/" },
    { title: "Ensayo 2024 — superseries multiarticulares", text: "Menos fuerza en jalones/remos con superseries pesadas: por eso los básicos van separados.", url: "https://pubmed.ncbi.nlm.nih.gov/39072654/" },
    { title: "Metaanálisis 2024 — descanso entre series", text: "Más de 60 s puede favorecer hipertrofia; poca mejora media más allá de 90 s.", url: "https://pubmed.ncbi.nlm.nih.gov/39205815/" },
    { title: "Metaanálisis 2025 — pesas en pérdida de grasa", text: "Añadir fuerza a la dieta conserva masa magra y mejora la fuerza.", url: "https://pubmed.ncbi.nlm.nih.gov/40909191/" },
    { title: "ISSN 2026 — dietas para reducir peso", text: "Fuerza + 1,6–2,2 g/kg/día de proteína reducen la pérdida de músculo.", url: "https://pubmed.ncbi.nlm.nih.gov/42867412/" },
    { title: "CDC — actividad física en adultos", text: "150 min/semana de aeróbico moderado + 2 días de fuerza.", url: "https://www.cdc.gov/physical-activity-basics/guidelines/adults.html" },
    { title: "CDC — sueño en adultos", text: "18–60 años: 7 h o más por noche.", url: "https://www.cdc.gov/sleep/about/index.html" },
  ],
};
