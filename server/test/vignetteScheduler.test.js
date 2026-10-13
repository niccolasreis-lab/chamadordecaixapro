const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { EventEmitter } = require('events');
const { VignetteScheduler } = require('../services/vignetteScheduler');

function localDate(year, month, day, hour, minute, second = 0) {
  return new Date(year, month - 1, day, hour, minute, second, 0);
}

class FakeWss extends EventEmitter {
  constructor(displayIds = []) {
    super();
    this.displayIds = [...displayIds];
    this.deliveries = [];
  }

  getConnectedDisplayIds() {
    return [...this.displayIds];
  }

  broadcastToDisplays(message, targetIds) {
    const allowed = new Set(targetIds || this.displayIds);
    const recipients = this.displayIds.filter((id) => allowed.has(id));
    if (recipients.length) {
      this.deliveries.push({
        message: JSON.parse(JSON.stringify(message)),
        recipients: [...recipients],
      });
    }
    return recipients;
  }
}

function createFixture(t, displayIds = ['display-1']) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vignette-scheduler-'));
  t.after(() => fs.rmSync(dataDir, { recursive: true, force: true }));
  fs.mkdirSync(path.join(dataDir, 'uploads'));
  fs.writeFileSync(path.join(dataDir, 'uploads', 'encerramento.mp4'), 'fixture');
  fs.writeFileSync(path.join(dataDir, 'midias.json'), JSON.stringify([{
    id: 'media-1',
    nome: 'encerramento.mp4',
    tipo: 'video',
    url: '/midias/encerramento.mp4',
    ativo: false,
  }]));
  const wss = new FakeWss(displayIds);
  let current = localDate(2026, 7, 20, 17, 19, 0);
  const scheduler = new VignetteScheduler({
    dataDir,
    wss,
    now: () => new Date(current),
    logger: { log() {}, error() {} },
  });
  const input = (overrides = {}) => ({
    nome: 'Encerramento',
    midiaId: 'media-1',
    intervaloMinutos: 5,
    horaInicio: '17:20',
    horaFim: '18:00',
    diasSemana: [current.getDay()],
    ativo: true,
    ordem: 1,
    ...overrides,
  });
  return {
    dataDir,
    wss,
    scheduler,
    input,
    setNow(value) { current = value; },
  };
}

test('deduplica ticks, reenvia o mesmo executionId e para apos ACK started', (t) => {
  const fixture = createFixture(t);
  fixture.scheduler.create(fixture.input());

  fixture.setNow(localDate(2026, 7, 20, 17, 20, 10));
  fixture.scheduler.tick();
  fixture.scheduler.tick();
  assert.equal(fixture.wss.deliveries.length, 1);
  const executionId = fixture.wss.deliveries[0].message.data.executionId;

  fixture.setNow(localDate(2026, 7, 20, 17, 20, 16));
  fixture.scheduler.tick();
  assert.equal(fixture.wss.deliveries.length, 2);
  assert.equal(fixture.wss.deliveries[1].message.data.executionId, executionId);

  fixture.wss.emit('vignette-ack', { executionId, status: 'queued' }, { displayId: 'display-1' });
  fixture.setNow(localDate(2026, 7, 20, 17, 20, 22));
  fixture.scheduler.tick();
  assert.equal(fixture.wss.deliveries.length, 3);

  fixture.wss.emit('vignette-ack', { executionId, status: 'started' }, { displayId: 'display-1' });
  fixture.setNow(localDate(2026, 7, 20, 17, 20, 30));
  fixture.scheduler.tick();
  assert.equal(fixture.wss.deliveries.length, 3);
  fixture.scheduler.stop();
});

test('persistencia impede reproducao duplicada apos reinicio do servidor', (t) => {
  const fixture = createFixture(t);
  fixture.scheduler.create(fixture.input());
  fixture.setNow(localDate(2026, 7, 20, 17, 20, 5));
  fixture.scheduler.tick();
  const executionId = fixture.wss.deliveries[0].message.data.executionId;
  fixture.wss.emit('vignette-ack', { executionId, status: 'completed' }, { displayId: 'display-1' });
  fixture.scheduler.stop();

  const restartedWss = new FakeWss(['display-1']);
  const restarted = new VignetteScheduler({
    dataDir: fixture.dataDir,
    wss: restartedWss,
    now: () => localDate(2026, 7, 20, 17, 20, 40),
    logger: { log() {}, error() {} },
  });
  restarted.tick();
  assert.equal(restartedWss.deliveries.length, 0);
  restarted.stop();
});

test('telao que conecta dentro do minuto recebe; conexao posterior nao recupera horario perdido', (t) => {
  const fixture = createFixture(t, []);
  fixture.scheduler.create(fixture.input());
  fixture.setNow(localDate(2026, 7, 20, 17, 20, 5));
  fixture.scheduler.tick();
  assert.equal(fixture.wss.deliveries.length, 0);

  fixture.wss.displayIds = ['display-1'];
  fixture.setNow(localDate(2026, 7, 20, 17, 20, 45));
  fixture.scheduler.tick();
  assert.equal(fixture.wss.deliveries.length, 1);
  fixture.scheduler.stop();

  const missed = createFixture(t, []);
  missed.scheduler.create(missed.input());
  missed.setNow(localDate(2026, 7, 20, 17, 20, 5));
  missed.scheduler.tick();
  missed.setNow(localDate(2026, 7, 20, 17, 21, 1));
  missed.scheduler.tick();
  missed.wss.displayIds = ['display-late'];
  missed.scheduler.tick();
  assert.equal(missed.wss.deliveries.length, 0);
  missed.setNow(localDate(2026, 7, 20, 17, 20, 30));
  missed.scheduler.tick();
  assert.equal(missed.wss.deliveries.length, 0);
  assert.equal(missed.scheduler.listWithStatus()[0].ultimaExecucao.status, 'missed_no_display');
  missed.scheduler.stop();
});

test('agendamentos simultaneos sao emitidos por ordem e depois por id', (t) => {
  const fixture = createFixture(t);
  const second = fixture.scheduler.create(fixture.input({ nome: 'Segundo', ordem: 2 }));
  const first = fixture.scheduler.create(fixture.input({ nome: 'Primeiro', ordem: 1 }));
  fixture.setNow(localDate(2026, 7, 20, 17, 20, 10));
  fixture.scheduler.tick();

  assert.equal(fixture.wss.deliveries.length, 2);
  assert.deepEqual(
    fixture.wss.deliveries.map((item) => item.message.data.scheduleId),
    [first.id, second.id]
  );
  fixture.scheduler.stop();
});

test('teste administrativo usa MP4 local, exige telao e nao altera a ultima execucao programada', (t) => {
  const fixture = createFixture(t);
  const schedule = fixture.scheduler.create(fixture.input());
  fixture.setNow(localDate(2026, 7, 20, 17, 20, 5));
  fixture.scheduler.tick();
  const executionId = fixture.wss.deliveries[0].message.data.executionId;
  fixture.wss.emit('vignette-ack', { executionId, status: 'completed' }, { displayId: 'display-1' });
  const scheduledLast = fixture.scheduler.listWithStatus()[0].ultimaExecucao.executionId;

  const result = fixture.scheduler.triggerTest(schedule.id);
  assert.equal(result.recipients.length, 1);
  assert.match(result.executionId, /^test:/);
  assert.equal(fixture.scheduler.listWithStatus()[0].ultimaExecucao.executionId, scheduledLast);
  fixture.scheduler.stop();

  const noDisplay = createFixture(t, []);
  const unavailable = noDisplay.scheduler.create(noDisplay.input());
  assert.throws(() => noDisplay.scheduler.triggerTest(unavailable.id), (error) => error.statusCode === 409);
  noDisplay.scheduler.stop();
});

test('MP3 local e enviado como audio e falha se o arquivo desaparecer', (t) => {
  const fixture = createFixture(t);
  const audioFile = path.join(fixture.dataDir, 'uploads', 'anuncio.mp3');
  fs.writeFileSync(audioFile, 'fixture-audio');
  fs.writeFileSync(path.join(fixture.dataDir, 'midias.json'), JSON.stringify([{
    id: 'audio-1',
    nome: 'anuncio.mp3',
    tipo: 'audio',
    url: '/midias/anuncio.mp3',
    ativo: false,
  }]));

  fixture.scheduler.create(fixture.input({ midiaId: 'audio-1', nome: 'Anuncio sonoro' }));
  fixture.setNow(localDate(2026, 7, 20, 17, 20, 5));
  fixture.scheduler.tick();

  assert.equal(fixture.wss.deliveries.length, 1);
  assert.deepEqual(fixture.wss.deliveries[0].message.data.media, {
    id: 'audio-1',
    nome: 'anuncio.mp3',
    tipo: 'audio',
    url: '/midias/anuncio.mp3',
  });

  const missing = createFixture(t);
  const missingAudio = path.join(missing.dataDir, 'uploads', 'anuncio.mp3');
  fs.writeFileSync(missingAudio, 'fixture-audio');
  fs.writeFileSync(path.join(missing.dataDir, 'midias.json'), JSON.stringify([{
    id: 'audio-1',
    nome: 'anuncio.mp3',
    tipo: 'audio',
    url: '/midias/anuncio.mp3',
    ativo: false,
  }]));
  missing.scheduler.create(missing.input({ midiaId: 'audio-1', nome: 'Anuncio sonoro' }));
  fs.unlinkSync(missingAudio);
  missing.setNow(localDate(2026, 7, 20, 17, 20, 5));
  missing.scheduler.tick();
  assert.equal(missing.scheduler.listWithStatus()[0].ultimaExecucao.status, 'failed_media');
  assert.equal(missing.wss.deliveries.length, 0);
  missing.scheduler.stop();
});

test('ACK de agenda ocupada fica registrado como descarte operacional', (t) => {
  const fixture = createFixture(t);
  fixture.scheduler.create(fixture.input());
  fixture.setNow(localDate(2026, 7, 20, 17, 20, 5));
  fixture.scheduler.tick();
  const executionId = fixture.wss.deliveries[0].message.data.executionId;
  fixture.wss.emit('vignette-ack', {
    executionId,
    status: 'failed',
    error: 'skipped_busy_same_schedule',
  }, { displayId: 'display-1' });

  assert.equal(fixture.scheduler.listWithStatus()[0].ultimaExecucao.status, 'skipped_busy_same_schedule');
  fixture.scheduler.stop();
});


test('retrocesso do relogio nao dispara um slot anterior ao ultimo observado', (t) => {
  const fixture = createFixture(t);
  fixture.scheduler.create(fixture.input());
  fixture.setNow(localDate(2026, 7, 20, 17, 25, 5));
  fixture.scheduler.tick();
  assert.equal(fixture.wss.deliveries.length, 1);

  fixture.setNow(localDate(2026, 7, 20, 17, 20, 5));
  fixture.scheduler.tick();
  assert.equal(fixture.wss.deliveries.length, 1);
  fixture.scheduler.stop();
});

test('arquivo MP4 ausente e rejeitado na criacao e registrado se desaparecer depois', (t) => {
  const missingAtCreate = createFixture(t);
  fs.unlinkSync(path.join(missingAtCreate.dataDir, 'uploads', 'encerramento.mp4'));
  assert.throws(
    () => missingAtCreate.scheduler.create(missingAtCreate.input()),
    (error) => error.statusCode === 400
  );
  missingAtCreate.scheduler.stop();

  const missingAtRun = createFixture(t);
  missingAtRun.scheduler.create(missingAtRun.input());
  fs.unlinkSync(path.join(missingAtRun.dataDir, 'uploads', 'encerramento.mp4'));
  missingAtRun.setNow(localDate(2026, 7, 20, 17, 20, 5));
  missingAtRun.scheduler.tick();
  assert.equal(missingAtRun.scheduler.listWithStatus()[0].ultimaExecucao.status, 'failed_media');
  assert.equal(missingAtRun.wss.deliveries.length, 0);
  missingAtRun.scheduler.stop();
});
