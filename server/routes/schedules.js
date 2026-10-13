const express = require('express');

function sendError(res, error) {
  const status = error.statusCode || 500;
  if (status >= 500) console.error('[API Agendamentos]', error);
  res.status(status).json({
    error: error.message || 'Erro interno.',
    details: error.details || undefined,
  });
}

function createScheduleRouter(scheduler) {
  const router = express.Router();

  router.get('/status', (_req, res) => {
    try {
      res.json(scheduler.getStatus());
    } catch (error) {
      sendError(res, error);
    }
  });

  router.get('/', (_req, res) => {
    try {
      res.json(scheduler.listWithStatus());
    } catch (error) {
      sendError(res, error);
    }
  });

  router.post('/', (req, res) => {
    try {
      res.status(201).json({ success: true, agendamento: scheduler.create(req.body || {}) });
    } catch (error) {
      sendError(res, error);
    }
  });

  router.put('/:id', (req, res) => {
    try {
      res.json({ success: true, agendamento: scheduler.update(req.params.id, req.body || {}) });
    } catch (error) {
      sendError(res, error);
    }
  });

  router.delete('/:id', (req, res) => {
    try {
      res.json({ success: true, agendamento: scheduler.delete(req.params.id) });
    } catch (error) {
      sendError(res, error);
    }
  });

  router.post('/:id/testar', (req, res) => {
    try {
      res.json({ success: true, ...scheduler.triggerTest(req.params.id) });
    } catch (error) {
      sendError(res, error);
    }
  });

  return router;
}

module.exports = { createScheduleRouter };
