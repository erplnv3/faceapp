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
      padding: 24,
      fontFamily:
        "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
    }}
  >
    <div
      style={{
        maxWidth: 1500,
        margin: "0 auto",
      }}
    >
      {/* HEADER */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
        }}
      >
        <div style={{ display: "flex", gap: 14 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 16,
              background: "#111",
              border: "1px solid #222",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            {/* Feather Camera */}
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2"
            >
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
          </div>

          <div>
            <h1
              style={{
                margin: 0,
                fontSize: 34,
              }}
            >
              FaceID Attendance
            </h1>

            <div
              style={{
                color: "#666",
              }}
            >
              Employee Verification System
            </div>
          </div>
        </div>

        <div
          style={{
            padding: "10px 18px",
            borderRadius: 999,
            background: "#111",
            border: "1px solid #222",
          }}
        >
          {loading ? "Loading Models" : "System Ready"}
        </div>
      </div>

      {/* STATS */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3,1fr)",
          gap: 16,
          marginBottom: 20,
        }}
      >
        {/* Registered */}
        <div
          style={{
            background: "#0a0a0a",
            border: "1px solid #222",
            borderRadius: 20,
            padding: 24,
          }}
        >
          <div style={{ color: "#777" }}>
            Registered Faces
          </div>

          <div
            style={{
              fontSize: 42,
              fontWeight: 700,
              marginTop: 10,
            }}
          >
            {faceCount}
          </div>
        </div>

        {/* Verification */}
        <div
          style={{
            background: "#0a0a0a",
            border: "1px solid #222",
            borderRadius: 20,
            padding: 24,
          }}
        >
          <div style={{ color: "#777" }}>
            Verification
          </div>

          <div
            style={{
              marginTop: 10,
              fontSize: 24,
              fontWeight: 700,
              color: isVerifying
                ? "#22c55e"
                : "#ef4444",
            }}
          >
            {isVerifying
              ? "ACTIVE"
              : "STOPPED"}
          </div>
        </div>

        {/* Face Status */}
        <div
          style={{
            background: "#0a0a0a",
            border: "1px solid #222",
            borderRadius: 20,
            padding: 24,
          }}
        >
          <div style={{ color: "#777" }}>
            Face Status
          </div>

          <div
            style={{
              marginTop: 10,
              fontSize: 24,
              fontWeight: 700,
            }}
          >
            {multipleFaces
              ? "MULTIPLE"
              : "SINGLE"}
          </div>
        </div>
      </div>

      {/* CAMERA */}
      <div
        style={{
          position: "relative",
          borderRadius: 30,
          overflow: "hidden",
          border: "1px solid #222",
          background: "#111",
        }}
      >
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          style={{
            width: "100%",
            height: "70vh",
            objectFit: "cover",
            transform: "scaleX(-1)",
          }}
        />

        {/* FACE GUIDE */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform:
              "translate(-50%,-50%)",
          }}
        >
          <div
            style={{
              width: 280,
              height: 340,
              borderRadius: "50%",
              border:
                "3px solid rgba(255,255,255,.8)",
              boxShadow:
                "0 0 0 9999px rgba(0,0,0,.45)",
            }}
          />

          <div
            style={{
              textAlign: "center",
              marginTop: 20,
              fontSize: 14,
            }}
          >
            Position Face Inside Guide
          </div>
        </div>

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
              fontSize: 34,
              fontWeight: 700,
              color: "#ef4444",
            }}
          >
            ONE FACE AT A TIME
          </div>
        )}
      </div>

      {/* STATUS BAR */}
      <div
        style={{
          marginTop: 20,
          background: "#0a0a0a",
          border: "1px solid #222",
          borderRadius: 20,
          padding: 20,
        }}
      >
        <div
          style={{
            color: "#666",
            marginBottom: 10,
          }}
        >
          LIVE STATUS
        </div>

        <div
          style={{
            fontSize: 20,
            fontWeight: 600,
            whiteSpace: "pre-line",
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