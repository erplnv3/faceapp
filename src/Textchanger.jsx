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
    width: "100%",
    maxWidth: 1400,
    flex: 1,
    display: "grid",
    gridTemplateColumns: "260px 1fr 260px",
    gap: 20,
    minHeight: 0,
    height: "calc(100vh - 8px)", // adjust as needed
  }}
>
  {/* LEFT PANEL */}
  <div
    style={{
      background: "#fff",
      borderRadius: 20,
      border: "1px solid #e9ecef",
      padding: 20,
      display: "flex",
      flexDirection: "column",
      gap: 20,
      boxShadow: "0 2px 16px rgba(0,0,0,0.06)",
    }}
  >
    <div>
      <div
        style={{
          fontSize: 11,
          color: "#94a3b8",
          marginBottom: 6,
          letterSpacing: "0.05em",
        }}
      >
        STATUS
      </div>

      <div
        style={{
          fontSize: 24,
          fontWeight: 700,
          color: loading
            ? "#64748b"
            : isVerifying
            ? "#2563eb"
            : "#16a34a",
        }}
      >
        {loading ? "Loading" : isVerifying ? "Scanning" : "Ready"}
      </div>
    </div>

    <div>
      <div
        style={{
          fontSize: 11,
          color: "#94a3b8",
          marginBottom: 6,
          letterSpacing: "0.05em",
        }}
      >
        DETECTION
      </div>

      <div
        style={{
          fontSize: 24,
          fontWeight: 700,
          color: multipleFaces ? "#dc2626" : "#16a34a",
        }}
      >
        {multipleFaces ? "Multiple" : "Single"}
      </div>
    </div>

    <div>
      <div
        style={{
          fontSize: 11,
          color: "#94a3b8",
          marginBottom: 6,
          letterSpacing: "0.05em",
        }}
      >
        MODE
      </div>

      <div
        style={{
          fontSize: 24,
          fontWeight: 700,
          color: "#111",
        }}
      >
        Auto Verify
      </div>
    </div>
  </div>

  {/* CENTER CAMERA */}
  <div
    style={{
      background: "#fff",
      borderRadius: 20,
      border: "1px solid #e9ecef",
      overflow: "hidden",
      position: "relative",
      boxShadow: "0 2px 16px rgba(0,0,0,0.06)",
    }}
  >
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        background: "#000",
      }}
    >
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: "scaleX(-1)",
        }}
      />

      {/* Face Guide */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: 220,
          height: 280,
          transform: "translate(-50%, -50%)",
          border: "2px solid rgba(255,255,255,0.5)",
          borderRadius: "50%",
          pointerEvents: "none",
        }}
      />

      {/* Multiple Faces Warning */}
      {multipleFaces && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(220,38,38,0.85)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            color: "#fff",
            gap: 12,
          }}
        >
          <div
            style={{
              fontSize: 30,
              fontWeight: 700,
            }}
          >
            ⚠️
          </div>

          <div
            style={{
              fontSize: 22,
              fontWeight: 700,
            }}
          >
            One Face At A Time
          </div>

          <div
            style={{
              fontSize: 14,
              opacity: 0.9,
            }}
          >
            Please ensure only one person is visible
          </div>
        </div>
      )}
    </div>
  </div>

  {/* RIGHT PANEL */}
  <div
    style={{
      background: "#fff",
      borderRadius: 20,
      border: "1px solid #e9ecef",
      padding: 20,
      display: "flex",
      flexDirection: "column",
      boxShadow: "0 2px 16px rgba(0,0,0,0.06)",
    }}
  >
    <div
      style={{
        fontSize: 11,
        color: "#94a3b8",
        marginBottom: 12,
        letterSpacing: "0.05em",
      }}
    >
      VERIFICATION RESULT
    </div>

    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontSize: 70,
          marginBottom: 20,
        }}
      >
        {message.includes("MATCH") || message.includes("✅")
          ? "✅"
          : message.includes("UNKNOWN") || message.includes("❌")
          ? "❌"
          : "👤"}
      </div>

      <div
        style={{
          fontSize: 18,
          fontWeight: 700,
          color: "#111",
          whiteSpace: "pre-line",
          lineHeight: 1.6,
        }}
      >
        {message || "Waiting for face..."}
      </div>
    </div>
  </div>
</div>
);

}

export default Textchanger;