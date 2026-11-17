import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, cpSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { APPS, PROJECT_ROOT, createPlan, prepareBundle, buildRunSpec, runBundle, parseArguments } from './media-pipeline.mjs';

function temp(t) {
  const dir = mkdtempSync(join(tmpdir(), 'perfume-media-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}
const json = path => JSON.parse(readFileSync(path, 'utf8'));
function fakeCheckout(root) {
  const dir = join(root, 'freefield');
  mkdirSync(join(dir, 'server'), { recursive: true });
  writeFileSync(join(dir, 'server/cli.ts'), '// mocked invocation only');
  for (const dependency of ['@comfyorg/sdk', 'ajv']) mkdirSync(join(dir, 'node_modules', dependency), { recursive: true });
  cpSync(join(PROJECT_ROOT, 'src/vendor/freefield/apps'), join(dir, 'apps'), { recursive: true });
  return dir;
}

test('Open Generative AI camera settings compile into real Freefield cinema bindings', () => {
  const plan = createPlan({ app: 'cinema-studio', focalLength: 85, aperture: 'f/11', seed: 42, inputs: { resolution: 2 } });
  assert.match(plan.compiledPrompt, /85mm/);
  assert.match(plan.compiledPrompt, /deep focus clarity/);
  assert.match(plan.compiledPrompt, /ultra-sharp clinical|premium modern prime|modern/);
  assert.match(plan.compiledPrompt, /Two Souls Noir Oud/);
  assert.equal(plan.job.values.seed, 42);
  assert.equal(plan.job.values.resolution, 2);
  for (const binding of plan.app.inputs.find(input => input.id === 'prompt').bind) {
    assert.match(plan.graph[binding.node].inputs[binding.field], /Two Souls Noir Oud/);
    assert.doesNotMatch(plan.graph[binding.node].inputs[binding.field], /\{prompt\}/);
  }
});

test('prepared bundles are reproducible and retain real workflow/model requirements', t => {
  const dir = temp(t), first = join(dir, 'first'), second = join(dir, 'second');
  prepareBundle({ app: 'cinema-video', seed: 221 }, first);
  prepareBundle({ app: 'cinema-video', seed: 221 }, second);
  assert.equal(readFileSync(join(first, 'workflow.api.json'), 'utf8'), readFileSync(join(second, 'workflow.api.json'), 'utf8'));
  assert.equal(readFileSync(join(first, 'job.json'), 'utf8'), readFileSync(join(second, 'job.json'), 'utf8'));
  const requirements = json(join(first, 'requirements.json'));
  assert.equal(requirements.generated, false);
  assert.ok(requirements.models.some(model => model.file.includes('ltx')));
  assert.ok(requirements.models.every(model => model.file && model.license));
  assert.ok(Object.keys(json(join(first, 'workflow.api.json'))).length > 10);
});

test('upscale and interpolation bundles copy assets and bind the selected enhancement values', t => {
  const dir = temp(t), file = join(dir, 'bottle reference.png');
  writeFileSync(file, new Uint8Array([1, 2, 3, 4]));
  for (const id of APPS.filter(id => !id.startsWith('cinema-'))) {
    const input = id === 'upscale' ? 'image' : 'clip';
    const values = id === 'upscale' ? { scale: 4 } : id === 'smooth' ? { factor: 4, mode: true } : {};
    const { output } = prepareBundle({ app: id, files: { [input]: file }, inputs: values }, join(dir, id));
    const job = json(join(output, 'job.json')), graph = json(join(output, 'workflow.api.json')), app = json(join(output, 'app.json'));
    assert.equal(job.assets.length, 1);
    assert.deepEqual(readFileSync(join(output, job.assets[0].path)), readFileSync(file));
    for (const binding of app.inputs.find(field => field.id === input).bind) assert.equal(graph[binding.node].inputs[binding.field], job.assets[0].name);
    for (const [key, value] of Object.entries(values)) for (const binding of app.inputs.find(field => field.id === key).bind) assert.equal(graph[binding.node].inputs[binding.field], value);
  }
});

test('invalid inputs, absent files and random seeds fail before exporting', () => {
  assert.throws(() => createPlan({ app: 'not-an-app' }), /Unsupported app/);
  assert.throws(() => createPlan({ app: 'cinema-studio', inputs: { resolution: 8 } }), /not one of the options/);
  assert.throws(() => createPlan({ app: 'cinema-studio', inputs: { typoo: 2 } }), /unknown input/);
  assert.throws(() => createPlan({ app: 'cinema-studio', seed: -1 }), /nonnegative integer/);
  assert.throws(() => createPlan({ app: 'upscale' }), /required file/);
});

test('execution fails clearly when no GPU gateway is configured', () => {
  assert.throws(() => buildRunSpec('/nonexistent', undefined, {}), /Set COMFY_BASE_URL/);
  assert.throws(() => buildRunSpec('/nonexistent', undefined, { COMFY_BASE_URL: 'https://user:password@example.test' }), /without embedded credentials/);
});

test('run delegates to upstream through argument arrays and redacts authentication from logs', t => {
  const dir = temp(t), bundle = join(dir, 'bundle'), token = 'test-secret-not-for-output';
  prepareBundle({ app: 'cinema-studio', prompt: 'Noir Oud; $(touch unwanted)' }, bundle);
  const env = { COMFY_BASE_URL: 'https://gpu.example.test', FREEFIELD_TOKEN: token, FREEFIELD_ROOT: fakeCheckout(dir) };
  let called = false;
  const result = runBundle(bundle, join(dir, 'results'), { env, spawn(command, args, options) {
    called = true;
    assert.equal(command, process.execPath);
    assert.ok(args.includes('app') && args.includes('cinema-studio'));
    assert.ok(args.some(value => value.startsWith('prompt=') && value.includes('$(touch unwanted)')));
    assert.equal(options.shell, undefined);
    assert.equal(options.env.FREEFIELD_TOKEN, token);
    assert.ok(!args.some(value => value.includes(token)));
    return { status: 0, stdout: `mock runner ${token}`, stderr: '' };
  } });
  assert.ok(called);
  assert.equal(result.status, 0);
  assert.doesNotMatch(result.stdout, /test-secret/);
  assert.match(result.stdout, /REDACTED/);
});

test('modified prepared workflows and changed assets cannot silently run', t => {
  const dir = temp(t), bundle = join(dir, 'bundle'), file = join(dir, 'frame.png');
  writeFileSync(file, 'original');
  prepareBundle({ app: 'upscale', files: { image: file } }, bundle);
  const env = { COMFY_BASE_URL: 'https://gpu.example.test', FREEFIELD_ROOT: fakeCheckout(dir) };
  const job = json(join(bundle, 'job.json'));
  writeFileSync(join(bundle, job.assets[0].path), 'modified');
  assert.throws(() => buildRunSpec(bundle, undefined, env), /asset has changed/);
  writeFileSync(join(bundle, 'workflow.api.json'), '{}');
  assert.throws(() => buildRunSpec(bundle, undefined, env), /workflow has changed/);
});

test('CLI retains spaces and equals signs in values and rejects unknown flags', () => {
  const { command, options } = parseArguments(['prepare', '--app', 'smooth', '--set', 'mode=true', '--file', 'clip=/tmp/my clip=1.mp4']);
  assert.equal(command, 'prepare');assert.equal(options.inputs.mode, 'true');
  assert.equal(options.files.clip, '/tmp/my clip=1.mp4');
  assert.throws(() => parseArguments(['prepare', '--unknown', 'value']), /Unknown flag/);
});
