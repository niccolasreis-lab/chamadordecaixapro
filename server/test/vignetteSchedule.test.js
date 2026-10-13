const test = require('node:test');
const assert = require('node:assert/strict');
const {
  MINUTE_MS,
  parseTime,
  findCurrentOccurrence,
  computeNextOccurrence,
  validateScheduleInput,
  isLocalVideoMedia,
  isLocalAudioMedia,
  isLocalScheduledMedia,
} = require('../services/vignetteSchedule');

function localDate(year, month, day, hour, minute, second = 0) {
  return new Date(year, month - 1, day, hour, minute, second, 0);
}

function scheduleFor(day, overrides = {}) {
  return {
    id: 'schedule-1',
    nome: 'Encerramento',
    midiaId: 'media-1',
    intervaloMinutos: 5,
    horaInicio: '17:20',
    horaFim: '18:00',
    diasSemana: [day.getDay()],
    ativo: true,
    ordem: 1,
    criadoEm: localDate(day.getFullYear(), day.getMonth() + 1, day.getDate(), 12, 0).toISOString(),
    atualizadoEm: localDate(day.getFullYear(), day.getMonth() + 1, day.getDate(), 12, 0).toISOString(),
    ...overrides,
  };
}

test('17:20?18:00 a cada 5 minutos produz exatamente nove ocorrencias inclusivas', () => {
  const day = localDate(2026, 7, 20, 0, 0);
  const schedule = scheduleFor(day);
  const occurrences = [];

  for (let index = 0; index < 9; index += 1) {
    const now = new Date(localDate(2026, 7, 20, 17, 20).getTime() + index * 5 * MINUTE_MS + 45000);
    const occurrence = findCurrentOccurrence(schedule, now);
    assert.ok(occurrence);
    occurrences.push(occurrence.scheduledAt.getHours() + ':' + String(occurrence.scheduledAt.getMinutes()).padStart(2, '0'));
  }

  assert.deepEqual(occurrences, ['17:20', '17:25', '17:30', '17:35', '17:40', '17:45', '17:50', '17:55', '18:00']);
  assert.equal(findCurrentOccurrence(schedule, localDate(2026, 7, 20, 18, 1)), null);
});

test('fim desalinhado nao cria ocorrencia fora do passo do intervalo', () => {
  const day = localDate(2026, 7, 20, 0, 0);
  const schedule = scheduleFor(day, { horaFim: '17:58' });
  assert.ok(findCurrentOccurrence(schedule, localDate(2026, 7, 20, 17, 55, 59)));
  assert.equal(findCurrentOccurrence(schedule, localDate(2026, 7, 20, 17, 58)), null);
});

test('dias selecionados usam o dia em que a janela comeca', () => {
  const monday = localDate(2026, 7, 20, 0, 0);
  const schedule = scheduleFor(monday);
  assert.ok(findCurrentOccurrence(schedule, localDate(2026, 7, 20, 17, 20)));
  assert.equal(findCurrentOccurrence(schedule, localDate(2026, 7, 21, 17, 20)), null);
});

test('janela atravessando meia-noite permanece ancorada no dia inicial', () => {
  const monday = localDate(2026, 7, 20, 0, 0);
  const schedule = scheduleFor(monday, {
    intervaloMinutos: 5,
    horaInicio: '23:55',
    horaFim: '00:10',
  });

  const afterMidnight = findCurrentOccurrence(schedule, localDate(2026, 7, 21, 0, 5, 30));
  assert.ok(afterMidnight);
  assert.equal(afterMidnight.scheduledAt.getDate(), 21);
  assert.equal(afterMidnight.scheduledAt.getHours(), 0);
  assert.equal(afterMidnight.scheduledAt.getMinutes(), 5);
  assert.equal(findCurrentOccurrence(schedule, localDate(2026, 7, 21, 23, 55)), null);
});

test('inicio igual ao fim representa uma unica ocorrencia', () => {
  const day = localDate(2026, 7, 20, 0, 0);
  const schedule = scheduleFor(day, { horaInicio: '17:20', horaFim: '17:20' });
  assert.ok(findCurrentOccurrence(schedule, localDate(2026, 7, 20, 17, 20, 59)));
  assert.equal(findCurrentOccurrence(schedule, localDate(2026, 7, 20, 17, 25)), null);
});

test('criacao ou edicao dentro do minuto corrente so vale no proximo slot', () => {
  const day = localDate(2026, 7, 20, 0, 0);
  const schedule = scheduleFor(day, {
    atualizadoEm: localDate(2026, 7, 20, 17, 20, 10).toISOString(),
  });
  assert.equal(findCurrentOccurrence(schedule, localDate(2026, 7, 20, 17, 20, 40)), null);
  const next = computeNextOccurrence(schedule, localDate(2026, 7, 20, 17, 20, 40));
  assert.ok(next);
  assert.equal(next.scheduledAt.getHours(), 17);
  assert.equal(next.scheduledAt.getMinutes(), 25);
});

test('proxima ocorrencia respeita atualizacao exatamente no inicio do slot', () => {
  const day = localDate(2026, 7, 20, 0, 0);
  const schedule = scheduleFor(day, {
    atualizadoEm: localDate(2026, 7, 20, 17, 20, 0).toISOString(),
  });
  const next = computeNextOccurrence(schedule, localDate(2026, 7, 20, 17, 20, 0));
  assert.ok(next);
  assert.equal(next.scheduledAt.getMinutes(), 25);
});

test('validacao aceita MP4 ou MP3 local inativo e rejeita URL web ou outro formato', () => {
  const input = {
    nome: 'Propaganda local',
    midiaId: 'media-1',
    intervaloMinutos: 5,
    horaInicio: '17:20',
    horaFim: '18:00',
    diasSemana: [0, 1, 2, 3, 4, 5, 6],
    ativo: true,
    ordem: 0,
  };
  const localInactive = { id: 'media-1', nome: 'vinheta.mp4', tipo: 'video', url: '/midias/vinheta.mp4', ativo: false };
  const localAudioInactive = { id: 'media-2', nome: 'vinheta.mp3', tipo: 'audio', url: '/midias/vinheta.mp3', ativo: false };
  assert.equal(validateScheduleInput(input, localInactive).midiaId, 'media-1');
  assert.equal(validateScheduleInput({ ...input, midiaId: 'media-2' }, localAudioInactive).midiaId, 'media-2');
  assert.equal(isLocalVideoMedia(localInactive), true);
  assert.equal(isLocalAudioMedia(localAudioInactive), true);
  assert.equal(isLocalScheduledMedia(localAudioInactive), true);
  assert.equal(isLocalVideoMedia({ ...localInactive, url: 'https://example.com/vinheta.mp4' }), false);
  assert.equal(isLocalAudioMedia({ ...localAudioInactive, url: 'https://example.com/vinheta.mp3' }), false);
  assert.equal(isLocalAudioMedia({ ...localAudioInactive, url: '/midias/vinheta.wav' }), false);
  assert.equal(isLocalVideoMedia({ ...localInactive, url: '/midias/vinheta.webm' }), false);
});

test('entradas temporais invalidas retornam detalhes verificaveis', () => {
  assert.equal(parseTime('24:00'), null);
  assert.equal(parseTime('7:20'), null);
  assert.throws(() => validateScheduleInput({
    nome: '',
    midiaId: 'missing',
    intervaloMinutos: 0,
    horaInicio: '25:00',
    horaFim: '18:60',
    diasSemana: [8],
  }, null), (error) => {
    assert.equal(error.statusCode, 400);
    assert.ok(error.details.length >= 5);
    return true;
  });
});
