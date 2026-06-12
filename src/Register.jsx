import React, { useEffect, useRef, useState } from "react";
import * as faceapi from "face-api.js";
 function Register() {
  const videoRef = useRef(null);
  const verificationInterval = useRef(null);

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [name, setName] = useState("");
  const [multipleFaces, setMultipleFaces] = useState(false);
  const lastMatchedRef = useRef(null);
  const [isRegistering, setIsRegistering] = useState(false);
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
      ` RECEIVED ${converted.length} FACES FROM MOBILE`
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
      // const MODEL_URL =
      //   "https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js/weights";
  const MODEL_URL = "/models";
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
      setMessage("Models Loaded");
    } catch (error) {
      console.error(error);
      setMessage(" Failed to load models or camera");
    }
  };
const [activeTab, setActiveTab] = useState("register");
const [faceCount, setFaceCount] = useState(0);

useEffect(() => {
  const faces =
    JSON.parse(localStorage.getItem("registeredFaces")) || [];

  setFaceCount(faces.length);
}, [message]);

useEffect(() => {
  const handleRegistrationResult = (event) => {
    const result = event.detail;

    setIsRegistering(false);

    if (result.success) {
      alert(result.message || "Face Registered Successfully");
      setName("");
    } else {
      alert(result.message || "Registration Failed");
    }
  };

  window.addEventListener(
    "registrationResult",
    handleRegistrationResult
  );

  return () => {
    window.removeEventListener(
      "registrationResult",
      handleRegistrationResult
    );
  };
}, []);

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

//   const registerFace = async () => {
//       if (isRegistering) return;
//   try {
//     if (!name.trim()) {
//       setMessage(" Enter Name First");
//       return;
//     }

//     setMessage("Registering Face...");

//     const descriptor = await getDescriptorFromVideo();

//     if (!descriptor) {
//       setMessage(" No Face Detected");
//       return;
//     }

//     const faceData = {
//       name: name.trim(),
//       descriptor: Array.from(descriptor),
//       registeredAt: new Date().toISOString(),
//     };

//     const registeredFaces =
//       JSON.parse(localStorage.getItem("registeredFaces")) || [];

//     registeredFaces.push(faceData);

//     localStorage.setItem(
//       "registeredFaces",
//       JSON.stringify(registeredFaces)
//     );

//     if (window.ReactNativeWebView) {
//       window.ReactNativeWebView.postMessage(
//         JSON.stringify({
//           type: "FACE_REGISTERED",
//           data: faceData,
//         })
//       );
//     }

//     setMessage(
//       ` ${name} Registered & Sent To Mobile`
//     );

//     setName("");
//   } catch (error) {
//     console.log(error);
//     setMessage(" Registration Failed");
//   }
// };
  // const registerFace = async () => {
  //   try {
  //     if (!name.trim()) {
  //       setMessage(" Enter Name First");
  //       return;
  //     }

  //     setMessage("Registering Face...");

  //     const descriptor = await getDescriptorFromVideo();

  //     if (!descriptor) {
  //       setMessage(" No Face Detected");
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

  //     setMessage(` ${name} Registered Successfully`);
  //     setName("");
  //   } catch (error) {
  //     console.log(error);
  //     setMessage(" Registration Failed");
  //   }
  // };
const registerFace = async () => {
  if (isRegistering) return;

  try {
    if (!name.trim()) {
      alert("Please enter Employee ID");
      return;
    }

    setIsRegistering(true);
    setMessage("Registering Face...");

    const descriptor = await getDescriptorFromVideo();

    if (!descriptor) {
      alert("No Face Detected");
      return;
    }

    const faceData = {
      name: name.trim(),
      descriptor: Array.from(descriptor),
      registeredAt: new Date().toISOString(),
    };

    window.ReactNativeWebView?.postMessage(
      JSON.stringify({
        type: "FACE_REGISTERED",
        data: faceData,
      })
    );
  } catch (error) {
    console.log(error);
    alert("Registration Failed");
    setIsRegistering(false);
  }
};
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
        setMessage(" No Faces Loaded");
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
        setMessage(" Multiple Faces Detected\nOnly one face at a time");
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
      
      if (bestDistance < 0.43) {

  if (lastMatchedRef.current !== bestMatch) {

    lastMatchedRef.current = bestMatch;

    // window.ReactNativeWebView?.postMessage(
    //   JSON.stringify({
    //     type: "FACE_MATCHED",
    //     employeeid: bestMatch,
    //     distance: bestDistance,
    //     timestamp: new Date().toISOString(),
    //   })
    // );
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

  
return (
  <div
    style={{
      minHeight: "100vh",
      background: "#f3f6fb",
      padding: 24,
      fontFamily:
        "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
    }}
  >
    {/* HEADER */}
    <div
      style={{
        background: "#fff",
        borderRadius: 24,
        padding: 20,
        marginBottom: 20,
        border: "1px solid #e5e7eb",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <div>
        <h1
          style={{
            margin: 0,
            color: "#111827",
            fontSize: 32,
            fontWeight: 700,
          }}
        >
          Face Recognition
        </h1>

        <div
          style={{
            color: "#64748b",
            marginTop: 6,
          }}
        >
          Employee Verification System
        </div>
      </div>

      <div
        style={{
          padding: "10px 18px",
          borderRadius: 999,
          background: loading ? "#fef3c7" : "#dcfce7",
          color: loading ? "#92400e" : "#166534",
          fontWeight: 600,
        }}
      >
        {loading ? "Loading..." : "System Ready"}
      </div>
    </div>

    {/* MAIN */}
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "280px 1fr 280px",
        gap: 20,
        minHeight: "75vh",
      }}
    >
      {/* LEFT PANEL */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <div
          style={{
            background: "#fff",
            borderRadius: 20,
            padding: 20,
            border: "1px solid #e5e7eb",
          }}
        >
          <div
            style={{
              color: "#64748b",
              fontSize: 14,
            }}
          >
            Registered Faces
          </div>

          <div
            style={{
              color: "#111827",
              fontSize: 42,
              fontWeight: 700,
              marginTop: 10,
            }}
          >
            {faceCount}
          </div>
        </div>

        <div
          style={{
            background: "#fff",
            borderRadius: 20,
            padding: 20,
            border: "1px solid #e5e7eb",
          }}
        >
          <div
            style={{
              color: "#64748b",
            }}
          >
            Verification
          </div>

          <div
            style={{
              marginTop: 10,
              fontWeight: 700,
              color: isVerifying
                ? "#16a34a"
                : "#ef4444",
            }}
          >
            {isVerifying
              ? "ACTIVE"
              : "STOPPED"}
          </div>
        </div>

        <div
          style={{
            background: "#fff",
            borderRadius: 20,
            padding: 20,
            border: "1px solid #e5e7eb",
          }}
        >
          <div
            style={{
              color: "#64748b",
            }}
          >
            Face Status
          </div>

          <div
            style={{
              marginTop: 10,
              fontWeight: 700,
              color: "#111827",
            }}
          >
            {multipleFaces
              ? "MULTIPLE"
              : "SINGLE"}
          </div>
        </div>

        <div
      style={{
        marginTop: 20,
        background: "#fff",
        borderRadius: 20,
        padding: 20,
        border: "1px solid #e5e7eb",
      }}
    >
      <div
        style={{
          color: "#64748b",
          marginBottom: 10,
        }}
      >
        STATUS
      </div>

      <div
        style={{
          color: "#111827",
          fontSize: 18,
          fontWeight: 600,
          whiteSpace: "pre-line",
        }}
      >
        {message}
      </div>
    </div>
      </div>

      {/* CENTER CAMERA */}
      <div
        style={{
          background: "#fff",
          borderRadius: 30,
          overflow: "hidden",
          border: "1px solid #e5e7eb",
          position: "relative",
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

        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform:
              "translate(-50%, -50%)",
            width: 280,
            height: 340,
            borderRadius: "50%",
            border: "4px solid #2563eb",
            boxShadow:
              "0 0 0 9999px rgba(255,255,255,.35)",
          }}
        />

        {multipleFaces && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "rgba(255,255,255,.92)",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              color: "#dc2626",
              fontSize: 32,
              fontWeight: 700,
            }}
          >
            ONE FACE AT A TIME
          </div>
        )}
      </div>

      {/* RIGHT PANEL */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        {/* TABS */}
        <div
          style={{
            background: "#fff",
            borderRadius: 20,
            padding: 12,
            border: "1px solid #e5e7eb",
          }}
        >
          {["register", "verify", "settings"].map(
            (tab) => (
              <button
                key={tab}
                onClick={() =>
                  setActiveTab(tab)
                }
                style={{
                  width: "100%",
                  marginBottom: 8,
                  padding: 14,
                  borderRadius: 12,
                  border: "none",
                  cursor: "pointer",
                  fontWeight: 600,
                  background:
                    activeTab === tab
                      ? "#2563eb"
                      : "#f1f5f9",
                  color:
                    activeTab === tab
                      ? "#fff"
                      : "#111827",
                }}
              >
                {tab.toUpperCase()}
              </button>
            )
          )}
        </div>

        {activeTab === "register" && (
          <div
            style={{
              background: "#fff",
              borderRadius: 20,
              padding: 20,
              border: "1px solid #e5e7eb",
            }}
          >
            <input
              type="text"
              value={name}
              onChange={(e) =>
                setName(e.target.value)
              }
              placeholder="Employee ID"
              style={{
                width: "100%",
                padding: 14,
                borderRadius: 12,
                border:
                  "1px solid #d1d5db",
                marginBottom: 14,
              }}
            />

           <button
  onClick={registerFace}
  disabled={isRegistering}
  style={{
    width: "100%",
    padding: 14,
    borderRadius: 12,
    border: "none",
    background: isRegistering ? "#94a3b8" : "#2563eb",
    color: "#fff",
    fontWeight: 700,
    cursor: isRegistering ? "not-allowed" : "pointer",
  }}
>
  {isRegistering ? "Registering..." : "Register Face"}
</button>
          </div>
        )}

        {activeTab === "verify" && (
          <div
            style={{
              background: "#fff",
              borderRadius: 20,
              padding: 20,
              border: "1px solid #e5e7eb",
            }}
          >
            <button
              onClick={
                isVerifying
                  ? stopVerification
                  : startVerification
              }
              style={{
                width: "100%",
                padding: 14,
                borderRadius: 12,
                border: "none",
                background: isVerifying
                  ? "#ef4444"
                  : "#16a34a",
                color: "#fff",
                fontWeight: 700,
              }}
            >
              {isVerifying
                ? "Stop Verification"
                : "Start Verification"}
            </button>
          </div>
        )}

        {activeTab === "settings" && (
          <div
            style={{
              background: "#fff",
              borderRadius: 20,
              padding: 20,
              border: "1px solid #e5e7eb",
            }}
          >
            <button
              onClick={clearRegisteredFaces}
              style={{
                width: "100%",
                padding: 14,
                borderRadius: 12,
                border: "none",
                background: "#dc2626",
                color: "#fff",
                fontWeight: 700,
              }}
            >
              Clear Faces
            </button>
          </div>
        )}
      </div>
    </div>

    {/* STATUS */}
    
  </div>
);
 

}

export default Register;