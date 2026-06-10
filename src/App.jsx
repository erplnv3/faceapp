import React, { useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Textchanger from "./Textchanger";

import Register from "./Register";

function App() {
  const [activeTab, setActiveTab] = useState("login");

  return (
 <BrowserRouter>
  <Header />

  <Routes>
    <Route path="/login" element={<Textchanger />} />
    <Route path="/register" element={<Register />} />
  </Routes>
</BrowserRouter>
  );
}

export default App;