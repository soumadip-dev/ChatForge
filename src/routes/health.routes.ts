import { Router } from 'express';

export const healthRouter = Router();

healthRouter.get('/', (_req, res) => {
  return res.status(200).json({ success: true, message: 'Server is healthy and running 💚' });
});
