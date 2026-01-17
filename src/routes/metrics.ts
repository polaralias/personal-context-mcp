import express from 'express';

const router = express.Router();

export const metrics = {
  requests_total: 0,
  requests_in_flight: 0,
  errors_total: 0
};

router.get('/', (_req, res) => {
  res.json(metrics);
});

export default router;
