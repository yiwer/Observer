// Owner's once-per-day scheduler entrypoint. Business deadlines/child cleanup
// are enforced by runScheduledDaily; this wrapper never retries or unlocks.
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(repository);
const log = value => console.log(JSON.stringify(value));
const nowIso = () => new Date().toISOString();

function scheduleForNow() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const part = type => parts.find(value => value.type === type).value;
  const date = `${part('year')}-${part('month')}-${part('day')}`;
  return { date, cutoff: `${date}T07:30:00+08:00`, deadline: `${date}T08:30:00+08:00`,
    runId: `${date}-scheduled`, timeZone: 'Asia/Shanghai' };
}

function configurationCheck() {
  const path = resolve(process.env.OBSERVER_MAIL_CONFIG ?? 'data/operator/daily-mail.json');
  try {
    const config = JSON.parse(readFileSync(path, 'utf8'));
    const email = value => typeof value === 'string' && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    const subscribers = config.subscribers;
    const valid = email(config.sender) && Array.isArray(subscribers) && subscribers.length >= 1 && subscribers.length <= 20 &&
      subscribers.every(value => value && /^[a-z][a-z0-9-]{0,40}$/.test(value.id ?? '') && email(value.address)) &&
      new Set(subscribers.map(value => value.id)).size === subscribers.length &&
      new Set(subscribers.map(value => value.address.toLowerCase())).size === subscribers.length;
    return { exists: true, basicSchemaValid: Boolean(valid), subscriberCount: Array.isArray(subscribers) ? subscribers.length : 0 };
  } catch {
    return { exists: existsSync(path), basicSchemaValid: false, subscriberCount: 0 };
  }
}

function environmentCheck() {
  // PowerShell returns booleans only, never secret values. Check Process then
  // User scope just as the runtime loaders do, without changing either scope.
  if (process.platform === 'win32') {
    const script = `
      $ErrorActionPreference = 'Stop'
      function HasSetting([string]$name) {
        $value = [Environment]::GetEnvironmentVariable($name, 'Process')
        if ([string]::IsNullOrWhiteSpace($value)) { $value = [Environment]::GetEnvironmentVariable($name, 'User') }
        return -not [string]::IsNullOrWhiteSpace($value)
      }
      $codexPath = [Environment]::GetEnvironmentVariable('OBSERVER_CODEX_EXECUTABLE', 'Process')
      if ([string]::IsNullOrWhiteSpace($codexPath)) { $codexPath = Join-Path $env:LOCALAPPDATA 'Programs/OpenAI/Codex/bin/codex.exe' }
      @{ smtpKeyPresent = (HasSetting 'QQ_SMTP_KEY'); tavilyKeyPresent = (HasSetting 'TAVILY_API_KEY'); exaKeyPresent = (HasSetting 'EXA_API_KEY'); codexExecutableExists = (Test-Path -LiteralPath $codexPath -PathType Leaf) } | ConvertTo-Json -Compress
    `;
    try {
      const value = JSON.parse(execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
        encoding: 'utf8', windowsHide: true, timeout: 10000, maxBuffer: 32768,
        stdio: ['ignore', 'pipe', 'pipe'],
      }));
      return { inspected: true, smtpKeyPresent: value.smtpKeyPresent === true,
        tavilyKeyPresent: value.tavilyKeyPresent === true, exaKeyPresent: value.exaKeyPresent === true,
        codexExecutableExists: value.codexExecutableExists === true };
    } catch {
      return { inspected: false, smtpKeyPresent: false, tavilyKeyPresent: false,
        exaKeyPresent: false, codexExecutableExists: false };
    }
  }
  return { inspected: true, smtpKeyPresent: Boolean(process.env.QQ_SMTP_KEY?.trim()),
    tavilyKeyPresent: Boolean(process.env.TAVILY_API_KEY?.trim()), exaKeyPresent: Boolean(process.env.EXA_API_KEY?.trim()),
    codexExecutableExists: Boolean(process.env.OBSERVER_CODEX_EXECUTABLE && existsSync(process.env.OBSERVER_CODEX_EXECUTABLE)) };
}

function checkOnly() {
  const [major, minor] = process.versions.node.split('.').map(Number);
  const nodeVersionSupported = major === 24 && minor >= 18;
  const paths = { nodeExecutableExists: existsSync(process.execPath),
    packageExists: existsSync(join(repository, 'package.json')),
    dailyHtmlExists: existsSync(join(repository, 'scripts/daily-html.mjs')),
    acquisitionExists: existsSync(join(repository, 'scripts/daily-acquisition.mjs')),
    nativeCodexExists: existsSync(join(repository, 'src/codex-native.ts')),
    dependenciesExist: existsSync(join(repository, 'node_modules/nodemailer/package.json')) && existsSync(join(repository, 'node_modules/zod/package.json')) };
  const mail = configurationCheck();
  const environment = environmentCheck();
  const ok = nodeVersionSupported && Object.values(paths).every(Boolean) && mail.basicSchemaValid &&
    environment.inspected && environment.smtpKeyPresent && (environment.tavilyKeyPresent || environment.exaKeyPresent) && environment.codexExecutableExists;
  log({ phase: 'schedule-read-only-check', status: ok ? 'ok' : 'failed', nodeVersion: process.versions.node,
    nodeVersionSupported, paths, mail, environment,
    note: '仅检查本地文件及凭据是否存在；未验证凭据权限、Codex登录、网络、邮件投递或任务安装。未创建当日运行声明。' });
  if (!ok) process.exitCode = 1;
}

function saveDiagnostic(path, value) {
  try { writeFileSync(path, JSON.stringify(value, null, 2), { flag: 'wx', mode: 0o600 }); }
  catch (error) { if (error?.code !== 'EEXIST') throw error; }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === '--check') { checkOnly(); return; }
  if (args.length) {
    log({ phase: 'schedule-rejected', error: 'unsupported-arguments' });
    process.exitCode = 1; return;
  }
  const schedule = scheduleForNow();
  const directory = join(repository, 'data/operator/schedule');
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const startedAt = nowIso();
  const startMs = Date.parse(startedAt);
  const outside = startMs < Date.parse(schedule.cutoff) ? 'before-start' : startMs >= Date.parse(schedule.deadline) ? 'after-deadline' : null;
  if (outside) {
    const record = { ...schedule, state: 'skipped', startedAt, updatedAt: nowIso(),
      reason: outside === 'before-start' ? 'scheduled-window-not-open' : 'scheduled-deadline-passed',
      note: '本次未采集或发信；不在当晚自动补发。' };
    saveDiagnostic(join(directory, `${schedule.date}-skipped-${outside}.json`), record);
    log({ phase: 'schedule-skipped', date: schedule.date, reason: record.reason });
    process.exitCode = 1; return;
  }
  const path = join(directory, `${schedule.date}.json`);
  let descriptor;
  try { descriptor = openSync(path, 'wx', 0o600); }
  catch (error) {
    if (error?.code !== 'EEXIST') throw error;
    log({ phase: 'schedule-skipped', date: schedule.date, reason: 'daily-claim-already-exists-inspect-manually' });
    process.exitCode = 1; return;
  }
  const claim = { ...schedule, state: 'running', startedAt, updatedAt: startedAt,
    note: '当日声明不会自动删除或解锁；中断、失败或投递状态不明时须人工检查，禁止自动重发。' };
  try { writeFileSync(descriptor, JSON.stringify(claim, null, 2)); }
  finally { closeSync(descriptor); }
  log({ phase: 'schedule-started', date: schedule.date, runId: schedule.runId });
  try {
    const { runScheduledDaily } = await import('./daily-html.mjs');
    if (Date.now() >= Date.parse(schedule.deadline)) throw new Error('deadline');
    const result = await runScheduledDaily({ date: schedule.date, cutoff: schedule.cutoff, deadline: schedule.deadline, runId: schedule.runId });
    // Persist only the explicitly safe workflow contract, never arbitrary
    // returned metadata, exception text, addresses, or provider responses.
    const outcome = { directory: result.directory, failedEditions: result.failedEditions,
      delivery: result.delivery.map(({ edition, subscriberId, state }) => ({ edition, subscriberId, state })),
      deadlineMet: result.deadlineMet, state: result.state };
    const delivered = outcome.delivery.length > 0 && outcome.delivery.every(value => value.state === 'accepted');
    const deadlineMet = outcome.deadlineMet === true && Date.now() < Date.parse(schedule.deadline);
    const state = !deadlineMet || !delivered || outcome.state === 'delivery-incomplete' ? 'failed' :
      outcome.state === 'accepted' && outcome.failedEditions.length === 0 && !process.exitCode ? 'completed' :
      outcome.state === 'partial-content' ? 'partial' : 'failed';
    const reason = state === 'completed' ? null : !deadlineMet ? 'scheduled-deadline-exceeded' :
      state === 'partial' ? 'scheduled-partial-content' : 'scheduled-delivery-or-workflow-incomplete';
    writeFileSync(path, JSON.stringify({ ...claim, state, updatedAt: nowIso(), result: outcome, reason }, null, 2), { mode: 0o600 });
    log({ phase: `schedule-${state}`, date: schedule.date, ...(reason ? { reason } : {}) });
    if (state !== 'completed') process.exitCode = 1;
  } catch {
    const reason = Date.now() >= Date.parse(schedule.deadline) ? 'scheduled-deadline-exceeded' : 'scheduled-workflow-failed';
    writeFileSync(path, JSON.stringify({ ...claim, state: 'failed', updatedAt: nowIso(), reason }, null, 2), { mode: 0o600 });
    log({ phase: 'schedule-failed', date: schedule.date, reason });
    process.exitCode = 1;
  }
}

main().catch(() => {
  log({ phase: 'schedule-failed', reason: 'scheduled-local-operation-failed' });
  process.exitCode = 1;
});
