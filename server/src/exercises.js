const OSS_BASE = "https://oss.exercisedb.dev/api/v1/exercises";
const RAPID_HOST = "edb-with-gifs-and-images-by-ascendapi.p.rapidapi.com";
const RAPID_BASE = `https://${RAPID_HOST}/api/v1/exercises`;
const COMMUNITY_BASE = "https://cdn.jsdelivr.net/gh/JahelCuadrado/ExerciseGymGifsDB@v1.1.0";
const COMMUNITY_INDEX = `${COMMUNITY_BASE}/api/en/exercises.json`;
const COMMUNITY_ALIASES = new Map([
  ["barbell standing military press", "barbell standing wide military press"],
  ["cable face pull", "cable standing rear delt row with rope"],
  ["cable cross over", "cable standing up straight crossovers"],
  ["front plank", "weighted front plank"],
  ["side plank", "bodyweight incline side plank"],
  ["wheel rollout", "wheel rollerout"],
  ["lever pec deck fly", "lever seated fly"],
  // Nombres habituales que devuelve la importación de PDF.
  ["dumbbell bulgarian split squat", "dumbbell single leg split squat"],
  ["bulgarian split squat", "dumbbell single leg split squat"],
  ["cable triceps pushdown rope", "cable pushdown with rope attachment"],
  ["cable rope pushdown", "cable pushdown with rope attachment"],
  ["cable lat pulldown", "cable pulldown"],
  ["lat pulldown", "cable pulldown"],
  ["cable neutral grip lat pulldown", "twin handle parallel grip lat pulldown"],
  ["standing calf raise", "lever standing calf raise"],
  ["cable overhead triceps extension", "cable overhead triceps extension rope attachment"],
  ["chest supported dumbbell row", "dumbbell incline row"],
  ["cable fly", "cable standing fly"],
]);
const STATIC_BASE = "https://static.exercisedb.dev/media/";
const cache = new Map();
const CACHE_MS = 7 * 24 * 60 * 60 * 1000;
const FAILED_CACHE_MS = 5 * 60 * 1000;
let communityCatalogPromise = null;

function normalizeList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.data?.exercises)) return data.data.exercises;
  if (Array.isArray(data?.exercises)) return data.exercises;
  if (Array.isArray(data?.results)) return data.results;
  return [];
}

function norm(value) {
  return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

function bestMatch(search, list) {
  const wanted = norm(search);
  const words = wanted.split(" ").filter((word) => word.length > 2);
  return list
    .map((item) => {
      const name = norm(item.name || item.exerciseName);
      const hits = words.filter((word) => name.includes(word)).length;
      const score = name === wanted ? 1000 : name.includes(wanted) || wanted.includes(name) ? 500 : hits * 20;
      return { item, score, hits };
    })
    // Con 3 palabras o menos deben coincidir todas: "smith hip thrust" no debe caer en "smith hip raise".
    .filter(({ score, hits }) => score >= 500 || hits >= Math.max(2, words.length > 3 ? words.length - 1 : words.length))
    .sort((a, b) => b.score - a.score)[0]?.item || null;
}

async function fetchJson(url, headers = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, { headers: { accept: "application/json", ...headers }, signal: controller.signal });
    if (!response.ok) throw new Error(`exercise upstream ${response.status}`);
    return response.json();
  } finally {
    clearTimeout(timer);
  }
}

async function loadCommunityCatalog() {
  if (!communityCatalogPromise) {
    communityCatalogPromise = fetchJson(COMMUNITY_INDEX)
      .then(normalizeList)
      .catch((error) => {
        communityCatalogPromise = null;
        throw error;
      });
  }
  return communityCatalogPromise;
}

function communityGif(item) {
  const url = String(item?.gifUrl || "");
  return url.startsWith(`${COMMUNITY_BASE}/`) ? url : null;
}

export async function findExerciseGif(rawSearch) {
  const search = norm(rawSearch).slice(0, 100);
  if (!search) return null;
  const cached = cache.get(search);
  const cacheTtl = cached?.value ? CACHE_MS : FAILED_CACHE_MS;
  if (cached && Date.now() - cached.at < cacheTtl) return cached.value;

  let list = [];
  let communityMatch = null;
  let rapidMatch = null;
  try {
    const communitySearch = COMMUNITY_ALIASES.get(search) || search;
    const candidate = bestMatch(communitySearch, await loadCommunityCatalog());
    if (communityGif(candidate)) communityMatch = candidate;
  } catch (error) {
    console.warn("[exercise] Community GIF lookup failed", error.message);
  }

  if (!communityMatch && process.env.RAPIDAPI_KEY) {
    try {
      const rapidHeaders = {
        "X-RapidAPI-Key": process.env.RAPIDAPI_KEY,
        "X-RapidAPI-Host": RAPID_HOST,
      };
      const terms = [search, ...search.split(" ").filter((word) => word.length > 3).reverse()];
      for (const term of [...new Set(terms)]) {
        list = normalizeList(await fetchJson(
          `${RAPID_BASE}/search?search=${encodeURIComponent(term)}`,
          rapidHeaders,
        ));
        if (list.length) break;
      }
      rapidMatch = bestMatch(search, list);
      const rapidId = rapidMatch?.exerciseId || rapidMatch?.id;
      if (rapidId && !rapidMatch?.gifUrls && !rapidMatch?.gifUrl) {
        const detail = await fetchJson(`${RAPID_BASE}/${encodeURIComponent(rapidId)}`, rapidHeaders);
        rapidMatch = detail?.data || detail;
      }
    } catch (error) {
      console.warn("[exercise] RapidAPI lookup failed", error.message);
    }
  }

  if (!communityMatch && !rapidMatch) {
    const urls = [
      `${OSS_BASE}/search?search=${encodeURIComponent(search)}`,
      `${OSS_BASE}/name/${encodeURIComponent(search)}?limit=12`,
    ];
    for (const url of urls) {
      try {
        list = normalizeList(await fetchJson(url));
        if (list.length) break;
      } catch (error) {
        console.warn("[exercise] OSS lookup failed", error.message);
      }
    }
  }

  const match = communityMatch || rapidMatch || bestMatch(search, list);
  const id = match?.exerciseId || match?.id || match?._id || match?.exercise_id;
  const gif = communityGif(match)
    || match?.gifUrls?.["360p"]
    || match?.gifUrls?.["480p"]
    || match?.gifUrls?.["720p"]
    || match?.gifUrls?.["1080p"]
    || match?.gifUrl
    || match?.gif
    || match?.mediaUrl
    || (match?.exerciseId && !match?.gifUrls ? `${STATIC_BASE}${match.exerciseId}.gif` : null);
  const value = gif ? { gif, id: String(id || ""), name: match?.name || search } : null;
  cache.set(search, { value, at: Date.now() });
  return value;
}
