import React, { useEffect, useRef, useState } from "react";
import * as faceapi from "face-api.js";

/**
 * GUIDE CONFIGURATION
 * Single source of truth for face guide dimensions.
 * Used by both UI rendering and face detection validation.
 */
const GUIDE_CONFIG = {
  widthPx: 240,      // Visual guide width in pixels
  heightPx: 300,     // Visual guide height in pixels
};

/**
 * Calculate the effective radius for face position validation.
 * Uses the smaller dimension of the guide to ensure face must be within visible boundaries.
 * @returns {number} Radius in pixels for circular validation area
 */
const calculateGuideRadius = () => {
  // Use smaller dimension as diameter for circular validation
  return Math.min(GUIDE_CONFIG.widthPx, GUIDE_CONFIG.heightPx) / 2;
};

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

  /**
   * Validate face position relative to the visual guide.
   * Returns an object with status and descriptor (if valid).
   * 
   * Returns:
   * - { status: 'no-face', descriptor: null }          // No face detected
   * - { status: 'outside-guide', descriptor: null }    // Face detected but outside guide area
   * - { status: 'valid', descriptor: Float32Array }    // Face inside guide, ready for matching
   * - null (on error)
   */
  const validateFacePosition = async () => {
    if (!videoRef.current) return null;

    try {
      // Detect a single face with landmarks and descriptor
      const detection = await faceapi
        .detectSingleFace(
          videoRef.current,
          new faceapi.TinyFaceDetectorOptions()
        )
        .withFaceLandmarks()
        .withFaceDescriptor();

      // No face found
      if (!detection) {
        return { status: 'no-face', descriptor: null };
      }

      // Get face bounding box and calculate center
      const box = detection.detection.box;
      const faceCenterX = box.x + box.width / 2;
      const faceCenterY = box.y + box.height / 2;

      // Get video dimensions and calculate guide center
      const videoWidth = videoRef.current.videoWidth;
      const videoHeight = videoRef.current.videoHeight;
      const guideCenterX = videoWidth / 2;
      const guideCenterY = videoHeight / 2;

      // Calculate distance from face center to guide center
      const guideRadius = calculateGuideRadius();
      const distanceFromCenter = Math.sqrt(
        Math.pow(faceCenterX - guideCenterX, 2) +
          Math.pow(faceCenterY - guideCenterY, 2)
      );

      // Check if face is outside guide
      if (distanceFromCenter > guideRadius) {
        return { status: 'outside-guide', descriptor: null };
      }

      // Face is inside guide and valid for matching
      return { status: 'valid', descriptor: detection.descriptor };
    } catch (error) {
      console.error('Error in validateFacePosition:', error);
      return null;
    }
  };

  /**
   * DEPRECATED: Use validateFacePosition() instead.
   * Kept for backward compatibility if needed elsewhere.
   */
  const getDescriptorFromVideo = async () => {
    const validation = await validateFacePosition();
    if (!validation) return null;
    if (validation.status === 'valid') {
      return validation.descriptor;
    }
    return null;
  };
  const registerFace = async () => {
    try {
      if (!name.trim()) {
        setMessage("❌ Enter Name First");
        return;
      }

      setMessage("Registering Face...");

      // Validate face position first
      const validation = await validateFacePosition();

      if (!validation) {
        setMessage("❌ Error detecting face. Try again.");
        return;
      }

      if (validation.status === 'no-face') {
        setMessage("❌ No Face Detected");
        return;
      }

      if (validation.status === 'outside-guide') {
        setMessage("❌ Place face inside guide to register");
        return;
      }

      const descriptor = validation.descriptor;

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

        // STEP 1: Check how many faces are visible in frame
        const detectedFaces = await getFaceDetections();

        if (detectedFaces.length === 0) {
          // No faces in frame
          setMultipleFaces(false);
          setMessage("⚠️ No Face Detected");
          return;
        }

        if (detectedFaces.length > 1) {
          // Multiple faces in frame - stop processing
          setMultipleFaces(true);
          setMessage("❌ Multiple Faces Detected\nOnly one face at a time");
          return;
        }

        // Single face detected
        setMultipleFaces(false);

        // STEP 2: Validate the detected face position relative to guide
        const validation = await validateFacePosition();

        if (!validation) {
          // Error in validation
          setMessage("⚠️ Unable to process face");
          return;
        }

        if (validation.status === 'outside-guide') {
          // Face detected but positioned outside the guide area
          setMessage("⚠️ Place face inside guide");
          return;
        }

        // STEP 3: Face is inside guide - proceed with matching
        const descriptor = validation.descriptor;

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

        // STEP 4: Check if match meets threshold
        if (bestDistance < 0.5) {
          // Match found - send to mobile if not already sent
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
        } else {
          // Face inside guide but no match
          setMessage(
            `🔴 UNKNOWN PERSON
Distance: ${bestDistance.toFixed(4)}`
          );
        }
      } catch (error) {
        console.error('Error in verification loop:', error);
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
      width: "100vw",
      height: "100vh",
      background: "#f1f5f9",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: 20,
      boxSizing: "border-box",
      overflow: "hidden",
      fontFamily:
        "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
    }}
  >
    {/* Header */}
    <div
      style={{
        marginBottom: 20,
        textAlign: "center",
      }}
    >
      <h1
        style={{
          margin: 0,
          fontSize: 40,
          fontWeight: 700,
          color: "#0f172a",
        }}
      >
        Face Attendance
      </h1>

      <p
        style={{
          marginTop: 8,
          fontSize: 16,
          color: "#64748b",
        }}
      >
        Look at the camera to mark attendance
      </p>
    </div>

    {/* Status Chips */}
    <div
      style={{
        display: "flex",
        gap: 12,
        marginBottom: 20,
      }}
    >
      <div
        style={{
          background: loading ? "#64748b" : "#16a34a",
          color: "#fff",
          padding: "10px 18px",
          borderRadius: 999,
          fontWeight: 600,
          fontSize: 14,
        }}
      >
        {loading ? "Loading Models" : "✓ Models Ready"}
      </div>

      <div
        style={{
          background: isVerifying
            ? "#2563eb"
            : "#64748b",
          color: "#fff",
          padding: "10px 18px",
          borderRadius: 999,
          fontWeight: 600,
          fontSize: 14,
        }}
      >
        {isVerifying
          ? "Verification Active"
          : "Starting Verification"}
      </div>
    </div>

    {/* Camera Card */}
    <div
      style={{
        width: "90%",
        maxWidth: 1100,
        height: "70vh",
        position: "relative",
        borderRadius: 30,
        overflow: "hidden",
        background: "#000",
        boxShadow:
          "0 20px 60px rgba(0,0,0,.15)",
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

      {/* Dark Overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(to bottom, rgba(0,0,0,.15), rgba(0,0,0,.05), rgba(0,0,0,.2))",
        }}
      />

      {/* Face Guide */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: GUIDE_CONFIG.widthPx,
          height: GUIDE_CONFIG.heightPx,
          transform: "translate(-50%, -50%)",
          border: "4px solid rgba(255,255,255,.9)",
          borderRadius: "50%",
          boxShadow:
            "0 0 30px rgba(255,255,255,.4)",
        }}
      />

      {/* Center Text */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          bottom: 30,
          transform: "translateX(-50%)",
          color: "#fff",
          fontSize: 20,
          fontWeight: 600,
          textShadow:
            "0 2px 10px rgba(0,0,0,.6)",
        }}
      >
        Position your face inside the guide
      </div>

      {/* Multiple Faces */}
      {multipleFaces && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "rgba(220,38,38,.9)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            color: "#fff",
            zIndex: 20,
          }}
        >
          <div
            style={{
              fontSize: 90,
            }}
          >
            ⚠️
          </div>

          <div
            style={{
              fontSize: 36,
              fontWeight: 700,
              marginTop: 10,
            }}
          >
            One Face At A Time
          </div>

          <div
            style={{
              marginTop: 10,
              fontSize: 18,
              opacity: 0.95,
            }}
          >
            Please ensure only one employee is visible
          </div>
        </div>
      )}
    </div>

    {/* Result Card */}
    <div
      style={{
        marginTop: 20,
        minWidth: 450,
        maxWidth: 800,
        background: "#fff",
        borderRadius: 24,
        padding: "22px 30px",
        textAlign: "center",
        boxShadow:
          "0 10px 40px rgba(0,0,0,.08)",
      }}
    >
      <div
        style={{
          fontSize: 60,
          marginBottom: 10,
        }}
      >
        {message.includes("MATCH") ||
        message.includes("✅")
          ? "✅"
          : message.includes("UNKNOWN") ||
            message.includes("❌")
          ? "❌"
          : "👤"}
      </div>

      <div
        style={{
          fontSize: 22,
          fontWeight: 700,
          color: "#0f172a",
          whiteSpace: "pre-line",
          lineHeight: 1.5,
        }}
      >
        {message || "Waiting for face..."}
      </div>
    </div>
  </div>
);
}

export default Textchanger;