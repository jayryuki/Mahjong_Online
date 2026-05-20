import { Client } from 'colyseus.js';

const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const SERVER_URL = import.meta.env.VITE_COLYSEUS_URL || `${protocol}//${window.location.host}`;

export const colyseusClient = new Client(SERVER_URL);
