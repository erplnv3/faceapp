import React, { useEffect, useRef, useState } from "react";
import * as faceapi from "face-api.js";
 function Textchanger() {
  const videoRef = useRef(null);
  const verificationInterval = useRef(null);

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [name, setName] = useState("");
  const [employee, setEmployee] = useState(null);
  const [attendanceStatus, setAttendanceStatus] = useState(null);
  const [attendanceRecord, setAttendanceRecord] = useState(null);
  const [attendanceResult, setAttendanceResult] = useState(null);
  const [multipleFaces, setMultipleFaces] = useState(false);
  const lastMatchedRef = useRef(null);
  const [attendanceDetails, setAttendanceDetails] = useState(null);
const [currentTime, setCurrentTime] = useState(new Date());
const systemStatus = [
  {
    label: loading ? "Loading Face Models" : "Face Models Ready",
    online: !loading,
  },
  {
    label: isVerifying
      ? "Face  Online"
      : "Face  Standby",
    online: isVerifying,
  },
  {
    label:
      JSON.parse(localStorage.getItem("registeredFaces") || "[]").length > 0
        ? "Face Database Loaded"
        : "No Faces Loaded",
    online:
      JSON.parse(localStorage.getItem("registeredFaces") || "[]").length > 0,
  },
  {
    label: navigator.onLine
      ? "Network Connected"
      : "Network Disconnected",
    online: navigator.onLine,
  },
];
useEffect(() => {
  const interval = setInterval(() => {
    setCurrentTime(new Date());
  }, 1000);

  return () => clearInterval(interval);
}, []);

const hour = currentTime.getHours();

let greeting = "Good Morning";
if (hour >= 12 && hour < 17) greeting = "Good Afternoon";
else if (hour >= 17 && hour < 21) greeting = "Good Evening";
else if (hour >= 21 || hour < 5) greeting = "Good Night";

useEffect(() => {
  const parseEventDetail = (payload) => {
    if (!payload) return null;
    if (typeof payload === "string") {
      try {
        return JSON.parse(payload);
      } catch {
        return payload;
      }
    }
    return payload;
  };

  const handleEmployeeMatched = (event) => {
    const payload = parseEventDetail(event.detail);
    if (!payload) return;

    // payload expected shape: { employee: {...}, attendanceStatus: 'PUNCH_IN'|'PUNCH_OUT'|'COMPLETED', attendanceRecord: {...} }
    const emp = payload.employee || payload;
    setEmployee(emp);
    setAttendanceDetails(payload.employeeDetails)
    setAttendanceStatus(payload.attendanceStatus || null);
    setAttendanceRecord(payload.attendanceRecord || null);
    setAttendanceResult(null);

    if (payload.attendanceStatus === "COMPLETED") {
      setMessage("Attendance Already Marked Today");
    } else if (payload.attendanceStatus === "PUNCH_IN") {
      setMessage("Employee matched — ready to Punch In");
    } else if (payload.attendanceStatus === "PUNCH_OUT") {
      setMessage("Employee matched — ready to Punch Out");
    } else {
      setMessage("Employee matched. Please select Punch In or Punch Out.");
    }
  };

  const handleAttendanceResult = (event) => {
    const resultData = parseEventDetail(event.detail);
    if (!resultData) return;
    setAttendanceResult(resultData);
    setMessage(resultData.message || "Attendance update received.");

    // If attendance was successful, clear the employee card after short delay
    if (resultData.success) {
      // native may also dispatch employeeMatched with COMPLETED; still clear locally
      setTimeout(() => {
        setEmployee(null);
        setAttendanceStatus(null);
        setAttendanceRecord(null);
      }, 1400);
    }
  };

  window.addEventListener("employeeMatched", handleEmployeeMatched);
  window.addEventListener("attendanceResult", handleAttendanceResult);

  return () => {
    window.removeEventListener("employeeMatched", handleEmployeeMatched);
    window.removeEventListener("attendanceResult", handleAttendanceResult);
  };
}, []);

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
      setMessage(" Models Loaded");

setTimeout(() => {
  startVerification();
}, 1000);
    } catch (error) {
      console.error(error);
      setMessage("Failed to load models or camera");
    }
  };

  const getFaceDetections = async () => {
    if (!videoRef.current) return [];

    return await faceapi.detectAllFaces(
      videoRef.current,
      new faceapi.TinyFaceDetectorOptions()
    );
  };

  // const getDescriptorFromVideo = async () => {
  //   if (!videoRef.current) return null;

  //   const detection = await faceapi
  //     .detectSingleFace(
  //       videoRef.current,
  //       new faceapi.TinyFaceDetectorOptions()
  //     )
  //     .withFaceLandmarks()
  //     .withFaceDescriptor();

  //   if (!detection) return null;

  //   return detection.descriptor;
  // };
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

  const box = detection.detection.box;

  const faceCenterX = box.x + box.width / 2;
  const faceCenterY = box.y + box.height / 2;

  const videoWidth = videoRef.current.videoWidth;
  const videoHeight = videoRef.current.videoHeight;

  const guideCenterX = videoWidth / 2;
  const guideCenterY = videoHeight / 2;

  const guideRadius = 180;

  const distanceFromCenter = Math.sqrt(
    Math.pow(faceCenterX - guideCenterX, 2) +
      Math.pow(faceCenterY - guideCenterY, 2)
  );

  if (distanceFromCenter > guideRadius) {
    setMessage("Place face inside guide");
    return null;
  }

  return detection.descriptor;
};
  const registerFace = async () => {
  try {
    if (!name.trim()) {
      setMessage(" Enter Name First");
      return;
    }

    setMessage("Registering Face...");

    const descriptor = await getDescriptorFromVideo();

    if (!descriptor) {
      setMessage(" No Face Detected");
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
      ` ${name} Registered & Sent To Mobile`
    );

    setName("");
  } catch (error) {
    console.log(error);
    setMessage(" Registration Failed");
  }
};

  const sendPunchAction = (action) => {
    if (!employee) {
      setMessage("No employee selected for attendance action.");
      return;
    }

    if (!window.ReactNativeWebView) {
      setMessage("Unable to send action to native host.");
      return;
    }

    const payload = {
      type: action,
      employeeId: employee.id || employee.employeeId || employee.empId || employeeCode || null,
    };
     window.ReactNativeWebView.postMessage(JSON.stringify(payload));

    setMessage(`Sending ${action.replace("_", " ")} request...`);
  };

  const closeEmployeeModal = () => {
    setEmployee(null);
    setAttendanceStatus(null);
    setAttendanceRecord(null);
    setAttendanceResult(null);
    setMessage("");
      lastMatchedRef.current = null;

  };

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

  const startVerification = async () => {
  if (verificationInterval.current) {
    clearInterval(verificationInterval.current);
  }

  setIsVerifying(true);
  setMessage("Verification Started");

  verificationInterval.current = setInterval(async () => {
    try {
      const registeredFaces =
        JSON.parse(localStorage.getItem("registeredFaces")) || [];

      if (registeredFaces.length === 0) {
        setMessage("No Faces Loaded");
        return;
      }

      const faces = await getFaceDetections();

      if (faces.length === 0) {
        setMultipleFaces(false);
        setMessage("No Face Detected");
        return;
      }

      if (faces.length > 1) {
        setMultipleFaces(true);
        setMessage("Multiple Faces Detected\nOnly one face at a time");
        return;
      }

      setMultipleFaces(false);

      const descriptor = await getDescriptorFromVideo();

      if (!descriptor) {
        setMessage("No Face Detected");
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
  }, 300);
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
// return (
  
// <div
//   style={{
//     width: "100%",
//     maxWidth: 1400,
//     flex: 1,
//     display: "grid",
//     gridTemplateColumns: "260px 1fr 260px",
//     gap: 20,
//     minHeight: 0,
//     height: "calc(100vh - 8px)", // adjust as needed
//   }}
// >
//   {/* LEFT PANEL */}
//   <div
//     style={{
//       background: "#fff",
//       borderRadius: 20,
//       border: "1px solid #e9ecef",
//       padding: 20,
//       display: "flex",
//       flexDirection: "column",
//       gap: 20,
//       boxShadow: "0 2px 16px rgba(0,0,0,0.06)",
//     }}
//   >
//     <div>
//       <div
//         style={{
//           fontSize: 11,
//           color: "#94a3b8",
//           marginBottom: 6,
//           letterSpacing: "0.05em",
//         }}
//       >
//         STATUS
//       </div>

//       <div
//         style={{
//           fontSize: 24,
//           fontWeight: 700,
//           color: loading
//             ? "#64748b"
//             : isVerifying
//             ? "#2563eb"
//             : "#16a34a",
//         }}
//       >
//         {loading ? "Loading" : isVerifying ? "Scanning" : "Ready"}
//       </div>
//     </div>

//     <div>
//       <div
//         style={{
//           fontSize: 11,
//           color: "#94a3b8",
//           marginBottom: 6,
//           letterSpacing: "0.05em",
//         }}
//       >
//         DETECTION
//       </div>

//       <div
//         style={{
//           fontSize: 24,
//           fontWeight: 700,
//           color: multipleFaces ? "#dc2626" : "#16a34a",
//         }}
//       >
//         {multipleFaces ? "Multiple" : "Single"}
//       </div>
//     </div>

//     <div>
//       <div
//         style={{
//           fontSize: 11,
//           color: "#94a3b8",
//           marginBottom: 6,
//           letterSpacing: "0.05em",
//         }}
//       >
//         MODE
//       </div>

//       <div
//         style={{
//           fontSize: 24,
//           fontWeight: 700,
//           color: "#111",
//         }}
//       >
//         Auto Verify
//       </div>
//     </div>
//   </div>

//   {/* CENTER CAMERA */}
//   <div
//     style={{
//       background: "#fff",
//       borderRadius: 20,
//       border: "1px solid #e9ecef",
//       overflow: "hidden",
//       position: "relative",
//       boxShadow: "0 2px 16px rgba(0,0,0,0.06)",
//     }}
//   >
//     <div
//       style={{
//         position: "relative",
//         width: "100%",
//         height: "100%",
//         background: "#000",
//       }}
//     >
//       <video
//         ref={videoRef}
//         autoPlay
//         muted
//         playsInline
//         style={{
//           width: "100%",
//           height: "100%",
//           objectFit: "cover",
//           transform: "scaleX(-1)",
//         }}
//       />

//       {/* Face Guide */}
//       <div
//         style={{
//           position: "absolute",
//           top: "50%",
//           left: "50%",
//           width: 220,
//           height: 280,
//           transform: "translate(-50%, -50%)",
//           border: "2px solid rgba(255,255,255,0.5)",
//           borderRadius: "50%",
//           pointerEvents: "none",
//         }}
//       />

//       {/* Multiple Faces Warning */}
//       {multipleFaces && (
//         <div
//           style={{
//             position: "absolute",
//             inset: 0,
//             background: "rgba(220,38,38,0.85)",
//             display: "flex",
//             flexDirection: "column",
//             justifyContent: "center",
//             alignItems: "center",
//             color: "#fff",
//             gap: 12,
//           }}
//         >
//           <div
//             style={{
//               fontSize: 30,
//               fontWeight: 700,
//             }}
//           >
//             
//           </div>

//           <div
//             style={{
//               fontSize: 22,
//               fontWeight: 700,
//             }}
//           >
//             One Face At A Time
//           </div>

//           <div
//             style={{
//               fontSize: 14,
//               opacity: 0.9,
//             }}
//           >
//             Please ensure only one person is visible
//           </div>
//         </div>
//       )}
//     </div>
//   </div>

//   {/* RIGHT PANEL */}
//   <div
//     style={{
//       background: "#fff",
//       borderRadius: 20,
//       border: "1px solid #e9ecef",
//       padding: 20,
//       display: "flex",
//       flexDirection: "column",
//       boxShadow: "0 2px 16px rgba(0,0,0,0.06)",
//     }}
//   >
//     <div
//       style={{
//         fontSize: 11,
//         color: "#94a3b8",
//         marginBottom: 12,
//         letterSpacing: "0.05em",
//       }}
//     >
//       VERIFICATION RESULT
//     </div>

//     <div
//       style={{
//         flex: 1,
//         display: "flex",
//         flexDirection: "column",
//         justifyContent: "center",
//         alignItems: "center",
//         textAlign: "center",
//       }}
//     >
//       <div
//         style={{
//           fontSize: 70,
//           marginBottom: 20,
//         }}
//       >
//         {message.includes("MATCH") || message.includes("")
//           ? ""
//           : message.includes("UNKNOWN") || message.includes("")
//           ? ""
//           : "👤"}
//       </div>

//       <div
//         style={{
//           fontSize: 18,
//           fontWeight: 700,
//           color: "#111",
//           whiteSpace: "pre-line",
//           lineHeight: 1.6,
//         }}
//       >
//         {message || "Waiting for face..."}
//       </div>
//     </div>
//   </div>
// </div>


// );
const employeePhoto =
  employee?.photo ||
  employee?.photoUrl ||
  employee?.avatar ||
  employee?.profileImage ||
  employee?.image;

const employeeCode =
  employee?.employeeCode ||
  employee?.code ||
  employee?.employeeId ||
  employee?.id ||
  employee?.empCode;

const employeeDepartment =
  employee?.department ||
  employee?.dept ||
  employee?.division;

const employeeDesignation =
  employee?.designation ||
  employee?.jobTitle ||
  employee?.title;

const attendanceMessage =
  attendanceResult?.message ||
  (attendanceResult ? "Attendance action completed." : "");

return (
  <div
    style={{
    //   width: "100vw",
    //   height: "100vh",
    //   overflow: "hidden",
    //   position: "relative",
    //   background: "#000",
    //   fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
    //       position: 'relative',
    // left: '-126px',
    display:'flex',
    justifyContent:'center',
        //  width: "100vw",
      // height: "100vh",
    }}
  >
    {employee && (
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 80,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "rgba(0,0,0,0.55)",
          padding: 24,
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 560,
            borderRadius: 28,
            background: "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.14)",
            backdropFilter: "blur(28px)",
            boxShadow: "0 40px 120px rgba(0,0,0,0.35)",
            padding: 28,
            color: "#fff",
            position: "relative",
          }}
        >
          <button
            onClick={closeEmployeeModal}
            aria-label="Close"
            style={{
              position: "absolute",
              top: 12,
              right: 12,
              width: 36,
              height: 36,
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.04)",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 18,
              marginBottom: 22,
            }}
          >
            <div
              style={{
                width: 88,
                height: 88,
                borderRadius: 22,
                overflow: "hidden",
                background: "rgba(255,255,255,0.1)",
                display: "grid",
                placeItems: "center",
                border: "1px solid rgba(255,255,255,0.18)",
              }}
            >
              {employeePhoto ? (
                <img
                  src={employeePhoto}
                  alt="Employee"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <div
                  style={{
                    color: "rgba(255,255,255,0.65)",
                    fontSize: 24,
                    fontWeight: 700,
                  }}
                >
                  {attendanceDetails?.firstname?.[0] || "E"}
                </div>
              )}
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em" }}>
                {attendanceDetails?.firstname || "Employee"}
              </div>
              {/* <div style={{ color: "rgba(255,255,255,0.65)", marginTop: 6, fontSize: 13 }}>
                {emplattendanceDetails?.username || "Code unavailable"}
              </div> */}
            </div>
          </div>
          {/* <div style={{ display: "grid", gap: 12, marginBottom: 24 }}>
            <div>
              <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 6 }}>
                Department
              </div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{employeeDepartment || "Unknown"}</div>
            </div>
            <div>
              <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 6 }}>
                Designation
              </div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{employeeDesignation || "Unknown"}</div>
            </div>
          </div> */}
          {attendanceMessage && (
            <div
              style={{
                padding: "14px 18px",
                borderRadius: 18,
                background: attendanceResult?.success ? "rgba(34,197,94,0.16)" : "rgba(248,113,113,0.16)",
                border: `1px solid ${attendanceResult?.success ? "rgba(34,197,94,0.25)" : "rgba(248,113,113,0.25)"}`,
                color: attendanceResult?.success ? "#d1fae5" : "#fecaca",
                marginBottom: 20,
                fontSize: 14,
                lineHeight: 1.5,
              }}
            >
              {attendanceMessage}
            </div>
          )}
          <div style={{ display: "grid", gap: 14 }}>
            {attendanceStatus === "PUNCH_IN" && (
              <button
                onClick={() => sendPunchAction("PUNCH_IN")}
                style={{
                  width: "100%",
                  padding: "18px 20px",
                  borderRadius: 16,
                  border: "none",
                  background: "linear-gradient(135deg, #22c55e, #4ade80)",
                  color: "#071c0a",
                  fontSize: 16,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Punch In
              </button>
            )}

            {attendanceStatus === "PUNCH_OUT" && (
              <button
                onClick={() => sendPunchAction("PUNCH_OUT")}
                style={{
                  width: "100%",
                  padding: "18px 20px",
                  borderRadius: 16,
                  border: "1px solid rgba(255,255,255,0.18)",
                  background: "rgba(255,255,255,0.08)",
                  color: "#fff",
                  fontSize: 16,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Punch Out
              </button>
            )}

            {attendanceStatus === "COMPLETED" && (
              <div
                style={{
                  padding: "14px 18px",
                  borderRadius: 12,
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  color: "#fff",
                  textAlign: "center",
                  fontWeight: 600,
                }}
              >
                Attendance Already Marked Today
              </div>
            )}

            {/* fallback: if attendanceStatus is not provided, show both actions */}
            {!attendanceStatus && (
              <>
                <button
                  onClick={() => sendPunchAction("PUNCH_IN")}
                  style={{
                    width: "100%",
                    padding: "18px 20px",
                    borderRadius: 16,
                    border: "none",
                    background: "linear-gradient(135deg, #22c55e, #4ade80)",
                    color: "#071c0a",
                    fontSize: 16,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Punch In
                </button>
                <button
                  onClick={() => sendPunchAction("PUNCH_OUT")}
                  style={{
                    width: "100%",
                    padding: "18px 20px",
                    borderRadius: 16,
                    border: "1px solid rgba(255,255,255,0.18)",
                    background: "rgba(255,255,255,0.08)",
                    color: "#fff",
                    fontSize: 16,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
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
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        objectFit: "cover",
        transform: "scaleX(-1)",
      }}
    />

    {/* VIGNETTE */}
    <div
      style={{
        position: "absolute",
        inset: 0,
        background:
          "radial-gradient(ellipse at center, transparent 220px, rgba(0, 0, 0, 0.23) 400px, rgba(40, 38, 38, 0.7) 90%)",
        zIndex: 1,
      }}
    />

    {/* TOP BAR */}
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: 64,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 32px",
        background: "rgba(0,0,0,0.35)",
        backdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        zIndex: 20,
      }}
    >
      {/* Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div
          style={{
            width: 32,
            height: 32,
            background: "rgba(255,255,255,0.12)",
            borderRadius: 8,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "1px solid rgba(255,255,255,0.18)",
          }}
        >
          {/* Feather: aperture */}
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
        <span style={{ color: "#fff", fontWeight: 600, fontSize: 15, letterSpacing: "-0.01em" }}>
          FaceID Attendance
        </span>
      </div>

      {/* Status pills */}
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: loading ? "rgba(100,116,139,0.3)" : "rgba(22,163,74,0.2)",
            border: `1px solid ${loading ? "rgba(100,116,139,0.4)" : "rgba(34,197,94,0.4)"}`,
            color: loading ? "#94a3b8" : "#4ade80",
            padding: "5px 12px",
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 500,
            backdropFilter: "blur(10px)",
          }}
        >
          {/* <div style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor" }} /> */}
          {loading ? "Loading" : "Models Ready"}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: isVerifying ? "rgba(37,99,235,0.25)" : "rgba(100,116,139,0.2)",
            border: `1px solid ${isVerifying ? "rgba(96,165,250,0.4)" : "rgba(100,116,139,0.3)"}`,
            color: isVerifying ? "#93c5fd" : "#64748b",
            padding: "5px 10px",
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 500,
            backdropFilter: "blur(10px)",
          }}
        >
          {/* <div style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor" }} /> */}
          {isVerifying ? "Verifying" : "Standby"}
        </div>
      </div>

      {/* Clock */}
      <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, fontWeight: 500, letterSpacing: "0.02em" }}>
        {new Date().toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
      </div>
    </div>

    {/* LEFT PANEL */}
    <div
      style={{
        position: "absolute",
        top: "50%",
        left: 40,
        transform: "translateY(-50%)",
        width: 220,
        display: "flex",
        flexDirection: "column",
        gap: 16,
        zIndex: 10,
      }}
    >
      {/* Today stat */}
    <div
  style={{
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 16,
    padding: "18px 20px",
    backdropFilter: "blur(16px)",
  }}
>
  <div
    style={{
      color: "rgba(255,255,255,0.45)",
      fontSize: 11,
      fontWeight: 500,
      textTransform: "uppercase",
      letterSpacing: "0.08em",
      marginBottom: 6,
    }}
  >
    Today's Date
  </div>

  <div
    style={{
      color: "#fff",
      fontSize: 36,
      fontWeight: 700,
      lineHeight: 1,
    }}
  >
    {new Date().getDate()}
  </div>

  <div
    style={{
      color: "#60a5fa",
      fontSize: 13,
      fontWeight: 600,
      marginTop: 8,
    }}
  >
    {new Date().toLocaleDateString([], {
      month: "long",
      year: "numeric",
    })}
  </div>

  <div
    style={{
      color: "rgba(255,255,255,0.45)",
      fontSize: 12,
      marginTop: 4,
    }}
  >
    {new Date().toLocaleDateString([], {
      weekday: "long",
    })}
  </div>

  <div
    style={{
      marginTop: 10,
      paddingTop: 10,
      borderTop: "1px solid rgba(255,255,255,0.08)",
      color: "rgba(255,255,255,0.35)",
      fontSize: 11,
    }}
  >
    Attendance tracking active today
  </div>
</div>

      {/* Shift */}
  <div
  style={{
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 20,
    padding: "24px",
    backdropFilter: "blur(20px)",
    display: "flex",
    flexDirection: "column",
    gap: 8,
  }}
>
  <div
    style={{
      color: "rgba(255,255,255,0.45)",
      fontSize: 11,
      fontWeight: 600,
      textTransform: "uppercase",
      letterSpacing: "0.12em",
    }}
  >
    Local Time
  </div>

  <div
    style={{
      color: "#fff",
      fontSize: 29,
      fontWeight: 700,
      lineHeight: 1,
    }}
  >
  {currentTime.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })}
    </div>

  <div
    style={{
      width: 40,
      height: 2,
      borderRadius: 99,
      background: "linear-gradient(90deg, #3b82f6, #60a5fa)",
      margin: "4px 0",
    }}
  />

  <div
    style={{
      color: "#93c5fd",
      fontSize: 15,
      fontWeight: 600,
    }}
  >
    {greeting}
  </div>

  <div
    style={{
      color: "rgba(255,255,255,0.35)",
      fontSize: 12,
    }}
  >
    Reception • Device #01
  </div>
</div>

      {/* Location */}
      <div
        style={{
          background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 16,
          padding: "16px 20px",
          backdropFilter: "blur(16px)",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        {/* Feather: map-pin */}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>
          <circle cx="12" cy="10" r="3"/>
        </svg>
        <div>
      <div style={{ color: "#fff", fontSize: 13, fontWeight: 500 }}>Reception</div>
<div style={{ color: "rgba(255,255,255,0.35)", fontSize: 11 }}>Device #01</div>
        </div>
      </div>
    </div>

    {/* FACE GUIDE */}
    <div
      style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: 5,
      }}
    >
      {/* Oval */}
      <div
        style={{
          width: 270,
          height: 330,
          borderRadius: "50%",
          border: "2px solid rgba(255,255,255,0.55)",
          position: "relative",
        }}
      >
        {/* Corner marks */}
        {[
          { top: -3, left: -3, borderTop: "3px solid #fff", borderLeft: "3px solid #fff", borderRadius: "6px 0 0 0" },
          { top: -3, right: -3, borderTop: "3px solid #fff", borderRight: "3px solid #fff", borderRadius: "0 6px 0 0" },
          { bottom: -3, left: -3, borderBottom: "3px solid #fff", borderLeft: "3px solid #fff", borderRadius: "0 0 0 6px" },
          { bottom: -3, right: -3, borderBottom: "3px solid #fff", borderRight: "3px solid #fff", borderRadius: "0 0 6px 0" },
        ].map((s, i) => (
          <div key={i} style={{ position: "absolute", width: 22, height: 22, ...s }} />
        ))}
      </div>

      {/* Guide label */}
      <div
        style={{
          textAlign: "center",
          marginTop: 20,
          color: "rgba(255,255,255,0.6)",
          fontSize: 13,
          fontWeight: 500,
          letterSpacing: "0.02em",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
        }}
      >
        {/* Feather: eye */}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
        Position face within guide
      </div>
    </div>

    {/* RIGHT PANEL — Last matched user */}
    <div
      style={{
        position: "absolute",
        top: "50%",
        right: 40,
        transform: "translateY(-50%)",
        width: 230,
        display: "flex",
        flexDirection: "column",
        gap: 16,
        zIndex: 10,
      }}
    >
      {/* Last verified card */}
     

      {/* Recent log */}
      {/* <div
        style={{
          background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 16,
          padding: "16px 20px",
          backdropFilter: "blur(16px)",
        }}
      >
        <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
          Recent
        </div>
        {[
          { initials: "SR", name: "Sneha R.", time: "9:38 AM", color: "#f97316" },
          { initials: "MT", name: "Mihir T.", time: "9:31 AM", color: "#a78bfa" },
          { initials: "PD", name: "Priya D.", time: "9:24 AM", color: "#34d399" },
        ].map((p, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: i < 2 ? 10 : 0 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: p.color + "33",
                border: `1px solid ${p.color}55`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 11,
                fontWeight: 700,
                color: p.color,
                flexShrink: 0,
              }}
            >
              {p.initials}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ color: "#fff", fontSize: 12, fontWeight: 500 }}>{p.name}</div>
            </div>
            <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 11 }}>{p.time}</div>
          </div>
        ))}
      </div> */}
      <div
  style={{
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 16,
    padding: "16px 20px",
    backdropFilter: "blur(16px)",
  }}
>
  <div
    style={{
      color: "rgba(255,255,255,0.45)",
      fontSize: 11,
      fontWeight: 500,
      textTransform: "uppercase",
      letterSpacing: "0.08em",
      marginBottom: 12,
    }}
  >
    System Status
  </div>

 <div
  style={{
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 16,
    padding: "16px 20px",
    backdropFilter: "blur(16px)",
  }}
>
  <div
    style={{
      color: "rgba(255,255,255,0.45)",
      fontSize: 11,
      fontWeight: 500,
      textTransform: "uppercase",
      letterSpacing: "0.08em",
      marginBottom: 12,
    }}
  >
    System Status
  </div>

  {systemStatus.map((item, i) => (
    <div
      key={i}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        marginBottom: i < systemStatus.length - 1 ? 12 : 0,
      }}
    >
      <div
        style={{
          width: 10,
          height: 10,
          borderRadius: "50%",
          background: item.online ? "#4ade80" : "#ef4444",
          boxShadow: item.online
            ? "0 0 10px rgba(74,222,128,.7)"
            : "0 0 10px rgba(239,68,68,.7)",
          flexShrink: 0,
        }}
      />

      <div
        style={{
          color: "#fff",
          fontSize: 12,
          fontWeight: 500,
        }}
      >
        {item.label}
      </div>
    </div>
  ))}
</div>
</div>
    </div>

    {/* RESULT BAR */}
    <div
      style={{
        position: "absolute",
        bottom: 32,
        left: "50%",
        transform: "translateX(-50%)",
        minWidth: 360,
        maxWidth: 560,
        background: "rgba(0,0,0,0.45)",
        backdropFilter: "blur(20px)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 20,
        padding: "18px 28px",
        display: "flex",
        alignItems: "center",
        gap: 16,
        zIndex: 10,
      }}
    >
    

      <div style={{ whiteSpace: "pre-line" }}>
        <div
          style={{
            color: message.includes("MATCH") || message.includes("")
              ? "#ffffff"
              : message.includes("UNKNOWN") || message.includes("")
              ? "#f87171"
              : "rgba(255,255,255,0.85)",
            fontSize: 15,
            fontWeight: 600,
            lineHeight: 1.5,
          }}
        >
          {message || "Waiting for face…"}
        </div>
      </div>
    </div>

    {/* MULTIPLE FACES WARNING */}
    {multipleFaces && (
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(153,27,27,0.92)",
          backdropFilter: "blur(8px)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          zIndex: 50,
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