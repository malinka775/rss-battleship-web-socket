import { resolve } from 'node:path';
import dotenv from 'dotenv';
import { httpServer } from "./http_server/index.js";
import { startWS } from "./ws_server/index.js";

dotenv.config({ path: resolve(import.meta.dirname, '../.env') });

const HTTP_PORT: number = Number(process.env.HTTP_PORT) || 8000;
const WS_PORT: number = Number(process.env.WS_PORT) || 3000;

console.log(`Start static http server on the ${HTTP_PORT} port!`);
httpServer.listen(HTTP_PORT);

startWS(WS_PORT);
