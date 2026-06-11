import { Client } from 'colyseus.js';

type ColyseusUrlOptions = {
  protocol?: string;
  host?: string;
  override?: string;
  isDev?: boolean;
};

export function getColyseusUrl(options: ColyseusUrlOptions = {}) {
  const protocol = options.protocol ?? window.location.protocol;
  const host = options.host ?? window.location.host;
  const override = options.override ?? import.meta.env.VITE_COLYSEUS_URL;
  const isDev = options.isDev ?? import.meta.env.DEV;

  if (override) return override;
  if (isDev) return 'ws://localhost:2500';
  return `${protocol === 'https:' ? 'wss:' : 'ws:'}//${host}`;
}

const SERVER_URL = getColyseusUrl();

export const colyseusClient = new Client(SERVER_URL);
