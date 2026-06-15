import React, { useEffect, useRef, useState, useMemo } from "react";
import * as faceapi from "face-api.js";

function Textchanger() {
  const videoRef = useRef(null);
  const verificationInterval = useRef(null);
  const registeredFacesRef = useRef([]); 
const blockedFacesRef = useRef({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [employee, setEmployee] = useState(null);
  const [attendanceStatus, setAttendanceStatus] = useState(null);
  const [attendanceRecord, setAttendanceRecord] = useState(null);
  const [attendanceResult, setAttendanceResult] = useState(null);
  const [multipleFaces, setMultipleFaces] = useState(false);
  const [attendanceDetails, setAttendanceDetails] = useState(null);
  const [faceCount, setFaceCount] = useState(0);  
  const [currentTime, setCurrentTime] = useState(new Date());
  const lastMatchedRef = useRef(null);

  // ✅ systemStatus uses faceCount state, no localStorage on every render
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
      setEmployee(payload.employee || payload);
      setAttendanceDetails(payload.employee);
      setAttendanceStatus(payload.attendanceStatus || null);
      setAttendanceRecord(payload.attendanceRecord || null);
      setAttendanceResult(null);

      if (payload.attendanceStatus === "COMPLETED") setMessage("Attendance Already Marked Today");
      else if (payload.attendanceStatus === "PUNCH_IN") setMessage("Employee matched — ready to Punch In");
      else if (payload.attendanceStatus === "PUNCH_OUT") setMessage("Employee matched — ready to Punch Out");
      else setMessage("Employee matched. Please select Punch In or Punch Out.");
    };

    const handleAttendanceResult = (event) => {
      const resultData = parseEventDetail(event.detail);
      if (!resultData) return;
      setAttendanceResult(resultData);
      setMessage(resultData.message || "Attendance update received.");
      // if (resultData.success) {
      //   setTimeout(() => {
      //     setEmployee(null);
      //     setAttendanceStatus(null);
      //     setAttendanceRecord(null);
      //   }, 1400);
      // }
       if (resultData.success) {

     blockedFacesRef.current[lastMatchedRef.current] = Date.now();

        setTimeout(() => {
      // setEmployee(null);
      // setAttendanceStatus(null);
      // setAttendanceRecord(null);
      // setAttendanceResult(null);

      // lastMatchedRef.current = null;
      // startVerification();   // ADD THIS
        resetSession();
    }, 1500);
  }
    };

    window.addEventListener("employeeMatched", handleEmployeeMatched);
    window.addEventListener("attendanceResult", handleAttendanceResult);
    return () => {
      window.removeEventListener("employeeMatched", handleEmployeeMatched);
      window.removeEventListener("attendanceResult", handleAttendanceResult);
    };
  }, []);

  // Auto-clear after successful attendance
  useEffect(() => {
    if (attendanceResult?.success) {
      const timeout = setTimeout(() => {
        setEmployee(null);
        setAttendanceStatus(null);
        setAttendanceRecord(null);
        setAttendanceResult(null);
        setMessage("");
      }, 2500);
      return () => clearTimeout(timeout);
    }
  }, [attendanceResult]);
useEffect(() => {
  window.resetSession = resetSession;

  return () => {
    delete window.resetSession;
  };
}, []);
  // Init
  useEffect(() => {
    // ✅ receiveFaceData: store directly in ref, no localStorage
    window.receiveFaceData = (faces) => {
      try {
        console.log("DATA RECEIVED FROM REACT NATIVE — TOTAL:", faces.length);
        const converted = faces.map((item) => ({
          name: item.employeeid,
          descriptor: new Float32Array( // ✅ Pre-converted once here
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

      const stream = await navigator.mediaDevices.getUserMedia({  video: {
    width: { ideal: 640 },
    height: { ideal: 480 },
    facingMode: "user",
  }, });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // ✅ Wait for video to actually have frames before starting
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

        // ✅ Single neural net pass — detection + descriptor together
        // const result = await faceapi
        //   // .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions())
        //    .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions({ inputSize: 160, scoreThreshold: 0.5 }))
        //   .withFaceLandmarks()
        //   .withFaceDescriptor();
const result = await faceapi
  .detectSingleFace(
    videoRef.current,
    new faceapi.TinyFaceDetectorOptions({
      inputSize: 160,
      // inputSize: 64,
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

        // ✅ Oval check using the same result — no second pass
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

        // ✅ Descriptors already Float32Array — no conversion here
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

  if (
    blockedAt &&
    Date.now() - blockedAt < 5 * 60 * 1000
  ) {
    setMessage(` Recently processed`);
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
// const resetSession = () => {
//   setEmployee(null);
//   alert("resetting")
//   setAttendanceStatus(null);
//   setAttendanceRecord(null);
//   setAttendanceResult(null);
//   setAttendanceDetails(null);

//   setMultipleFaces(false);

//   lastMatchedRef.current = null;

//   setMessage("Verification Started");

//   if (verificationInterval.current) {
//     clearInterval(verificationInterval.current);
//   }
// setIsVerifying(true);
//   startVerification();
// };
const resetSession = async () => {
  setEmployee(null);
  setAttendanceStatus(null);
  setAttendanceRecord(null);
  setAttendanceResult(null);
  setAttendanceDetails(null);

  setMultipleFaces(false);

  lastMatchedRef.current = null;

  setMessage("Restarting Camera...");

  if (verificationInterval.current) {
    clearInterval(verificationInterval.current);
  }

  // Stop existing camera
  if (videoRef.current?.srcObject) {
    videoRef.current.srcObject
      .getTracks()
      .forEach(track => track.stop());

    videoRef.current.srcObject = null;
  }

  // Start camera again
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
}; 
// useEffect(() => {
//   const watchdog = setInterval(async () => {
//     try {
//       const video = videoRef.current;

//       if (!video) return;

//       const track = video.srcObject?.getVideoTracks?.()[0];

//       const cameraDead =
//         !track ||
//         track.readyState !== "live" ||
//         video.paused ||
//         video.ended;

//       if (cameraDead) {
//         console.log("Camera offline. Restarting...");

//         if (verificationInterval.current) {
//           clearInterval(verificationInterval.current);
//         }

//         const stream = await navigator.mediaDevices.getUserMedia({
//           video: {
//             width: { ideal: 640 },
//             height: { ideal: 480 },
//             facingMode: "user",
//           },
//         });

//         video.srcObject = stream;

//         video.onloadeddata = () => {
//           console.log("Camera restarted");
//           startVerification();
//         };
//       }
//     } catch (err) {
//       console.log("Camera watchdog error:", err);
//     }
//   }, 5000); // check every 5 sec

//   return () => clearInterval(watchdog);
// }, []);

const restartingCameraRef = useRef(false);

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

      if (cameraDead && !restartingCameraRef.current) {
        restartingCameraRef.current = true;

        console.log("Camera offline. Restarting...");

        if (verificationInterval.current) {
          clearInterval(verificationInterval.current);
          verificationInterval.current = null;
        }

        try {
          // cleanup old stream
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
const stopVerification = () => {
    if (verificationInterval.current) {
      clearInterval(verificationInterval.current);
      verificationInterval.current = null;
    }
    setIsVerifying(false);
    setMessage("Verification Stopped");
  };

  const sendPunchAction = (action) => {
    if (!employee) { setMessage("No employee selected."); return; }
    if (!window.ReactNativeWebView) { setMessage("Unable to send action to native host."); return; }

    const employeeCode =
      employee?.employeeCode || employee?.code ||
      employee?.employeeId || employee?.id || employee?.empCode || null;

    window.ReactNativeWebView.postMessage(
      JSON.stringify({ type: action, employeeId: employeeCode })
    );
    setMessage(`Sending ${action.replace("_", " ")} request...`);
  };

  const closeEmployeeModal = () => {
    alert("ok")
    // setEmployee(null);
    // setAttendanceStatus(null);
    // setAttendanceRecord(null);
    // setAttendanceResult(null);
    // setMessage("");
    // lastMatchedRef.current = null;
    // // ✅ Restart verification after closing modal
    // startVerification();
  };

  const employeePhoto =
    employee?.photo || employee?.photoUrl || employee?.avatar ||
    employee?.profileImage || employee?.image;

  const attendanceMessage =
    attendanceResult?.message ||
    (attendanceResult ? "Attendance action completed." : "");

  return (
    <div style={{ display: "flex", justifyContent: "center" }}>
      {/* EMPLOYEE MODAL */}
      {employee && (
        <div
          style={{
            position: "absolute", inset: 0, zIndex: 80,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(0,0,0,0.55)", padding: 24,
          }}
        >
          <div
            style={{
              width: "100%", maxWidth: 560, borderRadius: 28,
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.14)",
              backdropFilter: "blur(28px)",
              boxShadow: "0 40px 120px rgba(0,0,0,0.35)",
              padding: 28, color: "#fff", position: "relative",
            }}
          >
            <button
              onClick={()=>{closeEmployeeModal()}}
              aria-label="Close"
              style={{
                position: "absolute", top: 12, right: 12,
                width: 36, height: 36, borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.04)", color: "#fff",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 22 }}>
              <div
                style={{
                  width: 88, height: 88, borderRadius: 22, overflow: "hidden",
                  background: "rgba(255,255,255,0.1)", display: "grid",
                  placeItems: "center", border: "1px solid rgba(255,255,255,0.18)",
                }}
              >
                {employeePhoto ? (
                  <img src={employeePhoto} alt="Employee" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 24, fontWeight: 700 }}>
                    {attendanceDetails?.firstname?.[0] || "E"}
                  </div>
                )}
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em" }}>
                  {attendanceDetails?.firstname + " " + attendanceDetails?.lastname || "Employee"}
                </div>
                <div style={{ color: "rgba(255,255,255,0.65)", marginTop: 6, fontSize: 13 }}>
                  {attendanceDetails?.username || "Code unavailable"}
                </div>
              </div>
            </div>

            {attendanceMessage && (
              <div
                style={{
                  padding: "14px 18px", borderRadius: 18,
                  background: attendanceResult?.success ? "rgba(34,197,94,0.16)" : "rgba(248,113,113,0.16)",
                  border: `1px solid ${attendanceResult?.success ? "rgba(34,197,94,0.25)" : "rgba(248,113,113,0.25)"}`,
                  color: attendanceResult?.success ? "#d1fae5" : "#fecaca",
                  marginBottom: 20, fontSize: 14, lineHeight: 1.5,
                }}
              >
                {attendanceMessage}
              </div>
            )}

            <div style={{ display: "grid", gap: 14 }}>
              {attendanceStatus === "PUNCH_IN" && (
                <button onClick={() => sendPunchAction("PUNCH_IN")}
                  style={{ width: "100%", padding: "18px 20px", borderRadius: 16, border: "none", background: "linear-gradient(135deg, #22c55e, #4ade80)", color: "#071c0a", fontSize: 16, fontWeight: 700, cursor: "pointer" }}>
                  Punch In
                </button>
              )}
              {attendanceStatus === "PUNCH_OUT" && (
                <button onClick={() => sendPunchAction("PUNCH_OUT")}
                  style={{ width: "100%", padding: "18px 20px", borderRadius: 16, border: "1px solid rgba(255,255,255,0.18)", background: "rgba(255,255,255,0.08)", color: "#fff", fontSize: 16, fontWeight: 700, cursor: "pointer" }}>
                  Punch Out
                </button>
              )}
              {attendanceStatus === "COMPLETED" && (
                <div style={{ padding: "14px 18px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", color: "#fff", textAlign: "center", fontWeight: 600 }}>
                  Attendance Already Marked Today
                </div>
              )}
              {!attendanceStatus && (
                <>
                  <button onClick={() => sendPunchAction("PUNCH_IN")}
                    style={{ width: "100%", padding: "18px 20px", borderRadius: 16, border: "none", background: "linear-gradient(135deg, #22c55e, #4ade80)", color: "#071c0a", fontSize: 16, fontWeight: 700, cursor: "pointer" }}>
                    Punch In
                  </button>
                  <button onClick={() => sendPunchAction("PUNCH_OUT")}
                    style={{ width: "100%", padding: "18px 20px", borderRadius: 16, border: "1px solid rgba(255,255,255,0.18)", background: "rgba(255,255,255,0.08)", color: "#fff", fontSize: 16, fontWeight: 700, cursor: "pointer" }}>
                    Punch Out
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

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

        {/* <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: loading ? "rgba(100,116,139,0.3)" : "rgba(22, 163, 74, 0.7)", border: `1px solid ${loading ? "rgba(100,116,139,0.4)" : "rgba(34,197,94,0.4)"}`, color: loading ? "#94a3b8" : "#4ade80", padding: "5px 12px", borderRadius: 999, fontSize: 12, fontWeight: 500, backdropFilter: "blur(10px)" }}>
            {loading ? "Loading" : "Models Ready"}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: isVerifying ? "rgba(37,99,235,0.25)" : "rgba(100,116,139,0.2)", border: `1px solid ${isVerifying ? "rgba(96,165,250,0.4)" : "rgba(100,116,139,0.3)"}`, color: isVerifying ? "#93c5fd" : "#64748b", padding: "5px 10px", borderRadius: 999, fontSize: 12, fontWeight: 500, backdropFilter: "blur(10px)" }}>
            {isVerifying ? "Verifying" : "Standby"}
          </div>
        </div> */}

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

      {/* LEFT PANEL */}
      {/* <div style={{ position: "absolute", top: "50%", left: 40, transform: "translateY(-50%)", width: 220, display: "flex", flexDirection: "column", gap: 16, zIndex: 10 }}> */}
        {/* <div style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, padding: "18px 20px", backdropFilter: "blur(16px)" }}>
          <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Today's Date</div>
          <div style={{ color: "#fff", fontSize: 36, fontWeight: 700, lineHeight: 1 }}>{currentTime.getDate()}</div>
          <div style={{ color: "#60a5fa", fontSize: 13, fontWeight: 600, marginTop: 8 }}>
            {currentTime.toLocaleDateString([], { month: "long", year: "numeric" })}
          </div>
          <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 12, marginTop: 4 }}>
            {currentTime.toLocaleDateString([], { weekday: "long" })}
          </div>
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.35)", fontSize: 11 }}>
            Attendance tracking active today
          </div>
        </div> */}

        {/* <div style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 20, padding: "24px", backdropFilter: "blur(20px)", display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.12em" }}>Local Time</div>
          <div style={{ color: "#fff", fontSize: 29, fontWeight: 700, lineHeight: 1 }}>
            {currentTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </div>
          <div style={{ width: 40, height: 2, borderRadius: 99, background: "linear-gradient(90deg, #3b82f6, #60a5fa)", margin: "4px 0" }} />
          <div style={{ color: "#93c5fd", fontSize: 15, fontWeight: 600 }}>{greeting}</div>
          <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 12 }}>Reception • Device #01</div>
        </div> */}

        {/* <div style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, padding: "16px 20px", backdropFilter: "blur(16px)", display: "flex", alignItems: "center", gap: 10 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>
            <circle cx="12" cy="10" r="3"/>
          </svg>
          <div>
            <div style={{ color: "#fff", fontSize: 13, fontWeight: 500 }}>Reception</div>
            <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 11 }}>Device #01</div>
          </div>
        </div> */}
      {/* </div> */}

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

      {/* RIGHT PANEL */}
      {/* <div style={{ position: "absolute", top: "50%", right: 40, transform: "translateY(-50%)", width: 230, display: "flex", flexDirection: "column", gap: 16, zIndex: 10 }}>
        <div style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, padding: "16px 20px", backdropFilter: "blur(16px)" }}>
          <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
            System Status
          </div>
          {systemStatus.map((item, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: i < systemStatus.length - 1 ? 12 : 0 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: item.online ? "#4ade80" : "#ef4444", boxShadow: item.online ? "0 0 10px rgba(74,222,128,.7)" : "0 0 10px rgba(239,68,68,.7)", flexShrink: 0 }} />
              <div style={{ color: "#fff", fontSize: 12, fontWeight: 500 }}>{item.label}</div>
            </div>
          ))}
        </div>
      </div> */}

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