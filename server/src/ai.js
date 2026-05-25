// Workout-plan generation via OpenRouter (OpenAI-compatible chat completions).
// Returns a `days` array matching the frontend schema so it renders directly.

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = process.env.OPENROUTER_MODEL || "anthropic/claude-3.5-sonnet";

const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

const SYSTEM_PROMPT = `You are an elite strength & hypertrophy coach. You design weekly gym programs.
Respond with ONLY valid JSON (no markdown, no prose). The JSON must be an object:
{
  "meta": { "summary": "<one-line plan summary>" },
  "days": [
    {
      "key": "mon",            // one of: mon tue wed thu fri sat sun
      "label": "Lun",          // short label (Spanish day abbreviation)
      "title": "<session title>",
      "focus": "<muscle groups>",
      "duration": "<e.g. 80-90 min>",
      "desc": "<short Spanish description of the session>",
      "exercises": [
        {
          "name": "<English exercise name>",
          "search": "<lowercase ExerciseDB lookup term, e.g. 'barbell bench press'>",
          "sets": "<e.g. '4'>",
          "reps": "<e.g. '8' or 'AMRAP'>",
          "rest": "<e.g. '90s'>",
          "cue": "<English form cue>",
          "abs": false           // true only for direct ab/core work
        }
      ]
    }
  ]
}
Rules: descriptions and labels in Spanish, exercise names and cues in English (mirror the user's existing program style). Each training day has 6-10 exercises. Use realistic ExerciseDB-style lowercase search terms. Include rest days only if requested.`;

export async function generatePlan({ goals, daysPerWeek = 5, equipment, experience, notes } = {}) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not configured");

  const userPrompt = [
    `Generate a ${daysPerWeek}-day weekly training plan.`,
    goals && `Goals: ${goals}.`,
    experience && `Experience level: ${experience}.`,
    equipment && `Available equipment: ${equipment}.`,
    notes && `Extra notes: ${notes}.`,
    `Use day keys from this set in order: ${DAY_KEYS.slice(0, daysPerWeek).join(", ")}.`,
  ]
    .filter(Boolean)
    .join(" ");

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.PUBLIC_URL || "http://localhost",
      "X-Title": "Adam Shred",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`OpenRouter ${res.status}: ${detail.slice(0, 500)}`);
  }

  const json = await res.json();
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty AI response");

  const parsed = parseJson(content);
  const days = validateDays(parsed.days);
  return { days, meta: parsed.meta || {} };
}

// Models sometimes wrap JSON in ```json fences despite instructions — strip them.
function parseJson(text) {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    throw new Error("AI did not return valid JSON");
  }
}

function validateDays(days) {
  if (!Array.isArray(days) || days.length === 0) throw new Error("AI plan has no days");
  return days.map((d, i) => ({
    key: DAY_KEYS.includes(d.key) ? d.key : DAY_KEYS[i % 7],
    label: String(d.label || d.key || "Día"),
    title: String(d.title || "Sesión"),
    focus: String(d.focus || ""),
    duration: String(d.duration || ""),
    desc: String(d.desc || ""),
    exercises: Array.isArray(d.exercises)
      ? d.exercises.map((e) => ({
          name: String(e.name || "Exercise"),
          search: String(e.search || e.name || "").toLowerCase(),
          sets: String(e.sets ?? ""),
          reps: String(e.reps ?? ""),
          rest: String(e.rest ?? ""),
          cue: String(e.cue || ""),
          abs: Boolean(e.abs),
        }))
      : [],
  }));
}
