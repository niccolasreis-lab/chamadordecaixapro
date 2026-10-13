const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;

function parseTime(value) {
  if (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return null;
  const [hour, minute] = value.split(':').map(Number);
  return hour * 60 + minute;
}

function startOfLocalDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function addLocalDays(date, amount) {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return startOfLocalDay(result);
}

function atLocalMinute(day, minuteOfDay) {
  return new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    Math.floor(minuteOfDay / 60),
    minuteOfDay % 60,
    0,
    0
  );
}

function getWindow(schedule, anchorDay) {
  const startMinute = parseTime(schedule.horaInicio);
  const endMinute = parseTime(schedule.horaFim);
  if (startMinute === null || endMinute === null) return null;
  if (!Array.isArray(schedule.diasSemana) || !schedule.diasSemana.includes(anchorDay.getDay())) return null;

  const start = atLocalMinute(anchorDay, startMinute);
  let end = atLocalMinute(anchorDay, endMinute);
  if (endMinute < startMinute) end = atLocalMinute(addLocalDays(anchorDay, 1), endMinute);
  return { start, end };
}

function buildOccurrence(schedule, scheduledAt) {
  const intervalMs = schedule.intervaloMinutos * MINUTE_MS;
  return {
    scheduleId: schedule.id,
    scheduledAt,
    executionId: `${schedule.id}:${scheduledAt.toISOString()}`,
    deliveryDeadline: new Date(scheduledAt.getTime() + MINUTE_MS),
    expiresAt: new Date(scheduledAt.getTime() + intervalMs),
  };
}

function findCurrentOccurrence(schedule, now = new Date()) {
  if (!schedule || schedule.ativo === false) return null;
  if (!Number.isInteger(schedule.intervaloMinutos) || schedule.intervaloMinutos < 1) return null;

  const currentMinute = new Date(
    now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes(), 0, 0
  );
  const today = startOfLocalDay(now);

  for (const anchorDay of [today, addLocalDays(today, -1)]) {
    const window = getWindow(schedule, anchorDay);
    if (!window || currentMinute < window.start || currentMinute > window.end) continue;

    const elapsed = Math.round((currentMinute.getTime() - window.start.getTime()) / MINUTE_MS);
    if (elapsed < 0 || elapsed % schedule.intervaloMinutos !== 0) continue;

    const scheduledAt = new Date(window.start.getTime() + elapsed * MINUTE_MS);
    if (scheduledAt > window.end) continue;

    const effectiveFrom = new Date(schedule.atualizadoEm || schedule.criadoEm || 0);
    if (!Number.isNaN(effectiveFrom.getTime()) && scheduledAt <= effectiveFrom) continue;

    return buildOccurrence(schedule, scheduledAt);
  }
  return null;
}

function computeNextOccurrence(schedule, from = new Date()) {
  if (!schedule || schedule.ativo === false) return null;
  if (!Number.isInteger(schedule.intervaloMinutos) || schedule.intervaloMinutos < 1) return null;

  const effectiveFrom = new Date(schedule.atualizadoEm || schedule.criadoEm || 0);
  const effectiveTime = Number.isNaN(effectiveFrom.getTime()) ? null : effectiveFrom.getTime();
  const firstAnchor = addLocalDays(startOfLocalDay(from), -1);

  for (let dayOffset = 0; dayOffset <= 9; dayOffset += 1) {
    const anchor = addLocalDays(firstAnchor, dayOffset);
    const window = getWindow(schedule, anchor);
    if (!window) continue;

    if (window.start.getTime() === window.end.getTime()) {
      if (window.start >= from && (effectiveTime === null || window.start.getTime() > effectiveTime)) return buildOccurrence(schedule, window.start);
      continue;
    }

    for (
      let slot = window.start.getTime();
      slot <= window.end.getTime();
      slot += schedule.intervaloMinutos * MINUTE_MS
    ) {
      const candidate = new Date(slot);
      if (candidate >= from && (effectiveTime === null || candidate.getTime() > effectiveTime)) return buildOccurrence(schedule, candidate);
    }
  }
  return null;
}

function isLocalVideoMedia(media) {
  return Boolean(
    media
    && media.tipo === 'video'
    && typeof media.url === 'string'
    && media.url.startsWith('/midias/')
    && /^\/midias\/[^/?#]+\.mp4(?:[?#].*)?$/i.test(media.url)
  );
}

function isLocalAudioMedia(media) {
  return Boolean(
    media
    && media.tipo === 'audio'
    && typeof media.url === 'string'
    && media.url.startsWith('/midias/')
    && /^\/midias\/[^/?#]+\.mp3(?:[?#].*)?$/i.test(media.url)
  );
}

function isLocalScheduledMedia(media) {
  return isLocalVideoMedia(media) || isLocalAudioMedia(media);
}

function validateScheduleInput(input, media, existing = null) {
  const errors = [];
  const nome = typeof input.nome === 'string' ? input.nome.trim() : '';
  const intervaloMinutos = Number(input.intervaloMinutos);
  const horaInicio = input.horaInicio;
  const horaFim = input.horaFim;
  const diasSemana = Array.isArray(input.diasSemana)
    ? [...new Set(input.diasSemana.map(Number))].sort((a, b) => a - b)
    : [];
  const ordem = input.ordem === undefined || input.ordem === ''
    ? (existing?.ordem ?? 0)
    : Number(input.ordem);

  if (!nome || nome.length > 120) errors.push('Nome deve ter entre 1 e 120 caracteres.');
  if (!isLocalScheduledMedia(media)) errors.push('A vinheta deve usar um video MP4 ou audio MP3 local enviado ao servidor.');
  if (!Number.isInteger(intervaloMinutos) || intervaloMinutos < 1 || intervaloMinutos > 1440) {
    errors.push('Intervalo deve ser um numero inteiro entre 1 e 1440 minutos.');
  }
  if (parseTime(horaInicio) === null) errors.push('Hora inicial invalida. Use HH:mm.');
  if (parseTime(horaFim) === null) errors.push('Hora final invalida. Use HH:mm.');
  if (diasSemana.length === 0 || diasSemana.some((day) => !Number.isInteger(day) || day < 0 || day > 6)) {
    errors.push('Selecione ao menos um dia da semana valido.');
  }
  if (!Number.isInteger(ordem) || ordem < 0) errors.push('Ordem deve ser um numero inteiro maior ou igual a zero.');
  if (input.ativo !== undefined && typeof input.ativo !== 'boolean') {
    errors.push('Ativo deve ser verdadeiro ou falso.');
  }

  if (errors.length > 0) {
    const error = new Error('Agendamento invalido.');
    error.statusCode = 400;
    error.details = errors;
    throw error;
  }

  return {
    ...(existing || {}),
    nome,
    midiaId: String(input.midiaId),
    intervaloMinutos,
    horaInicio,
    horaFim,
    diasSemana,
    ativo: input.ativo !== undefined ? input.ativo : (existing?.ativo ?? true),
    ordem,
  };
}

module.exports = {
  MINUTE_MS,
  DAY_MS,
  parseTime,
  getWindow,
  findCurrentOccurrence,
  isLocalVideoMedia,
  isLocalAudioMedia,
  isLocalScheduledMedia,
  computeNextOccurrence,
  validateScheduleInput,
};
