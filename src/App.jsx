import React, { useState } from "react";
import Textchanger from "./Textchanger";
import Register from "./Register";

function App() {
  const [activeTab, setActiveTab] = useState("login");

  return (
    <div style={{ position: "relative", minHeight: "100vh" }}>
      {/* Overlay Toggle */}
      <div
        style={{
          position: "fixed",
          top: 20,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 9999,
          display: "flex",
          background: "rgba(255,255,255,0.95)",
          padding: "6px",
          borderRadius: "16px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        }}
      >
        <button
          onClick={() => setActiveTab("login")}
          style={{
            border: "none",
            padding: "12px 24px",
            borderRadius: "12px",
            cursor: "pointer",
            fontSize: "16px",
            fontWeight: 600,
            background:
              activeTab === "login" ? "#2563eb" : "transparent",
            color: activeTab === "login" ? "#fff" : "#333",
          }}
        >
          Login
        </button>

        <button
          onClick={() => setActiveTab("register")}
          style={{
            border: "none",
            padding: "12px 24px",
            borderRadius: "12px",
            cursor: "pointer",
            fontSize: "16px",
            fontWeight: 600,
            background:
              activeTab === "register" ? "#2563eb" : "transparent",
            color: activeTab === "register" ? "#fff" : "#333",
          }}
        >
          Register
        </button>
      </div>

      {/* Page Content */}
      {activeTab === "login" ? <Textchanger /> : <Register />}
    </div>
  );
}

export default App;