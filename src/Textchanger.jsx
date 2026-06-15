import React, { useEffect, useRef, useState, useMemo } from "react";
import * as faceapi from "face-api.js";
import Swal from "sweetalert2";

function Textchanger() {
  const videoRef = useRef(null);
  const verificationInterval = useRef(null);
  const registeredFacesRef = useRef([]);
  const blockedFacesRef = useRef({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [multipleFaces, setMultipleFaces] = useState(false);
  const [faceCount, setFaceCount] = useState(0);
  const [currentTime, setCurrentTime] = useState(new Date());
  const lastMatchedRef = useRef(null);
  const currentEmployeeRef = useRef(null);

  // systemStatus uses faceCount state, no localStorage on every render
  const systemStatus = useMemo(() => [
    {
      label: loading ? "Loading Face Models" : "Face Models Ready",
      online: !loading,
    },
    {
      label: isVerifying ? "Face Online" : "Face Standby",
      online: isVerifying,
    },
    {
      label: faceCount > 0 ? `Face Database Loaded (${faceCount})` : "No Faces Loaded",
      online: faceCount > 0,
    },
    {
      label: navigator.onLine ? "Network Connected" : "Network Disconnected",
      online: navigator.onLine,
    },
  ], [loading, isVerifying, faceCount]);

  // Clock
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const hour = currentTime.getHours();
  let greeting = "Good Morning";
  if (hour >= 12 && hour < 17) greeting = "Good Afternoon";
  else if (hour >= 17 && hour < 21) greeting = "Good Evening";
  else if (hour >= 21 || hour < 5) greeting = "Good Night";

  // Employee matched / attendance result events
  useEffect(() => {
    const parseEventDetail = (payload) => {
      if (!payload) return null;
      if (typeof payload === "string") {
        try { return JSON.parse(payload); } catch { return payload; }
      }
      return payload;
    };

    const handleEmployeeMatched = (event) => {
      const payload = parseEventDetail(event.detail);
      if (!payload) return;
      
      const emp = payload.employee || payload;
      currentEmployeeRef.current = emp;
      
      // Stop verification while showing Swal
      if (verificationInterval.current) {
        clearInterval(verificationInterval.current);
        verificationInterval.current = null;
      }
      
      let title = `${emp.firstname || ""} ${emp.lastname || ""}`.trim() || "Employee Found";
      let statusMessage = "";
      let confirmText = "";
      
      if (payload.attendanceStatus === "COMPLETED") {
        statusMessage = "Attendance Already Marked Today";
        confirmText = "OK";
      } else if (payload.attendanceStatus === "PUNCH_IN") {
        statusMessage = "Ready for Punch In";
        confirmText = "Punch In";
      } else if (payload.attendanceStatus === "PUNCH_OUT") {
        statusMessage = "Ready for Punch Out";
        confirmText = "Punch Out";
      } else {
        statusMessage = "Please select action";
        confirmText = "Continue";
      }
      
      Swal.fire({
        title: title,
        text: statusMessage,
        imageUrl: emp.photo || emp.photoUrl || emp.avatar || emp.profileImage || emp.image,
        imageWidth: 120,
        imageHeight: 120,
        imageAlt: `${emp.firstname} ${emp.lastname}`,
        showCancelButton: payload.attendanceStatus !== "COMPLETED",
        confirmButtonText: confirmText,
        cancelButtonText: "Close",
        backdrop: true,
        allowOutsideClick: false,
        allowEscapeKey: false,
      }).then((result) => {
        if (result.isConfirmed && payload.attendanceStatus !== "COMPLETED") {
          // Send punch action
          const employeeCode = emp?.employeeCode || emp?.code ||
            emp?.employeeId || emp?.id || emp?.empCode || null;
          
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(
              JSON.stringify({ 
                type: payload.attendanceStatus === "PUNCH_OUT" ? "PUNCH_OUT" : "PUNCH_IN", 
                employeeId: employeeCode 
              })
            );
            setMessage(`Sending ${payload.attendanceStatus === "PUNCH_OUT" ? "Punch Out" : "Punch In"} request...`);
          } else {
            setMessage("Unable to send action to native host.");
            resetSession();
          }
        } else {
          resetSession();
        }
      });
    };

    const handleAttendanceResult = (event) => {
      const resultData = parseEventDetail(event.detail);
      if (!resultData) return;
      
      setMessage(resultData.message || "Attendance update received.");
      
      if (resultData.success) {
        blockedFacesRef.current[currentEmployeeRef.current?.employeeCode || currentEmployeeRef.current?.id] = Date.now();
        
        Swal.fire({
          icon: "success",
          title: "Attendance Marked",
          text: resultData.message || "Success!",
          timer: 1500,
          showConfirmButton: false,
          backdrop: true,
        }).then(() => {
          resetSession();
        });
      } else {
        Swal.fire({
          icon: "error",
          title: "Failed",
          text: resultData.message || "Attendance marking failed",
          confirmButtonText: "OK",
          backdrop: true,
        }).then(() => {
          resetSession();
        });
      }
    };

    window.addEventListener("employeeMatched", handleEmployeeMatched);
    window.addEventListener("attendanceResult", handleAttendanceResult);
    
    return () => {
      window.removeEventListener("employeeMatched", handleEmployeeMatched);
      window.removeEventListener("attendanceResult", handleAttendanceResult);
    };
  }, []);

  // Init
  useEffect(() => {
    window.receiveFaceData = (faces) => {
      try {
        console.log("DATA RECEIVED FROM REACT NATIVE — TOTAL:", faces.length);
        const converted = faces.map((item) => ({
          name: item.employeeid,
          descriptor: new Float32Array(
            String(item.faceembedding).split(",").map(Number)
          ),
        }));
        registeredFacesRef.current = converted;
        setFaceCount(converted.length);
        setMessage(`Received ${converted.length} faces`);
      } catch (error) {
        console.error("receiveFaceData error:", error);
      }
    };

    if (window.allFacesFromRN) {
      window.receiveFaceData(window.allFacesFromRN);
    }

    initialize();

    return () => {
      if (verificationInterval.current) clearInterval(verificationInterval.current);
    };
  }, []);

  const initialize = async () => {
    try {
      const MODEL_URL = "/models";
      console.time("MODEL_LOAD");
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      ]);
      console.timeEnd("MODEL_LOAD");

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user",
        },
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadeddata = () => {
          setLoading(false);
          setMessage("Models Loaded");
          startVerification();
        };
      }
    } catch (error) {
      console.error(error);
      setMessage("Failed to load models or camera");
    }
  };

  const startVerification = () => {
    if (verificationInterval.current) clearInterval(verificationInterval.current);
    setIsVerifying(true);
    setMessage("Verification Started");

    verificationInterval.current = setInterval(async () => {
      try {
        if (registeredFacesRef.current.length === 0) {
          setMessage("No Faces Loaded");
          return;
        }

        if (!videoRef.current) return;

        const result = await faceapi
          .detectSingleFace(
            videoRef.current,
            new faceapi.TinyFaceDetectorOptions({
              inputSize: 160,
              scoreThreshold: 0.5,
            })
          )
          .withFaceLandmarks()
          .withFaceDescriptor();

        if (!result) {
          setMultipleFaces(false);
          setMessage("No Face Detected");
          return;
        }

        // Oval check using the same result — no second pass
        const { x, y, width, height } = result.detection.box;
        const vw = videoRef.current.videoWidth;
        const vh = videoRef.current.videoHeight;
        const dx = (x + width / 2) - vw / 2;
        const dy = (y + height / 2) - vh / 2;
        const insideOval = (dx * dx) / (135 * 135) + (dy * dy) / (165 * 165) <= 1;

        if (!insideOval) {
          setMultipleFaces(false);
          setMessage("Place face inside guide");
          return;
        }

        setMultipleFaces(false);

        let bestMatch = null;
        let bestDistance = 999;

        for (const person of registeredFacesRef.current) {
          const dist = faceapi.euclideanDistance(result.descriptor, person.descriptor);
          if (dist < bestDistance) {
            bestDistance = dist;
            bestMatch = person.name;
          }
        }

        if (bestDistance < 0.45) {
          const blockedAt = blockedFacesRef.current[bestMatch];
          
          if (blockedAt && Date.now() - blockedAt < 5 * 60 * 1000) {
            setMessage(`Recently processed`);
            return;
          }

          if (lastMatchedRef.current !== bestMatch) {
            lastMatchedRef.current = bestMatch;
            clearInterval(verificationInterval.current);
            window.ReactNativeWebView?.postMessage(
              JSON.stringify({ type: "FACE_MATCHED", employeeid: bestMatch })
            );
          }
        } else {
          setMessage(`🔴 Unknown\nDistance: ${bestDistance.toFixed(4)}`);
        }
      } catch (error) {
        console.error(error);
      }
    }, 1000);
  };

  const resetSession = async () => {
    currentEmployeeRef.current = null;
    lastMatchedRef.current = null;
    setMessage("Restarting Camera...");
    
    if (verificationInterval.current) {
      clearInterval(verificationInterval.current);
      verificationInterval.current = null;
    }
    
    // Stop existing camera
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject
        .getTracks()
        .forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    
    // Start camera again
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user",
        },
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadeddata = () => {
          setIsVerifying(true);
          startVerification();
        };
      }
    } catch (err) {
      console.error("Camera restart failed:", err);
      setMessage("Camera restart failed");
    }
  };

  const restartingCameraRef = useRef(false);

  // Camera watchdog
  useEffect(() => {
    const watchdog = setInterval(async () => {
      try {
        const video = videoRef.current;
        
        if (!video) return;
        
        const track = video.srcObject?.getVideoTracks?.()[0];
        
        console.log(
          "Camera Check:",
          track?.readyState,
          "paused:",
          video.paused,
          "ended:",
          video.ended
        );
        
        const cameraDead =
          !track ||
          track.readyState !== "live" ||
          video.paused ||
          video.ended;
        
        if (cameraDead && !restartingCameraRef.current && !currentEmployeeRef.current) {
          restartingCameraRef.current = true;
          console.log("Camera offline. Restarting...");
          
          if (verificationInterval.current) {
            clearInterval(verificationInterval.current);
            verificationInterval.current = null;
          }
          
          try {
            if (video.srcObject) {
              video.srcObject
                .getTracks()
                .forEach((t) => t.stop());
              video.srcObject = null;
            }
            
            const stream = await navigator.mediaDevices.getUserMedia({
              video: {
                width: { ideal: 640 },
                height: { ideal: 480 },
                facingMode: "user",
              },
            });
            
            video.srcObject = stream;
            
            video.onloadeddata = () => {
              console.log("Camera restarted");
              setIsVerifying(true);
              startVerification();
              restartingCameraRef.current = false;
            };
          } catch (err) {
            console.log("Camera restart failed:", err);
            restartingCameraRef.current = false;
          }
        }
      } catch (err) {
        console.log("Camera watchdog error:", err);
        restartingCameraRef.current = false;
      }
    }, 5000);
    
    return () => clearInterval(watchdog);
  }, []);

  return (
    <div style={{ display: "flex", justifyContent: "center" }}>
      {/* CAMERA */}
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }}
      />

      {/* VIGNETTE */}
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at center, transparent 220px, rgba(0,0,0,0.23) 400px, rgba(40,38,38,0.7) 90%)", zIndex: 1 }} />

      {/* TOP BAR */}
      <div
        style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 64,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 32px", background: "rgba(0,0,0,0.35)",
          backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,255,255,0.08)", zIndex: 20,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, background: "rgba(255,255,255,0.12)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(255,255,255,0.18)" }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="14.31" y1="8" x2="20.05" y2="17.94"/>
              <line x1="9.69" y1="8" x2="21.17" y2="8"/>
              <line x1="7.38" y1="12" x2="13.12" y2="2.06"/>
              <line x1="9.69" y1="16" x2="3.95" y2="6.06"/>
              <line x1="14.31" y1="16" x2="2.83" y2="16"/>
              <line x1="16.62" y1="12" x2="10.88" y2="21.94"/>
            </svg>
          </div>
          <span style={{ color: "#fff", fontWeight: 600, fontSize: 15, letterSpacing: "-0.01em" }}>FaceID Attendance</span>
        </div>

        <div
          style={{
            color: "rgba(255,255,255,0.45)",
            fontSize: 13,
            fontWeight: 500,
            letterSpacing: "0.02em",
          }}
        >
          {currentTime.toLocaleDateString("en-IN", {
            weekday: "short",
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
          {" • "}
          {currentTime.toLocaleTimeString("en-IN", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })}
        </div>
      </div>

      {/* FACE GUIDE */}
      <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", zIndex: 5 }}>
        <div style={{ width: 270, height: 330, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.55)", position: "relative" }}>
          {[
            { top: -3, left: -3, borderTop: "3px solid #fff", borderLeft: "3px solid #fff", borderRadius: "6px 0 0 0" },
            { top: -3, right: -3, borderTop: "3px solid #fff", borderRight: "3px solid #fff", borderRadius: "0 6px 0 0" },
            { bottom: -3, left: -3, borderBottom: "3px solid #fff", borderLeft: "3px solid #fff", borderRadius: "0 0 0 6px" },
            { bottom: -3, right: -3, borderBottom: "3px solid #fff", borderRight: "3px solid #fff", borderRadius: "0 0 6px 0" },
          ].map((s, i) => (
            <div key={i} style={{ position: "absolute", width: 22, height: 22, ...s }} />
          ))}
        </div>
        <div style={{ textAlign: "center", marginTop: 20, color: "rgba(255,255,255,0.6)", fontSize: 13, fontWeight: 500, letterSpacing: "0.02em", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
          Position face within guide
        </div>
      </div>

      {/* RESULT BAR */}
      <div
        style={{
          position: "absolute", bottom: 32, left: "50%", transform: "translateX(-50%)",
          minWidth: 360, maxWidth: 560, background: "rgba(0,0,0,0.45)",
          backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 20, padding: "18px 28px", display: "flex",
          alignItems: "center", gap: 16, zIndex: 10,
        }}
      >
        <div style={{ whiteSpace: "pre-line" }}>
          <div style={{ color: message.includes("UNKNOWN") ? "#f87171" : "rgba(255,255,255,0.85)", fontSize: 15, fontWeight: 600, lineHeight: 1.5 }}>
            {message || "Waiting for face…"}
          </div>
        </div>
      </div>

      {/* MULTIPLE FACES WARNING */}
      {multipleFaces && (
        <div
          style={{
            position: "absolute", inset: 0, background: "rgba(153,27,27,0.92)",
            backdropFilter: "blur(8px)", display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: 12, zIndex: 50,
          }}
        >
          <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <div style={{ color: "#fff", fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em" }}>One face at a time</div>
          <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 15 }}>Please ensure only one employee is visible</div>
        </div>
      )}
    </div>
  );
}

export default Textchanger;