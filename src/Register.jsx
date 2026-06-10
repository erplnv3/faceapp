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

    alert(`Received ${converted.length} faces from mobile app`);

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
    } catch (error) {
      console.error(error);
      setMessage("❌ Failed to load models or camera");
    }
  };
const [activeTab, setActiveTab] = useState("register");
const [faceCount, setFaceCount] = useState(0);

useEffect(() => {
  const faces =
    JSON.parse(localStorage.getItem("registeredFaces")) || [];

  setFaceCount(faces.length);
}, [message]);
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
      background: "#000",
      color: "#fff",
      padding: "24px",
      fontFamily:
        "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
    }}
  >
    <div
      style={{
        maxWidth: "1400px",
        margin: "0 auto",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "24px",
          flexWrap: "wrap",
          gap: "15px",
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: "32px",
              fontWeight: 700,
            }}
          >
            Face Recognition
          </h1>

          <p
            style={{
              color: "#888",
              marginTop: 5,
            }}
          >
            Employee Verification System
          </p>
        </div>

        <div
          style={{
            padding: "8px 16px",
            border: "1px solid #222",
            borderRadius: "999px",
            background: "#0a0a0a",
          }}
        >
          {loading ? "Loading..." : "System Ready"}
        </div>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          gap: 8,
          padding: 6,
          background: "#111",
          borderRadius: 14,
          width: "fit-content",
          border: "1px solid #222",
          marginBottom: 20,
        }}
      >
        {["register", "verify", "settings"].map(
          (tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: "12px 24px",
                borderRadius: 10,
                border: "none",
                cursor: "pointer",
                fontWeight: 600,
                background:
                  activeTab === tab
                    ? "#fff"
                    : "transparent",
                color:
                  activeTab === tab
                    ? "#000"
                    : "#888",
              }}
            >
              {tab.toUpperCase()}
            </button>
          )
        )}
      </div>

      {/* Stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit,minmax(220px,1fr))",
          gap: 16,
          marginBottom: 20,
        }}
      >
        <div
          style={{
            background: "#0a0a0a",
            border: "1px solid #222",
            borderRadius: 20,
            padding: 24,
          }}
        >
          <p style={{ color: "#888" }}>
            Registered Faces
          </p>
          <h1>{faceCount}</h1>
        </div>

        <div
          style={{
            background: "#0a0a0a",
            border: "1px solid #222",
            borderRadius: 20,
            padding: 24,
          }}
        >
          <p style={{ color: "#888" }}>
            Verification
          </p>
          <h2>
            {isVerifying
              ? "ACTIVE"
              : "STOPPED"}
          </h2>
        </div>

        <div
          style={{
            background: "#0a0a0a",
            border: "1px solid #222",
            borderRadius: 20,
            padding: 24,
          }}
        >
          <p style={{ color: "#888" }}>
            Face Status
          </p>
          <h2>
            {multipleFaces
              ? "MULTIPLE"
              : "SINGLE"}
          </h2>
        </div>
      </div>

      {/* Camera */}
      <div
        style={{
          background: "#0a0a0a",
          border: "1px solid #222",
          borderRadius: 24,
          overflow: "hidden",
          marginBottom: 20,
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
            display: "block",
          }}
        />

        {multipleFaces && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "rgba(0,0,0,.85)",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              fontSize: "32px",
              fontWeight: 700,
            }}
          >
            ONE FACE AT A TIME
          </div>
        )}
      </div>

      {/* Register */}
      {activeTab === "register" && (
        <div
          style={{
            background: "#0a0a0a",
            border: "1px solid #222",
            borderRadius: 20,
            padding: 24,
          }}
        >
          <h2>Register Employee</h2>

          <input
            type="text"
            value={name}
            onChange={(e) =>
              setName(e.target.value)
            }
            placeholder="Enter Employee ID"
            style={{
              width: "100%",
              background: "#000",
              border: "1px solid #222",
              color: "#fff",
              padding: 16,
              borderRadius: 14,
              marginTop: 15,
              marginBottom: 20,
              outline: "none",
              fontSize: 16,
            }}
          />

          <button
            onClick={registerFace}
            style={{
              background: "#fff",
              color: "#000",
              border: "none",
              borderRadius: 14,
              padding: "14px 24px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Register Face
          </button>
        </div>
      )}

      {/* Verify */}
      {activeTab === "verify" && (
        <div
          style={{
            background: "#0a0a0a",
            border: "1px solid #222",
            borderRadius: 20,
            padding: 24,
          }}
        >
          {!isVerifying ? (
            <button
              onClick={startVerification}
              style={{
                background: "#fff",
                color: "#000",
                border: "none",
                borderRadius: 14,
                padding: "14px 24px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Start Verification
            </button>
          ) : (
            <button
              onClick={stopVerification}
              style={{
                background: "#fff",
                color: "#000",
                border: "none",
                borderRadius: 14,
                padding: "14px 24px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Stop Verification
            </button>
          )}
        </div>
      )}

      {/* Settings */}
      {activeTab === "settings" && (
        <div
          style={{
            background: "#0a0a0a",
            border: "1px solid #222",
            borderRadius: 20,
            padding: 24,
          }}
        >
          <button
            onClick={clearRegisteredFaces}
            style={{
              background: "#fff",
              color: "#000",
              border: "none",
              borderRadius: 14,
              padding: "14px 24px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Clear All Faces
          </button>
        </div>
      )}

      {/* Status Panel */}
      <div
        style={{
          marginTop: 20,
          background: "#0a0a0a",
          border: "1px solid #222",
          borderRadius: 20,
          padding: 20,
          whiteSpace: "pre-line",
        }}
      >
        <div
          style={{
            color: "#888",
            marginBottom: 10,
          }}
        >
          STATUS
        </div>

        <div
          style={{
            fontSize: 18,
            fontWeight: 600,
          }}
        >
          {message}
        </div>
      </div>
    </div>
  </div>
);
 

}

export default Register;