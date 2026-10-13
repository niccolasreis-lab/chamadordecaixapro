const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const { JsonStore } = require('./jsonStore');
const {
  MINUTE_MS,
  findCurrentOccurrence,
  computeNextOccurrence,
  validateScheduleInput,
  isLocalScheduledMedia,
} = require('./vignetteSchedule');

const ACK_STATUSES = new Set(['queued', 'started', 'completed', 'failed']);
const HISTORY_LIMIT = 200;
const RESEND_INTERVAL_MS = 5000;

class VignetteScheduler {
  constructor({ dataDir, wss, now = () => new Date(), logger = console }) {
    this.dataDir = dataDir;
    this.wss = wss;
    this.now = now;
    this.logger = logger;
    this.timer = null;

    const defaultPath = path.join(dataDir, 'default-agendamentos.json');
    let defaults = [];
    try {
      if (fs.existsSync(defaultPath)) defaults = JSON.parse(fs.readFileSync(defaultPath, 'utf8'));
    } catch (error) {
      logger.error('[Vinhetas] Falha ao ler agendamentos padrao:', error.message);
    }

    this.scheduleStore = new JsonStore(path.join(dataDir, 'agendamentos.json'), defaults);
    this.stateStore = new JsonStore(path.join(dataDir, 'agendamentos-state.json'), { occurrences: {}, lastOccurrenceBySchedule: {} });
    this.historyStore = new JsonStore(path.join(dataDir, 'agendamentos-execucoes.json'), []);
    this.scheduleStore.read();
    this.stateStore.read();
    this.historyStore.read();

    this.handleAck = this.handleAck.bind(this);
    if (this.wss?.on) this.wss.on('vignette-ack', this.handleAck);
  }

  readSchedules() {
    const schedules = this.scheduleStore.read();
    return Array.isArray(schedules) ? schedules : [];
  }

  readState() {
    const state = this.stateStore.read();
    if (!state || typeof state !== 'object' || Array.isArray(state)) return { occurrences: {}, lastOccurrenceBySchedule: {} };
    if (!state.occurrences || typeof state.occurrences !== 'object' || Array.isArray(state.occurrences)) {
      state.occurrences = {};
    }
    if (!state.lastOccurrenceBySchedule || typeof state.lastOccurrenceBySchedule !== 'object' || Array.isArray(state.lastOccurrenceBySchedule)) {
      state.lastOccurrenceBySchedule = {};
    }
    return state;
  }

  readHistory() {
    const history = this.historyStore.read();
    return Array.isArray(history) ? history : [];
  }

  readMedia() {
    try {
      const mediaPath = path.join(this.dataDir, 'midias.json');
      const data = JSON.parse(fs.readFileSync(mediaPath, 'utf8'));
      return Array.isArray(data) ? data : [];
    } catch (_) {
      return [];
    }
  }

  findMedia(mediaId) {
    return this.readMedia().find((item) => String(item.id) === String(mediaId)) || null;
  }

  isAvailableLocalMedia(media) {
    if (!isLocalScheduledMedia(media)) return false;
    const filePath = path.join(this.dataDir, 'uploads', path.basename(media.url));
    try {
      return fs.statSync(filePath).isFile();
    } catch (_) {
      return false;
    }
  }

  findByMedia(mediaId) {
    return this.readSchedules().filter((item) => String(item.midiaId) === String(mediaId));
  }

  getTimeZone() {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'local';
    } catch (_) {
      return 'local';
    }
  }

  appendOrUpdateHistory(entry) {
    const list = this.readHistory();
    const index = list.findIndex((item) => item.executionId === entry.executionId);
    if (index >= 0) list[index] = { ...list[index], ...entry };
    else list.push(entry);
    list.sort((a, b) => String(a.scheduledAt).localeCompare(String(b.scheduledAt)));
    this.historyStore.write(list.slice(-HISTORY_LIMIT));
  }

  listWithStatus() {
    const now = this.now();
    const media = this.readMedia();
    const history = this.readHistory();
    return this.readSchedules()
      .sort((a, b) => (a.ordem - b.ordem) || a.id.localeCompare(b.id))
      .map((schedule) => {
        const last = [...history]
          .reverse()
          .find((entry) => entry.scheduleId === schedule.id && !entry.isTest) || null;
        const next = computeNextOccurrence(schedule, now);
        const mediaItem = media.find((item) => String(item.id) === String(schedule.midiaId));
        return {
          ...schedule,
          midiaNome: mediaItem?.nome || null,
          midiaValida: this.isAvailableLocalMedia(mediaItem),
          ultimaExecucao: last,
          proximaExecucaoEm: next?.scheduledAt.toISOString() || null,
        };
      });
  }

  create(input) {
    const schedules = this.readSchedules();
    const media = this.findMedia(input.midiaId);
    const normalized = validateScheduleInput(input, this.isAvailableLocalMedia(media) ? media : null);
    const nowIso = this.now().toISOString();
    const maxOrder = schedules.reduce((max, item) => Math.max(max, Number(item.ordem) || 0), 0);
    const schedule = {
      ...normalized,
      id: randomUUID(),
      ordem: input.ordem === undefined || input.ordem === '' ? maxOrder + 1 : normalized.ordem,
      criadoEm: nowIso,
      atualizadoEm: nowIso,
    };
    schedules.push(schedule);
    this.scheduleStore.write(schedules);
    return schedule;
  }

  update(id, input) {
    const schedules = this.readSchedules();
    const index = schedules.findIndex((item) => item.id === id);
    if (index < 0) {
      const error = new Error('Agendamento nao encontrado.');
      error.statusCode = 404;
      throw error;
    }

    const merged = { ...schedules[index], ...input };
    const media = this.findMedia(merged.midiaId);
    const normalized = validateScheduleInput(merged, this.isAvailableLocalMedia(media) ? media : null, schedules[index]);
    const updated = {
      ...normalized,
      id: schedules[index].id,
      criadoEm: schedules[index].criadoEm,
      atualizadoEm: this.now().toISOString(),
    };
    schedules[index] = updated;
    this.scheduleStore.write(schedules);
    return updated;
  }

  delete(id) {
    const schedules = this.readSchedules();
    const index = schedules.findIndex((item) => item.id === id);
    if (index < 0) {
      const error = new Error('Agendamento nao encontrado.');
      error.statusCode = 404;
      throw error;
    }
    const [removed] = schedules.splice(index, 1);
    this.scheduleStore.write(schedules);
    return removed;
  }

  getConnectedDisplayIds() {
    return this.wss?.getConnectedDisplayIds ? this.wss.getConnectedDisplayIds() : [];
  }

  getStatus() {
    const now = this.now();
    const connectedDisplays = this.getConnectedDisplayIds();
    return {
      serverTime: now.toISOString(),
      serverLocalTime: now.toLocaleString('pt-BR'),
      timezone: this.getTimeZone(),
      connectedDisplays,
      connectedDisplayCount: connectedDisplays.length,
      recentExecutions: [...this.readHistory()].reverse().slice(0, 30),
    };
  }

  buildMediaPayload(media) {
    return {
      id: String(media.id),
      nome: media.nome || path.basename(media.url || ''),
      tipo: media.tipo,
      url: media.url,
    };
  }

  makeOccurrenceState(occurrence, schedule, isTest = false) {
    return {
      executionId: occurrence.executionId,
      scheduleId: schedule.id,
      scheduleName: schedule.nome,
      scheduledAt: occurrence.scheduledAt.toISOString(),
      deliveryDeadline: occurrence.deliveryDeadline.toISOString(),
      expiresAt: occurrence.expiresAt.toISOString(),
      isTest,
      status: 'waiting_display',
      sentTo: {},
      acknowledgements: {},
      updatedAt: this.now().toISOString(),
    };
  }

  dispatch(state, schedule, media, targetIds, now) {
    if (!targetIds.length) return 0;
    const command = {
      executionId: state.executionId,
      scheduleId: schedule.id,
      scheduledAt: state.scheduledAt,
      expiresAt: state.expiresAt,
      media: this.buildMediaPayload(media),
    };
    const recipients = this.wss.broadcastToDisplays(
      { type: 'VIGNETTE_PLAY', data: command },
      targetIds
    );
    for (const id of recipients) state.sentTo[id] = now.toISOString();
    state.status = recipients.length ? 'dispatched' : state.status;
    state.updatedAt = now.toISOString();
    this.appendOrUpdateHistory({
      executionId: state.executionId,
      scheduleId: schedule.id,
      scheduleName: schedule.nome,
      mediaId: media.id,
      mediaName: media.nome,
      scheduledAt: state.scheduledAt,
      dispatchedAt: now.toISOString(),
      recipients,
      status: state.status,
      isTest: state.isTest,
    });
    if (recipients.length) {
      this.logger.log('[Vinhetas] ' + state.executionId + ' enviado para: ' + recipients.join(', '));
    }
    return recipients.length;
  }

  triggerTest(id) {
    const schedule = this.readSchedules().find((item) => item.id === id);
    if (!schedule) {
      const error = new Error('Agendamento nao encontrado.');
      error.statusCode = 404;
      throw error;
    }
    const media = this.findMedia(schedule.midiaId);
    if (!this.isAvailableLocalMedia(media)) {
      const error = new Error('Midia do agendamento indisponivel.');
      error.statusCode = 409;
      throw error;
    }
    const targets = this.getConnectedDisplayIds();
    if (!targets.length) {
      const error = new Error('Nenhum telao conectado.');
      error.statusCode = 409;
      throw error;
    }

    const now = this.now();
    const occurrence = {
      executionId: 'test:' + schedule.id + ':' + randomUUID(),
      scheduledAt: now,
      deliveryDeadline: new Date(now.getTime() + MINUTE_MS),
      expiresAt: new Date(now.getTime() + 5 * MINUTE_MS),
    };
    const state = this.readState();
    state.occurrences[occurrence.executionId] = this.makeOccurrenceState(occurrence, schedule, true);
    this.dispatch(state.occurrences[occurrence.executionId], schedule, media, targets, now);
    this.stateStore.write(state);
    return { executionId: occurrence.executionId, recipients: targets };
  }

  handleAck(data, client) {
    if (!data || !ACK_STATUSES.has(data.status) || !data.executionId || !client?.displayId) return;
    const state = this.readState();
    const occurrence = state.occurrences[data.executionId];
    if (!occurrence) return;

    const failureReason = data.error ? String(data.error).slice(0, 300) : null;
    const operationalStatus = data.status === 'failed' && failureReason === 'skipped_busy_same_schedule' ? failureReason : data.status;
    occurrence.acknowledgements[client.displayId] = {
      status: data.status,
      at: this.now().toISOString(),
      error: failureReason,
    };
    occurrence.status = operationalStatus;
    occurrence.updatedAt = this.now().toISOString();
    this.stateStore.write(state);
    this.appendOrUpdateHistory({
      executionId: occurrence.executionId,
      status: operationalStatus,
      lastAckAt: occurrence.updatedAt,
      lastClientId: client.displayId,
      error: failureReason,
    });
    this.logger.log('[Vinhetas] ACK ' + data.status + ' de ' + client.displayId + ': ' + data.executionId);
  }

  finalizeExpired(state, now) {
    let changed = false;
    for (const occurrence of Object.values(state.occurrences || {})) {
      const deadline = new Date(occurrence.deliveryDeadline);
      const acknowledgements = Object.values(occurrence.acknowledgements || {});
      if (
        now >= deadline
        && ['waiting_display', 'dispatched'].includes(occurrence.status)
        && !acknowledgements.some((ack) => ['queued', 'started', 'completed'].includes(ack.status))
      ) {
        occurrence.status = Object.keys(occurrence.sentTo || {}).length
          ? 'failed_no_ack'
          : 'missed_no_display';
        occurrence.updatedAt = now.toISOString();
        this.appendOrUpdateHistory({
          executionId: occurrence.executionId,
          status: occurrence.status,
          completedAt: now.toISOString(),
        });
        changed = true;
      }
      const expiresAt = new Date(occurrence.expiresAt);
      if (
        now >= expiresAt
        && ['waiting_display', 'dispatched', 'queued'].includes(occurrence.status)
        && !acknowledgements.some((ack) => ['started', 'completed'].includes(ack.status))
      ) {
        occurrence.status = 'failed_expired';
        occurrence.updatedAt = now.toISOString();
        this.appendOrUpdateHistory({
          executionId: occurrence.executionId,
          status: occurrence.status,
          completedAt: now.toISOString(),
        });
        changed = true;
      }
    }

    const retentionCutoff = now.getTime() - 2 * 24 * 60 * MINUTE_MS;
    for (const [id, occurrence] of Object.entries(state.occurrences)) {
      if (new Date(occurrence.expiresAt).getTime() < retentionCutoff) {
        delete state.occurrences[id];
        changed = true;
      }
    }
    return changed;
  }

  tick() {
    const now = this.now();
    const state = this.readState();
    let changed = this.finalizeExpired(state, now);
    const schedules = this.readSchedules()
      .filter((item) => item.ativo)
      .sort((a, b) => (a.ordem - b.ordem) || a.id.localeCompare(b.id));

    for (const schedule of schedules) {
      const occurrence = findCurrentOccurrence(schedule, now);
      if (!occurrence) continue;
      const media = this.findMedia(schedule.midiaId);
      if (!state.occurrences[occurrence.executionId]) {
        const scheduledKey = occurrence.scheduledAt.toISOString();
        const lastKey = state.lastOccurrenceBySchedule[schedule.id];
        if (lastKey && scheduledKey <= lastKey) continue;
        state.lastOccurrenceBySchedule[schedule.id] = scheduledKey;
        state.occurrences[occurrence.executionId] = this.makeOccurrenceState(occurrence, schedule);
        this.appendOrUpdateHistory({
          executionId: occurrence.executionId,
          scheduleId: schedule.id,
          scheduleName: schedule.nome,
          mediaId: media?.id || schedule.midiaId,
          mediaName: media?.nome || null,
          scheduledAt: occurrence.scheduledAt.toISOString(),
          status: 'waiting_display',
          isTest: false,
        });
        changed = true;
      }
      const occurrenceState = state.occurrences[occurrence.executionId];
      if (['missed_no_display', 'failed_no_ack', 'failed_expired', 'failed_media'].includes(occurrenceState.status)) {
        continue;
      }

      if (!this.isAvailableLocalMedia(media)) {
        if (occurrenceState.status !== 'failed_media') {
          occurrenceState.status = 'failed_media';
          occurrenceState.updatedAt = now.toISOString();
          this.appendOrUpdateHistory({
            executionId: occurrence.executionId,
            scheduleId: schedule.id,
            scheduleName: schedule.nome,
            scheduledAt: occurrence.scheduledAt.toISOString(),
            status: 'failed_media',
          });
          changed = true;
        }
        continue;
      }

      const acknowledged = occurrenceState.acknowledgements || {};
      const targets = this.getConnectedDisplayIds().filter((id) => {
        if (['started', 'completed', 'failed'].includes(acknowledged[id]?.status)) return false;
        const sentAt = occurrenceState.sentTo?.[id];
        return !sentAt || now.getTime() - new Date(sentAt).getTime() >= RESEND_INTERVAL_MS;
      });
      if (this.dispatch(occurrenceState, schedule, media, targets, now)) changed = true;
    }

    if (changed) this.stateStore.write(state);
  }

  runTick() {
    try {
      this.tick();
    } catch (error) {
      this.logger.error('[Vinhetas] Falha no ciclo do motor:', error);
    }
  }

  start() {
    if (this.timer) return;
    this.runTick();
    this.timer = setInterval(() => this.runTick(), 1000);
    this.logger.log('[Vinhetas] Motor iniciado. Fuso: ' + this.getTimeZone());
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if (this.wss?.off) this.wss.off('vignette-ack', this.handleAck);
  }
}

module.exports = { VignetteScheduler };
