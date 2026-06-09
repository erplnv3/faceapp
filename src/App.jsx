import React, { useState } from "react";
import Fullpage from "./Fullpage";
import Reigsterpage from "./Reigsterpage";

function App() {
  const [page, setPage] = useState("login");

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f5f7fb",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          paddingTop: "20px",
          paddingBottom: "20px",
        }}
      >
        <div
          style={{
            display: "flex",
            background: "#fff",
            padding: "6px",
            borderRadius: "16px",
            boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
          }}
        >
          <button
            onClick={() => setPage("login")}
            style={{
              padding: "12px 32px",
              border: "none",
              borderRadius: "12px",
              cursor: "pointer",
              fontSize: "16px",
              fontWeight: "600",
              background:
                page === "login" ? "#2563eb" : "transparent",
              color: page === "login" ? "#fff" : "#555",
              transition: "0.3s",
            }}
          >
            Login
          </button>

          <button
            onClick={() => setPage("register")}
            style={{
              padding: "12px 32px",
              border: "none",
              borderRadius: "12px",
              cursor: "pointer",
              fontSize: "16px",
              fontWeight: "600",
              background:
                page === "register" ? "#2563eb" : "transparent",
              color: page === "register" ? "#fff" : "#555",
              transition: "0.3s",
            }}
          >
            Register Face
          </button>
        </div>
      </div>

      {page === "login" ? <Fullpage /> : <Reigsterpage />}
    </div>
  );
}

export default App;