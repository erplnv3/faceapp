import React, { useEffect, useRef, useState } from "react";
import * as faceapi from "face-api.js";
 function Textchanger() {
  const videoRef = useRef(null);
  const verificationInterval = useRef(null);

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [name, setName] = useState("");
  const [multipleFaces, setMultipleFaces] = useState(false);
  const lastMatchedRef = useRef(null);
useEffect(() => {
  initialize();

  window.receiveFaceData = (faces) => {
  try {
    console.log("=================================");
    console.log("DATA RECEIVED FROM REACT NATIVE");
    console.log(faces);
    console.log("TOTAL:", faces.length);
    console.log("=================================");

    const converted = faces.map((item) => ({
      name: item.employeeid,
      descriptor: String(item.faceembedding)
        .split(",")
        .map(Number),
    }));

    localStorage.setItem(
      "registeredFaces",
      JSON.stringify(converted)
    );

    // alert(`Received ${converted.length} faces from mobile app`);

    setMessage(
      `✅ RECEIVED ${converted.length} FACES FROM MOBILE`
    );
  } catch (error) {
    console.log("receiveFaceData error:", error);
  }
};

  if (window.allFacesFromRN) {
    window.receiveFaceData(window.allFacesFromRN);
  }
console.log(
  "window.allFacesFromRN:",
  window.allFacesFromRN
);
  return () => {
    if (verificationInterval.current) {
      clearInterval(verificationInterval.current);
    }
  };
}, []);

  const initialize = async () => {
    try {
      const MODEL_URL =
        "https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js/weights";

      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      ]);

      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      setLoading(false);
      setMessage("✅ Models Loaded");

setTimeout(() => {
  startVerification();
}, 1000);
    } catch (error) {
      console.error(error);
      setMessage("❌ Failed to load models or camera");
    }
  };

  const getFaceDetections = async () => {
    if (!videoRef.current) return [];

    return await faceapi.detectAllFaces(
      videoRef.current,
      new faceapi.TinyFaceDetectorOptions()
    );
  };

  const getDescriptorFromVideo = async () => {
    if (!videoRef.current) return null;

    const detection = await faceapi
      .detectSingleFace(
        videoRef.current,
        new faceapi.TinyFaceDetectorOptions()
      )
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!detection) return null;

    return detection.descriptor;
  };

  const registerFace = async () => {
  try {
    if (!name.trim()) {
      setMessage("❌ Enter Name First");
      return;
    }

    setMessage("Registering Face...");

    const descriptor = await getDescriptorFromVideo();

    if (!descriptor) {
      setMessage("❌ No Face Detected");
      return;
    }

    const faceData = {
      name: name.trim(),
      descriptor: Array.from(descriptor),
      registeredAt: new Date().toISOString(),
    };

    const registeredFaces =
      JSON.parse(localStorage.getItem("registeredFaces")) || [];

    registeredFaces.push(faceData);

    localStorage.setItem(
      "registeredFaces",
      JSON.stringify(registeredFaces)
    );

    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(
        JSON.stringify({
          type: "FACE_REGISTERED",
          data: faceData,
        })
      );
    }

    setMessage(
      `✅ ${name} Registered & Sent To Mobile`
    );

    setName("");
  } catch (error) {
    console.log(error);
    setMessage("❌ Registration Failed");
  }
};
  // const registerFace = async () => {
  //   try {
  //     if (!name.trim()) {
  //       setMessage("❌ Enter Name First");
  //       return;
  //     }

  //     setMessage("Registering Face...");

  //     const descriptor = await getDescriptorFromVideo();

  //     if (!descriptor) {
  //       setMessage("❌ No Face Detected");
  //       return;
  //     }

  //     const registeredFaces =
  //       JSON.parse(localStorage.getItem("registeredFaces")) || [];

  //     registeredFaces.push({
  //       name: name.trim(),
  //       descriptor: Array.from(descriptor),
  //     });

  //     localStorage.setItem(
  //       "registeredFaces",
  //       JSON.stringify(registeredFaces)
  //     );

  //     setMessage(`✅ ${name} Registered Successfully`);
  //     setName("");
  //   } catch (error) {
  //     console.log(error);
  //     setMessage("❌ Registration Failed");
  //   }
  // };

  const startVerification = async () => {
  if (verificationInterval.current) {
    clearInterval(verificationInterval.current);
  }

  setIsVerifying(true);
  setMessage("🔍 Verification Started");

  verificationInterval.current = setInterval(async () => {
    try {
      const registeredFaces =
        JSON.parse(localStorage.getItem("registeredFaces")) || [];

      if (registeredFaces.length === 0) {
        setMessage("❌ No Faces Loaded");
        return;
      }

      const faces = await getFaceDetections();

      if (faces.length === 0) {
        setMultipleFaces(false);
        setMessage("⚠️ No Face Detected");
        return;
      }

      if (faces.length > 1) {
        setMultipleFaces(true);
        setMessage("❌ Multiple Faces Detected\nOnly one face at a time");
        return;
      }

      setMultipleFaces(false);

      const descriptor = await getDescriptorFromVideo();

      if (!descriptor) {
        setMessage("⚠️ No Face Detected");
        return;
      }

      let bestMatch = null;
      let bestDistance = 999;

      for (const person of registeredFaces) {
        const savedDescriptor = new Float32Array(
          person.descriptor
        );

        const distance = faceapi.euclideanDistance(
          descriptor,
          savedDescriptor
        );

        if (distance < bestDistance) {
          bestDistance = distance;
          bestMatch = person.name;
        }
      }

//       if (bestDistance < 0.5) {
//         setMessage(
//           `🟢 MATCH

// Name: ${bestMatch}

// Distance: ${bestDistance.toFixed(4)}`
//         );
//         if (window.ReactNativeWebView) {
//   window.ReactNativeWebView.postMessage(
//     JSON.stringify({
//       type: "FACE_MATCHED",
//       employeeid: bestMatch,
//       distance: bestDistance,
//       timestamp: new Date().toISOString(),
//     })
//   );
// }
//       } 
      
      if (bestDistance < 0.5) {

  if (lastMatchedRef.current !== bestMatch) {

    lastMatchedRef.current = bestMatch;

    window.ReactNativeWebView?.postMessage(
      JSON.stringify({
        type: "FACE_MATCHED",
        employeeid: bestMatch,
        distance: bestDistance,
        timestamp: new Date().toISOString(),
      })
    );
  }

  setMessage(`🟢 MATCH
Name: ${bestMatch}
Distance: ${bestDistance.toFixed(4)}`);
}
      
      else {
        setMessage(
          `🔴 UNKNOWN PERSON

Distance: ${bestDistance.toFixed(4)}`
        );
      }
    } catch (error) {
      console.log(error);
    }
  }, 1000);
};

  const stopVerification = () => {
    if (verificationInterval.current) {
      clearInterval(verificationInterval.current);
      verificationInterval.current = null;
    }

    setIsVerifying(false);
    setMessage("⏹ Verification Stopped");
  };

  const clearRegisteredFaces = () => {
    localStorage.removeItem("registeredFaces");

    if (verificationInterval.current) {
      clearInterval(verificationInterval.current);
      verificationInterval.current = null;
    }

    setIsVerifying(false);
    setMessage("🗑 All Registered Faces Removed");
  };

  
// return (
//   <div
//     style={{
//       textAlign: "center",
//       padding: "20px",
//       fontFamily: "Arial",
//       width: "100%",
//       boxSizing: "border-box",
//     }}
//   >
//     <h1
//       style={{
//         fontSize: "clamp(24px, 4vw, 40px)",
//         marginBottom: 20,
//       }}
//     >
//       Live Face Recognition
//     </h1>

//     {loading && <h3>Loading Models...</h3>}

//     <div
//       style={{
//         position: "relative",
//         display: "inline-block",
//         width: "90%",
//         maxWidth: "900px",
//       }}
//     >
//       <video
//         ref={videoRef}
//         autoPlay
//         muted
//         playsInline
//         style={{
//           width: "100%",
//           height: "auto",
//           border: "2px solid black",
//           borderRadius: 10,
//           display: "block",
//           //  display: "block",
//     transform: "scaleX(-1)",
//         }}
//       />

//       {multipleFaces && (
//         <div
//           style={{
//             position: "absolute",
//             top: 0,
//             left: 0,
//             width: "100%",
//             height: "100%",
//             background: "rgba(255, 0, 0, 0.55)",
//             color: "#fff",
//             display: "flex",
//             alignItems: "center",
//             justifyContent: "center",
//             fontSize: "clamp(24px, 2vw, 32px)",
//             fontWeight: "bold",
//             borderRadius: 10,
//             textAlign: "center",
//             padding: "20px",
//             boxSizing: "border-box",
//           }}
//         >
//           One Face At A Time
//         </div>
//       )}
//     </div>

//     <br />
//     <br />

//     <input
//       type="text"
//       placeholder="Enter Name"
//       value={name}
//       onChange={(e) => setName(e.target.value)}
//       style={{
//         padding: "12px",
//         width: "90%",
//         maxWidth: "400px",
//         fontSize: "18px",
//         marginBottom: "15px",
//         borderRadius: "8px",
//         boxSizing: "border-box",
//       }}
//     />

//     <br />

//     <div
//       style={{
//         display: "flex",
//         flexWrap: "wrap",
//         justifyContent: "center",
//         gap: "10px",
//       }}
//     >
//       <button
//         onClick={registerFace}
//         style={{
//           padding: "14px 24px",
//           minWidth: "180px",
//           fontSize: "16px",
//           cursor: "pointer",
//         }}
//       >
//         Register Face
//       </button>

//       {!isVerifying ? (
//         <button
//           onClick={startVerification}
//           style={{
//             padding: "14px 24px",
//             minWidth: "180px",
//             fontSize: "16px",
//             cursor: "pointer",
//           }}
//         >
//           Start Verification
//         </button>
//       ) : (
//         <button
//           onClick={stopVerification}
//           style={{
//             padding: "14px 24px",
//             minWidth: "180px",
//             fontSize: "16px",
//             cursor: "pointer",
//           }}
//         >
//           Stop Verification
//         </button>
//       )}

//       <button
//         onClick={clearRegisteredFaces}
//         style={{
//           padding: "14px 24px",
//           minWidth: "180px",
//           fontSize: "16px",
//           cursor: "pointer",
//         }}
//       >
//         Clear Faces
//       </button>
//     </div>

//     <div
//       style={{
//         marginTop: 20,
//         whiteSpace: "pre-line",
//         fontSize: "clamp(18px, 2vw, 24px)",
//         fontWeight: "bold",
//         padding: "0 10px",
//       }}
//     >
//       {message}
//     </div>
//   </div>
// );
return (
  <div
    style={{
      minHeight: "100vh",
      background: "#f8f9fb",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      padding: "24px 20px 32px",
      boxSizing: "border-box",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    }}
  >
    {/* Top Bar */}
    <div
      style={{
        width: "100%",
        maxWidth: 760,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 28,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div
          style={{
            width: 32,
            height: 32,
            background: "#111",
            borderRadius: 8,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
          </svg>
        </div>
        <span style={{ fontWeight: 600, fontSize: 15, color: "#111" }}>
          Face Attendance
        </span>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          background: loading ? "#f1f5f9" : isVerifying ? "#eff6ff" : "#f0fdf4",
          border: `1px solid ${loading ? "#e2e8f0" : isVerifying ? "#bfdbfe" : "#bbf7d0"}`,
          color: loading ? "#64748b" : isVerifying ? "#2563eb" : "#16a34a",
          padding: "6px 14px",
          borderRadius: 999,
          fontSize: 13,
          fontWeight: 500,
        }}
      >
        <div
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: loading ? "#94a3b8" : isVerifying ? "#2563eb" : "#16a34a",
          }}
        />
        {loading ? "Loading models…" : isVerifying ? "Verification active" : "Ready"}
      </div>
    </div>

    {/* Camera Card */}
    <div
      style={{
        width: "100%",
        maxWidth: 760,
        background: "#fff",
        borderRadius: 20,
        border: "1px solid #e9ecef",
        overflow: "hidden",
        boxShadow: "0 2px 16px rgba(0,0,0,0.06)",
      }}
    >
      {/* Camera View */}
      <div style={{ position: "relative", background: "#0a0a0f" }}>
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          style={{
            width: "100%",
            display: "block",
            transform: "scaleX(-1)",
            minHeight: 340,
            objectFit: "cover",
          }}
        />

        {/* Face oval guide */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            width: 200,
            height: 250,
            transform: "translate(-50%, -50%)",
            border: "2px solid rgba(255,255,255,0.4)",
            borderRadius: "50%",
            pointerEvents: "none",
          }}
        />

        {/* Corner brackets */}
        {[
          { top: "calc(50% - 128px)", left: "calc(50% - 103px)", borderTop: "2px solid #fff", borderLeft: "2px solid #fff", borderRadius: "4px 0 0 0" },
          { top: "calc(50% - 128px)", left: "calc(50% + 83px)", borderTop: "2px solid #fff", borderRight: "2px solid #fff", borderRadius: "0 4px 0 0" },
          { top: "calc(50% + 108px)", left: "calc(50% - 103px)", borderBottom: "2px solid #fff", borderLeft: "2px solid #fff", borderRadius: "0 0 0 4px" },
          { top: "calc(50% + 108px)", left: "calc(50% + 83px)", borderBottom: "2px solid #fff", borderRight: "2px solid #fff", borderRadius: "0 0 4px 0" },
        ].map((s, i) => (
          <div key={i} style={{ position: "absolute", width: 20, height: 20, pointerEvents: "none", ...s }} />
        ))}

        {/* Multiple faces warning overlay */}
        {multipleFaces && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(220,38,38,0.82)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <span style={{ color: "#fff", fontSize: 18, fontWeight: 600 }}>One face at a time</span>
            <span style={{ color: "rgba(255,255,255,0.75)", fontSize: 13 }}>Please ensure only one person is in frame</span>
          </div>
        )}
      </div>

      {/* Stats strip */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          borderTop: "1px solid #f1f3f5",
        }}
      >
        {[
          { label: "Status", value: loading ? "Loading" : isVerifying ? "Scanning" : "Idle", color: isVerifying ? "#2563eb" : "#64748b" },
          { label: "Detection", value: multipleFaces ? "Multiple" : "Single", color: multipleFaces ? "#dc2626" : "#16a34a" },
          { label: "Mode", value: "Auto verify", color: "#64748b" },
        ].map((stat, i) => (
          <div
            key={i}
            style={{
              padding: "14px 18px",
              borderRight: i < 2 ? "1px solid #f1f3f5" : "none",
            }}
          >
            <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 3 }}>
              {stat.label}
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: stat.color }}>
              {stat.value}
            </div>
          </div>
        ))}
      </div>
    </div>

    {/* Message Card */}
    <div
      style={{
        marginTop: 16,
        width: "100%",
        maxWidth: 760,
        background: "#fff",
        border: "1px solid #e9ecef",
        borderRadius: 16,
        padding: "16px 20px",
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
      }}
    >
      {/* Icon based on message type */}
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: message.includes("MATCH") || message.includes("✅")
            ? "#f0fdf4"
            : message.includes("❌") || message.includes("UNKNOWN")
            ? "#fef2f2"
            : "#eff6ff",
        }}
      >
        {message.includes("MATCH") || message.includes("✅") ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        ) : message.includes("❌") || message.includes("UNKNOWN") ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        )}
      </div>

      <div>
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: "#111",
            whiteSpace: "pre-line",
            lineHeight: 1.6,
          }}
        >
          {message || "Initializing…"}
        </div>
      </div>
    </div>
  </div>
);

}

export default Textchanger;