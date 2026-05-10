import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { StartScreen } from './screens/StartScreen.js';
import { CreateRoomScreen } from './screens/CreateRoomScreen.js';
import { JoinRoomScreen } from './screens/JoinRoomScreen.js';
import { LobbyScreen } from './screens/LobbyScreen.js';
import { ResultScreen } from './screens/ResultScreen.js';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<StartScreen />} />
        <Route path="/create" element={<CreateRoomScreen />} />
        <Route path="/join" element={<JoinRoomScreen />} />
        <Route path="/lobby/:roomCode" element={<LobbyScreen />} />
        <Route path="/result/:roomCode" element={<ResultScreen />} />
      </Routes>
    </BrowserRouter>
  );
}
