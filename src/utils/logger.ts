/**
 * Logger para el frontend que solo se activa en desarrollo
 * En producción, los logs se silencian para evitar exponer información sensible
 */

const isDevelopment = import.meta.env.DEV;

interface LoggerInterface {
  log: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  debug: (...args: unknown[]) => void;
}

const noop = () => {};

const logger: LoggerInterface = {
  log: isDevelopment ? console.log.bind(console) : noop,
  info: isDevelopment ? console.info.bind(console) : noop,
  warn: isDevelopment ? console.warn.bind(console) : noop,
  error: isDevelopment ? console.error.bind(console) : noop,
  debug: isDevelopment ? console.debug.bind(console) : noop,
};

export default logger;
