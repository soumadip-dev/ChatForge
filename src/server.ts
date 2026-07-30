// root file

import { createApp } from './app';
import { env } from './config/env.config';
import { logger } from './lib/logger.lib';

const app = createApp();

const PORT = env.PORT || 8080;

app.listen(PORT, () => {
  logger.info(`Server listening at http://localhost:${PORT} 🌐`);
});
