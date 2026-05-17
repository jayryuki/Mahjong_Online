import { Client } from 'colyseus.js';

const SERVER_URL = import.meta.env.VITE_COLYSEUS_URL || `ws://${window.location.hostname}:2500`;

export const colyseusClient = new Client(SERVER_URL);
