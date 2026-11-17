// Adapted from Freefield server/runner.ts at f3d32ce2e3128c58bb2fe38c8942edf87cdb2e4c.
// Copyright (c) 2026 Sammir Femat (neuregex). MIT license: ./LICENSE.
// TypeScript annotations removed; file-type predicate inlined to avoid SDK/registry imports.
const isFileInput = input => ["image", "video", "audio"].includes(input.type);

export class InputError extends Error {}

function isFileValue(v) {
  return typeof v === "object" && v !== null && v.bytes instanceof Uint8Array;
}

function coerce(input, raw) {
  switch (input.type) {
    case "number":
    case "slider":
    case "seed": {
      const n = typeof raw === "number" ? raw : Number(raw);
      if (!Number.isFinite(n)) throw new InputError(`${input.id}: expected a number`);
      if (input.min !== undefined && n < input.min) throw new InputError(`${input.id}: must be ≥ ${input.min}`);
      if (input.max !== undefined && n > input.max) throw new InputError(`${input.id}: must be ≤ ${input.max}`);
      return input.type === "seed" ? Math.trunc(n) : n;
    }
    case "toggle":
      return raw === true || raw === "true" || raw === "1" || raw === "on";
    case "select": {
      if (input.multiple) return picks(input, raw);
      const opts = input.options ?? [];
      const hit = opts.find((o) => o.value === raw || String(o.value) === String(raw));
      if (!hit) throw new InputError(`${input.id}: "${String(raw)}" is not one of the options`);
      return hit.value;
    }
    default:
      return raw;
  }
}

/** A multiple select's value: the picked option values in the order picked, no repeats. The form sends a JSON list. */
function picks(input, raw) {
  let list;
  if (Array.isArray(raw)) list = raw;
  else if (typeof raw === "string" && raw.trim().startsWith("[")) {
    try { list = JSON.parse(raw); } catch { throw new InputError(`${input.id}: expected a list`); }
    if (!Array.isArray(list)) throw new InputError(`${input.id}: expected a list`);
  } else list = raw === "" || raw === null || raw === undefined ? [] : [raw];
  const out = [];
  for (const r of list) {
    const hit = (input.options ?? []).find((o) => String(o.value) === String(r));
    if (!hit) throw new InputError(`${input.id}: "${String(r)}" is not one of the options`);
    const v = String(hit.value);
    if (v && !out.includes(v)) out.push(v);
  }
  const max = input.multiple?.max;
  if (max && out.length > max) throw new InputError(`${input.id}: at most ${max}`);
  return out;
}

/** The picks of a multiple select as the one string templates and binds get. */
export function joinPicks(input, list) {
  const items = Array.isArray(list) ? list.map(String).filter(Boolean) : [];
  if (!items.length) return "";
  const m = input.multiple ?? {};
  return `${m.prefix ?? ""}${items.join(m.join ?? ", ")}${m.suffix ?? ""}`;
}

/** Values as the workflow gets them: multiple selects joined. */
export function textValues(app, values) {
  const out = { ...values };
  for (const input of app.inputs) if (input.multiple && values[input.id] !== undefined) out[input.id] = joinPicks(input, values[input.id]);
  return out;
}

/** Fill defaults, coerce types, check required fields. File inputs pass through as FileValue. */
export function resolveValues(app, values) {
  const out = {};
  for (const input of app.inputs) {
    let v = values[input.id];
    // "" is a choice when a select offers it ("Any" in a builder writes nothing); elsewhere it means "use the default"
    const emptyIsOption = input.type === "select" && (Boolean(input.multiple) || (input.options ?? []).some((o) => o.value === ""));
    if (v === undefined || (v === "" && !emptyIsOption)) v = input.default;
    if (input.type === "seed" && (v === undefined || v === -1 || v === "-1")) {
      v = Math.floor(Math.random() * 2 ** 48);
    }
    if (v === undefined) {
      if (input.required || isFileInput(input)) throw new InputError(`${input.id}: required`);
      continue;
    }
    if (isFileInput(input)) {
      if (!isFileValue(v)) throw new InputError(`${input.id}: expected a file`);
      const maxMb = input.limits?.max_mb;
      if (maxMb && v.bytes.byteLength > maxMb * 1e6) throw new InputError(`${input.id}: file is over ${maxMb} MB`);
      out[input.id] = v;
    } else {
      out[input.id] = coerce(input, v);
    }
  }
  return out;
}

export function renderTemplate(template, values) {
  return template
    .replace(/\{([a-z][a-z0-9_]*)\}/g, (_, k) => (values[k] === undefined ? "" : String(values[k])))
    .replace(/\s+,/g, ",")
    .replace(/,\s*,+/g, ",")
    .replace(/\s{2,}/g, " ")
    .trim()
    .replace(/,$/, "");
}

/** A value in an option's or preset's `sets`: a string with {placeholders} is filled like a bind template. */
export function setValue(value, values) {
  return typeof value === "string" && /\{[a-z][a-z0-9_]*\}/.test(value) ? renderTemplate(value, values) : value;
}

/**
 * Apply resolved values and an optional preset to a workflow.
 * `asset` turns a FileValue into whatever the workflow expects (an SDK asset handle).
 */
export function applyInputs(
  app,
  values,
  wf,
  asset,
  presetId,
) {
  values = textValues(app, values);
  for (const input of app.inputs) {
    const v = values[input.id];
    if (v === undefined) continue;
    for (const b of input.bind ?? []) {
      if (b.template) wf.setInput(b.node, b.field, renderTemplate(b.template, values));
      else wf.setInput(b.node, b.field, isFileValue(v) ? asset(v) : v);
    }
    // a select option can carry extra fields (the LoRA that goes with a style, an effect's prompt)
    const chosen = input.type === "select" ? input.options?.find((o) => o.value === v) : undefined;
    for (const s of chosen?.sets ?? []) wf.setInput(s.node, s.field, setValue(s.value, values));
  }
  if (presetId) {
    const preset = (app.presets ?? []).find((p) => p.id === presetId);
    if (!preset) throw new InputError(`preset "${presetId}" does not exist in ${app.id}`);
    for (const s of preset.sets) wf.setInput(s.node, s.field, setValue(s.value, values));
  }
}
