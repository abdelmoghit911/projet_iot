import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import FleetManagement from './pages/FleetManagement';
import History from './pages/History';
import PassengerView from './pages/PassengerView';

function App() {
  return (
    <BrowserRouter>
      <div className="min-vh-100 bg-light">
        <Navbar />
        <div className="container-fluid p-0">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/fleet" element={<FleetManagement />} />
            <Route path="/history" element={<History />} />
            <Route path="/passenger" element={<PassengerView />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  );
}

export default App;
