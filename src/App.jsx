import React, { useEffect, useRef, useState } from "react";
import * as faceapi from "face-api.js";

function App() {
  const videoRef = useRef(null);
  const verificationInterval = useRef(null);

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [name, setName] = useState("");

  useEffect(() => {
    initialize();

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

      const registeredFaces =
        JSON.parse(localStorage.getItem("registeredFaces")) || [];

      registeredFaces.push({
        name: name.trim(),
        descriptor: Array.from(descriptor),
      });

      localStorage.setItem(
        "registeredFaces",
        JSON.stringify(registeredFaces)
      );

      setMessage(`✅ ${name} Registered Successfully`);
      setName("");
    } catch (error) {
      console.log(error);
      setMessage("❌ Registration Failed");
    }
  };

  const startVerification = async () => {
    const registeredFaces =
      JSON.parse(localStorage.getItem("registeredFaces")) || [];

    if (registeredFaces.length === 0) {
      setMessage("❌ Register Face First");
      return;
    }

    if (verificationInterval.current) {
      clearInterval(verificationInterval.current);
    }

    setIsVerifying(true);
    setMessage("🔍 Verification Started");

    verificationInterval.current = setInterval(async () => {
      try {
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

        if (bestDistance < 0.5) {
          setMessage(
            `🟢 MATCH

Name: ${bestMatch}

Distance: ${bestDistance.toFixed(4)}`
          );
        } else {
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
      textAlign: "center",
      padding: "20px",
      fontFamily: "Arial",
      width: "100%",
      boxSizing: "border-box",
    }}
  >
    <h1
      style={{
        fontSize: "clamp(24px, 4vw, 40px)",
        marginBottom: 20,
      }}
    >
      Live Face Recognition
    </h1>

    {loading && <h3>Loading Models...</h3>}

    <video
      ref={videoRef}
      autoPlay
      muted
      playsInline
      style={{
        width: "90%",
        maxWidth: "900px",
        height: "auto",
        border: "2px solid black",
        borderRadius: 10,
      }}
    />

    <br />
    <br />

    <input
      type="text"
      placeholder="Enter Name"
      value={name}
      onChange={(e) => setName(e.target.value)}
      style={{
        padding: "12px",
        width: "90%",
        maxWidth: "400px",
        fontSize: "18px",
        marginBottom: "15px",
        borderRadius: "8px",
        boxSizing: "border-box",
      }}
    />

    <br />

    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        gap: "10px",
      }}
    >
      <button
        onClick={registerFace}
        style={{
          padding: "14px 24px",
          minWidth: "180px",
          fontSize: "16px",
          cursor: "pointer",
        }}
      >
        Register Face
      </button>

      {!isVerifying ? (
        <button
          onClick={startVerification}
          style={{
            padding: "14px 24px",
            minWidth: "180px",
            fontSize: "16px",
            cursor: "pointer",
          }}
        >
          Start Verification
        </button>
      ) : (
        <button
          onClick={stopVerification}
          style={{
            padding: "14px 24px",
            minWidth: "180px",
            fontSize: "16px",
            cursor: "pointer",
          }}
        >
          Stop Verification
        </button>
      )}

      <button
        onClick={clearRegisteredFaces}
        style={{
          padding: "14px 24px",
          minWidth: "180px",
          fontSize: "16px",
          cursor: "pointer",
        }}
      >
        Clear Faces
      </button>
    </div>

    <div
      style={{
        marginTop: 20,
        whiteSpace: "pre-line",
        fontSize: "clamp(18px, 2vw, 24px)",
        fontWeight: "bold",
        padding: "0 10px",
      }}
    >
      {message}
    </div>
  </div>
);
 

}

export default App;