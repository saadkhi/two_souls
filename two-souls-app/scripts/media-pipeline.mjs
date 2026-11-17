#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync, statSync, existsSync } from 'node:fs';
import { basename, dirname, join, resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { buildNanoBananaPrompt } from '../src/vendor/open-generative-ai/promptUtils.js';
import { resolveValues, applyInputs } from '../src/vendor/freefield/bindings.js';

export const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const APPS = ['cinema-studio', 'cinema-video', 'upscale', 'upscale-video', 'smooth'];
export const PROVENANCE = {
  openGenerativeAI: { repository: 'https://github.com/Anil-matcha/Open-Generative-AI.git', commit: 'eeccd4f108c5c19dda0c3650adc2845104082b41', source: 'src/lib/promptUtils.js', license: 'MIT' },
  freefield: { repository: 'https://github.com/neuregex/freefield.git', commit: 'f3d32ce2e3128c58bb2fe38c8942edf87cdb2e4c', source: 'server/runner.ts and apps/*', license: 'MIT' },
};
export const PERFUME_PROMPT = 'Two Souls Noir Oud perfume, a thick clear glass flacon filled with translucent amber fragrance, dark green foil label, brushed gold atomizer and ribbed dark cap. Physical glass refraction, realistic liquid meniscus, restrained emerald and gold studio reflections, subtle surface imperfections, premium commercial product photography. Preserve the bottle geometry and label typography.';
const vendor = join(PROJECT_ROOT, 'src/vendor/freefield/apps');
const hash = value => createHash('sha256').update(value).digest('hex');
const json = value => JSON.stringify(value, null, 2) + '\n';
const readJSON = path => JSON.parse(readFileSync(path, 'utf8'));

export function loadApp(id) {
  if (!APPS.includes(id)) throw new Error(`Unsupported app "${id}". Choose ${APPS.join(', ')}.`);
  const folder = join(vendor, id);
  return { app: readJSON(join(folder, 'app.json')), graph: readJSON(join(folder, 'workflow.api.json')) };
}

function optionValue(app, id, label) {
  const input = app.inputs.find(input => input.id === id);
  const option = input?.options?.find(option => option.label === label || String(option.value) === String(label));
  if (!option) throw new Error(`${id}: "${label}" is not one of the options.`);
  return option.value;
}

function optionLabel(app, id, value) {
  return app.inputs.find(input => input.id === id)?.options?.find(option => option.value === value)?.label ?? String(value);
}

export function createPlan({ app: id, inputs = {}, files = {}, prompt = PERFUME_PROMPT, seed = 221, camera = 'Full-Frame Cine Digital', lens = 'Premium Modern Prime', focalLength = 50, aperture = 'f/4', preset } = {}) {
  const { app, graph } = loadApp(id);
  const keys = new Set(app.inputs.map(input => input.id));
  for (const key of [...Object.keys(inputs), ...Object.keys(files)]) {
    if (!keys.has(key)) throw new Error(`${id}: unknown input "${key}".`);
  }
  if (!Number.isSafeInteger(Number(seed)) || Number(seed) < 0 || Number(seed) > 2 ** 48 - 1) throw new Error('seed must be a nonnegative integer below 2^48.');
  const values = {};
  let compiledPrompt = null;
  if (id.startsWith('cinema-')) {
    Object.assign(values, {
      camera: optionValue(app, 'camera', camera), lens: optionValue(app, 'lens', lens),
      focal: optionValue(app, 'focal', `${focalLength} mm`), aperture: optionValue(app, 'aperture', aperture),
      palette: optionValue(app, 'palette', 'Emerald and gold'),
      lighting: optionValue(app, 'lighting', 'Soft cross'),
    });
  }
  if (keys.has('seed')) values.seed = Number(seed);
  Object.assign(values, inputs);
  // The deterministic bundle must never fall back to the upstream random-seed sentinel.
  if (keys.has('seed') && (!Number.isSafeInteger(Number(values.seed)) || Number(values.seed) < 0 || Number(values.seed) >= 2 ** 48)) throw new Error('seed must be a nonnegative integer below 2^48.');
  if (id.startsWith('cinema-')) {
    const resolvedLook = resolveValues(app, { ...values, prompt: String(inputs.prompt ?? prompt) });
    const basePrompt = String(inputs.prompt ?? prompt).trim();
    if (!basePrompt) throw new Error('The perfume prompt cannot be empty.');
    compiledPrompt = buildNanoBananaPrompt(basePrompt,
      optionLabel(app, 'camera', resolvedLook.camera), optionLabel(app, 'lens', resolvedLook.lens),
      Number.parseInt(optionLabel(app, 'focal', resolvedLook.focal), 10), optionLabel(app, 'aperture', resolvedLook.aperture));
    values.prompt = compiledPrompt;
  }
  const assets = [];
  for (const input of app.inputs.filter(input => ['image', 'video', 'audio'].includes(input.type))) {
    const path = files[input.id];
    if (!path) throw new Error(`${input.id}: required file; use --file ${input.id}=/path/to/file.`);
    const source = resolve(path), stat = statSync(source);
    if (!stat.isFile()) throw new Error(`${input.id}: expected a regular file.`);
    if (input.limits?.max_mb && stat.size > input.limits.max_mb * 1e6) throw new Error(`${input.id}: file is over ${input.limits.max_mb} MB.`);
    const name = `${input.id}-${basename(source).replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const bytes = new Uint8Array(readFileSync(source));
    values[input.id] = { bytes, name };
    assets.push({ input: input.id, name, bytes, sha256: hash(bytes), size: bytes.length });
  }
  const resolved = resolveValues(app, values);
  applyInputs(app, resolved, {
    setInput(node, field, value) {
      if (!graph[node] || !Object.hasOwn(graph[node].inputs, field)) throw new Error(`${id}: binding ${node}.${field} does not exist in the workflow.`);
      graph[node].inputs[field] = value;
    },
  }, file => file.name, preset);
  const serializableValues = Object.fromEntries(Object.entries(resolved).filter(([, value]) => !(value?.bytes instanceof Uint8Array)));
  return {
    app, graph, assets, compiledPrompt,
    job: { schemaVersion: 1, app: id, preset: preset ?? null, values: serializableValues, assets: assets.map(({ bytes, ...asset }) => ({ ...asset, path: `assets/${asset.name}` })), provenance: PROVENANCE, workflowSHA256: hash(json(graph)) },
  };
}

export function prepareBundle(options, directory = join(PROJECT_ROOT, '.output/media-pipeline', options.app ?? 'job')) {
  const plan = createPlan(options), output = resolve(directory);
  mkdirSync(join(output, 'assets'), { recursive: true });
  for (const asset of plan.assets) writeFileSync(join(output, 'assets', asset.name), asset.bytes);
  writeFileSync(join(output, 'job.json'), json(plan.job));
  writeFileSync(join(output, 'workflow.api.json'), json(plan.graph));
  writeFileSync(join(output, 'app.json'), json(plan.app));
  writeFileSync(join(output, 'requirements.json'), json({
    backend: 'Comfy API v2 gateway/proxy backed by ComfyUI; GPU and declared model files required',
    app: plan.app.id, pack: plan.app.pack, models: plan.app.models, credits: plan.app.credits ?? [],
    inputs: plan.app.inputs.filter(input => input.limits).map(input => ({ id: input.id, limits: input.limits })),
    generated: false,
  }));
  if (plan.compiledPrompt) writeFileSync(join(output, 'cinematic-brief.txt'), plan.compiledPrompt + '\n');
  return { output, job: plan.job, generated: false };
}

export function buildRunSpec(bundleDirectory, outputDirectory, env = process.env) {
  if (!env.COMFY_BASE_URL?.trim()) throw new Error('AI execution is not configured. Set COMFY_BASE_URL to your Freefield/Comfy API v2 gateway; add FREEFIELD_TOKEN when its gateway requires authentication. Preparing a bundle does not run a GPU job.');
  let url;
  try { url = new URL(env.COMFY_BASE_URL); } catch { throw new Error('COMFY_BASE_URL must be an HTTP(S) gateway URL.'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Use an HTTP(S) COMFY_BASE_URL without embedded credentials; supply FREEFIELD_TOKEN through the environment.');
  const bundle = resolve(bundleDirectory), job = readJSON(join(bundle, 'job.json'));
  if (job.schemaVersion !== 1 || !APPS.includes(job.app)) throw new Error('This is not a supported media pipeline bundle.');
  if (job.provenance?.freefield?.commit !== PROVENANCE.freefield.commit) throw new Error('The bundle uses a different Freefield revision; prepare it again with this project.');
  if (hash(readFileSync(join(bundle, 'workflow.api.json'))) !== job.workflowSHA256) throw new Error('The prepared workflow has changed; prepare the bundle again before executing.');
  const freefieldRoot = resolve(env.FREEFIELD_ROOT || join(PROJECT_ROOT, '../freefield'));
  const cli = join(freefieldRoot, 'server/cli.ts');
  if (!existsSync(cli)) throw new Error('Freefield checkout not found. Clone the repository and set FREEFIELD_ROOT to that checkout.');
  if (!existsSync(join(freefieldRoot, 'node_modules/@comfyorg/sdk')) || !existsSync(join(freefieldRoot, 'node_modules/ajv'))) throw new Error('Freefield runner dependencies are missing. Run npm install in the Freefield checkout, then retry.');
  for (const filename of ['app.json', 'workflow.api.json']) {
    const selected = join(freefieldRoot, 'apps', job.app, filename);
    if (!existsSync(selected) || hash(readFileSync(selected)) !== hash(readFileSync(join(vendor, job.app, filename)))) throw new Error('The Freefield checkout app differs from the pinned project workflow. Use the documented revision or update and revalidate the integration.');
  }
  const values = { ...job.values }, files = {};
  for (const asset of job.assets ?? []) {
    const path = resolve(bundle, asset.path), rel = relative(bundle, path);
    if (rel.startsWith('..') || isAbsolute(rel)) throw new Error('An input asset escapes the bundle directory.');
    if (hash(readFileSync(path)) !== asset.sha256) throw new Error(`${asset.input}: bundled asset has changed; prepare the bundle again.`);
    files[asset.input] = path;
  }
  // Re-bind before execution so edited values cannot silently diverge from the exported graph.
  const { app, graph } = loadApp(job.app);
  const raw = { ...values };
  for (const [input, path] of Object.entries(files)) raw[input] = { bytes: new Uint8Array(readFileSync(path)), name: basename(path) };
  const resolvedValues = resolveValues(app, raw);
  applyInputs(app, resolvedValues, { setInput(node, field, value) { graph[node].inputs[field] = value; } }, file => file.name, job.preset ?? undefined);
  if (hash(json(graph)) !== job.workflowSHA256) throw new Error('Bundle values and workflow differ; prepare the bundle again.');
  const args = ['--experimental-strip-types', '--disable-warning=ExperimentalWarning', cli, 'app', job.app];
  for (const [key, value] of Object.entries(values)) args.push('--set', `${key}=${Array.isArray(value) ? JSON.stringify(value) : String(value)}`);
  for (const [key, path] of Object.entries(files)) args.push('--file', `${key}=${path}`);
  if (job.preset) args.push('--preset', job.preset);
  args.push('--out', resolve(outputDirectory ?? join(bundle, 'results')));
  return { command: process.execPath, args, cwd: freefieldRoot, env: { ...env } };
}

export function runBundle(bundleDirectory, outputDirectory, { env = process.env, spawn = spawnSync } = {}) {
  const spec = buildRunSpec(bundleDirectory, outputDirectory, env);
  const result = spawn(spec.command, spec.args, { cwd: spec.cwd, env: spec.env, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  const redact = text => env.FREEFIELD_TOKEN ? String(text ?? '').split(env.FREEFIELD_TOKEN).join('[REDACTED]') : String(text ?? '');
  if (result.error) throw new Error(`Could not start the Freefield runner: ${redact(result.error.message)}`);
  return { status: result.status ?? 1, stdout: redact(result.stdout), stderr: redact(result.stderr) };
}

export function parseArguments(args) {
  const [command, ...rest] = args, options = { inputs: {}, files: {} };
  for (let i = 0; i < rest.length; i++) {
    const flag = rest[i], value = rest[++i];
    if (value === undefined) throw new Error(`${flag} needs a value.`);
    if (flag === '--set' || flag === '--file') {
      const split = value.indexOf('=');
      if (split < 1) throw new Error(`${flag} expects name=value.`);
      options[flag === '--set' ? 'inputs' : 'files'][value.slice(0, split)] = value.slice(split + 1);
    } else {
      const names = { '--app': 'app', '--out': 'out', '--bundle': 'bundle', '--prompt': 'prompt', '--seed': 'seed', '--camera': 'camera', '--lens': 'lens', '--focal': 'focalLength', '--aperture': 'aperture', '--preset': 'preset' };
      if (!names[flag]) throw new Error(`Unknown flag ${flag}.`);
      options[names[flag]] = value;
    }
  }
  return { command, options };
}

export function main(args = process.argv.slice(2)) {
  const { command, options } = parseArguments(args);
  if (command === 'prepare') {
    const result = prepareBundle(options, options.out);
    console.log(`Prepared ${result.job.app} bundle: ${result.output}\nNo GPU job was submitted. Models and runtime requirements are listed in requirements.json.`);
    return 0;
  }
  if (command === 'run') {
    if (!options.bundle) throw new Error('run requires --bundle <prepared-directory>.');
    const result = runBundle(options.bundle, options.out);
    process.stdout.write(result.stdout);process.stderr.write(result.stderr);return result.status;
  }
  if (command && command !== 'help') throw new Error(`Unknown command ${command}. Use prepare or run.`);
  console.log('Media pipeline\n  prepare --app <cinema-studio|cinema-video|upscale|upscale-video|smooth> [--prompt text] [--seed 221] [--set name=value] [--file input=/path] [--out directory]\n  run --bundle directory [--out directory]\nAI execution requires a separately configured Freefield Comfy API v2 gateway.');
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.exitCode = main(); } catch (error) { console.error(error.message);process.exitCode = 1; }
}
