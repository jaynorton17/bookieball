import { createApp } from './api/app.js';
import { API_PORT } from './shared/constants.js';

export function startApiServer(port = API_PORT): Promise<void> {
  const app = createApp();
  return new Promise((resolve) => {
    app.listen(port, () => {
      console.log(`bookieball API listening on http://localhost:${port}`);
      resolve();
    });
  });
}

if (process.argv[1]?.endsWith('server.ts')) {
  startApiServer().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
