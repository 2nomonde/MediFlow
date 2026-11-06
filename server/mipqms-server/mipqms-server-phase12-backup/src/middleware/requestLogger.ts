import morgan from "morgan";
import { isDevelopment } from "../config/env";

/**
 * `dev` format is concise and colour-coded — good for a terminal during
 * development. `combined` (Apache-style) is used otherwise since it's
 * more useful if logs are ever piped to a file or log aggregator later.
 */
export const requestLogger = morgan(isDevelopment ? "dev" : "combined");
