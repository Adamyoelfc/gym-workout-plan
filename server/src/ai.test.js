import assert from "node:assert/strict";
import test from "node:test";
import { analyzePlan, applyPlanOperations, buildCalendarContext, buildRescheduleOperations, validatePlanOperations } from "./ai.js";

function fixturePlan() {
  return {
    activeBlock: "A",
    blocks: {
      A: {
        label: "Base",
        days: [
          {
            id: "d1",
            title: "Upper A",
            subtitle: "Tren superior",
            exercises: [{ id: "ex-1", sets: 4, reps: "8-10", tag: "", alternatives: [{ name: "Press banca", search: "barbell bench press" }] }],
          },
          {
            id: "d2",
            title: "Lower A",
            subtitle: "Piernas",
            exercises: [{ id: "ex-2", sets: 3, reps: "8-10", tag: "", alternatives: [{ name: "Sentadilla", search: "barbell squat" }] }],
          },
        ],
      },
    },
    week: [
      { id: "mon", label: "Lunes", activity: "Upper A", dayId: "d1" },
      { id: "tue", label: "Martes", activity: "Lower A", dayId: "d2" },
      { id: "wed", label: "Miércoles", activity: "Cardio LISS · 30 min", type: "cardio" },
      { id: "thu", label: "Jueves", activity: "Upper A", dayId: "d1" },
      { id: "fri", label: "Viernes", activity: "Lower A", dayId: "d2" },
      { id: "sat", label: "Sábado", activity: "Cardio", type: "cardio" },
      { id: "sun", label: "Domingo", activity: "Descanso", type: "rest" },
    ],
    cardio: { liss: "30 min", hiit: "Opcional", steps: "8.000" },
    nutrition: {
      proteinTarget: 150,
      calorieTarget: 2040,
      foods: [{ id: "food-1", name: "Yogur", protein: 20, calories: 130 }],
    },
  };
}

test("calendar context resolves yesterday, today and tomorrow in the user's time zone", () => {
  const context = buildCalendarContext(fixturePlan(), "America/New_York", new Date("2026-08-26T16:00:00Z"));
  assert.equal(context.today.dayKey, "wed");
  assert.equal(context.today.scheduled.activity, "Cardio LISS · 30 min");
  assert.equal(context.yesterday.dayKey, "tue");
  assert.equal(context.yesterday.scheduled.workout.title, "Lower A");
  assert.equal(context.tomorrow.scheduled.workout.title, "Upper A");
});

test("plan tools can replace fields", () => {
  const operations = validatePlanOperations([{ op: "replace", path: "/nutrition/proteinTarget", value: 165 }]);
  const updated = applyPlanOperations(fixturePlan(), operations);
  assert.equal(updated.nutrition.proteinTarget, 165);
});

test("rescheduling preserves calendar IDs while swapping activities", () => {
  const plan = fixturePlan();
  const operations = buildRescheduleOperations(plan, { fromDay: "tue", toDay: "sat", mode: "swap" });
  const updated = applyPlanOperations(plan, operations);
  assert.equal(updated.week[1].id, "tue");
  assert.equal(updated.week[1].activity, "Cardio");
  assert.equal(updated.week[5].id, "sat");
  assert.equal(updated.week[5].activity, "Lower A");
  assert.equal(updated.week[5].dayId, "d2");
});

test("new exercises receive server-generated identifiers", () => {
  const [operation] = validatePlanOperations([{
    op: "add",
    path: "/blocks/A/days/0/exercises/-",
    value: { sets: 3, reps: "10-12", tag: "", alternatives: [{ name: "Remo", search: "cable seated row" }] },
  }]);
  const updated = applyPlanOperations(fixturePlan(), [operation]);
  assert.match(updated.blocks.A.days[0].exercises[1].id, /^ai-exercise-/);
});

test("unsafe identifiers and arbitrary roots are rejected", () => {
  assert.throws(() => validatePlanOperations([{ op: "replace", path: "/blocks/A/days/0/id", value: "hijacked" }]));
  assert.throws(() => validatePlanOperations([{ op: "add", path: "/__proto__/admin", value: true }]));
  assert.throws(() => validatePlanOperations([{ op: "move", from: "/week/1", path: "/week/5" }]));
});

test("analysis uses deterministic plan values", () => {
  const analysis = analyzePlan(fixturePlan());
  assert.equal(analysis.blocks.A.trainingDays, 2);
  assert.equal(analysis.blocks.A.approximateSets, 7);
  assert.equal(analysis.nutrition.proteinTarget, 150);
});
