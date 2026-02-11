import morgan from 'morgan';

function serializeMeta(meta) {
  const clean = Object.fromEntries(
    Object.entries(meta || {}).filter(([, value]) => value !== undefined)
  );
  return Object.keys(clean).length ? clean : undefined;
}

function print(level, message, meta) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    msg: message,
    ...serializeMeta(meta),
  };
  if (level === 'error') {
    console.error(JSON.stringify(entry));
  } else {
    console.log(JSON.stringify(entry));
  }
}

export const logger = {
  info: (message, meta) => print('info', message, meta),
  warn: (message, meta) => print('warn', message, meta),
  error: (message, meta) => print('error', message, meta),
};

export function createRequestLogger() {
  return morgan((tokens, req, res) => {
    const line = {
      ts: new Date().toISOString(),
      level: 'http',
      method: tokens.method(req, res),
      url: tokens.url(req, res),
      status: Number(tokens.status(req, res)),
      ms: Number(tokens['response-time'](req, res)),
      ip: tokens['remote-addr'](req, res),
    };
    return JSON.stringify(line);
  });
}
