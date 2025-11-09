// --- RFID Registration Clean Version ---
// Handles camera modal, image capture, cropping, and preview

// --- Form and elements ---
const form = document.getElementById("rfidForm");
const preview = document.getElementById("photo-preview");
const photoInput = document.getElementById("photoData");
const retakeBtn = document.getElementById("retake-btn");


// --- Crop modal elements ---
const cropModal = document.getElementById("cropModal");
const cropCanvas = document.getElementById("cropCanvas");
const cropCtx = cropCanvas.getContext("2d");
const cropSubmit = document.getElementById("cropSubmit");
const cropCancel = document.getElementById("cropCancel");

let img = new Image();
let imgW = 0, imgH = 0;
let crop = { x: 0, y: 0, size: 100 };
let action = null;
let activeHandle = null;
let dragOffset = { x: 0, y: 0 };
const HANDLE_SIZE = 12;
const MIN_CROP = 40;

// --- Camera modal elements ---
document.addEventListener("DOMContentLoaded", () => {
  const openBtn = document.getElementById("open-camera-btn");
  const cameraModal = document.getElementById("cameraModal");
  const modalVideo = document.getElementById("modalVideo");
  const modalSnapshot = document.getElementById("modalSnapshot");
  const modalCapture = document.getElementById("modalCapture");
  // multiple elements use the id "modalClose" (header close and footer Close button).
  // select all and attach the same handler so every Close button works.
  const modalCloseEls = document.querySelectorAll('#modalClose');

  let modalStream = null;

  function show(el) {
    if (!el) return;
    el.style.display = "flex";
    el.classList.add("active");
    el.setAttribute("aria-hidden", "false");
  }

  function hide(el) {
    if (!el) return;
    el.style.display = "none";
    el.classList.remove("active");
    el.setAttribute("aria-hidden", "true");
  }

  async function startCameraForVideo(videoEl) {
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });
      videoEl.srcObject = s;
      await videoEl.play().catch(() => {});
      return s;
    } catch (err) {
      alert("Unable to access camera: " + err.message);
      return null;
    }
  }

  async function startCameraModal() {
    modalStream = await startCameraForVideo(modalVideo);
    if (modalStream) show(cameraModal);
  }

  function stopCameraModal() {
    try {
      if (modalStream) modalStream.getTracks().forEach((t) => t.stop());
      modalStream = null;
      if (modalVideo) {
        modalVideo.pause();
        modalVideo.srcObject = null;
      }
    } catch (e) {
      console.warn(e);
    }
    hide(cameraModal);
  }

  function captureFromVideo(videoEl, canvasEl) {
    const w = videoEl.videoWidth || 640;
    const h = videoEl.videoHeight || 480;
    canvasEl.width = w;
    canvasEl.height = h;
    const ctx = canvasEl.getContext("2d");
    ctx.drawImage(videoEl, 0, 0, w, h);
    return canvasEl.toDataURL("image/png");
  }

  async function captureFromModalFlow() {
    const dataUrl = captureFromVideo(modalVideo, modalSnapshot);
    if (!dataUrl) {
      alert("Capture failed");
      return;
    }

    if (document.activeElement) document.activeElement.blur();
    hide(cameraModal);

    // open crop modal with captured image
    openCropModal(dataUrl);
  }

  if (openBtn) openBtn.addEventListener("click", startCameraModal);
  if (modalCapture) modalCapture.addEventListener("click", captureFromModalFlow);
  if (modalCloseEls && modalCloseEls.length) {
    modalCloseEls.forEach(el => el.addEventListener('click', stopCameraModal));
  }

  window.addEventListener("beforeunload", () => {
    try {
      if (modalStream) modalStream.getTracks().forEach((t) => t.stop());
    } catch {}
  });
});

// Prevent RFID field from auto-submitting the form on Enter key
document.getElementById("rfid").addEventListener("keydown", function (event) {
  if (event.key === "Enter" || event.keyCode === 13) {
    event.preventDefault();
    event.stopPropagation();
    // Optionally, move to the next field automatically
    const nextInput = document.querySelector("#firstName");
    if (nextInput) nextInput.focus();
  }
});


// --- Crop logic ---
function openCropModal(dataURL) {
  img.src = dataURL;
  img.onload = () => {
    imgW = img.naturalWidth;
    imgH = img.naturalHeight;

    const maxDisplayWidth = 680;
    const displayW = Math.min(imgW, maxDisplayWidth);
    const scale = displayW / imgW;
    cropCanvas.width = displayW;
    cropCanvas.height = imgH * scale;

    const minSide = Math.min(cropCanvas.width, cropCanvas.height);
    crop.size = Math.floor(minSide * 0.6);
    crop.x = Math.floor((cropCanvas.width - crop.size) / 2);
    crop.y = Math.floor((cropCanvas.height - crop.size) / 2);

    drawCropCanvas();
    cropModal.style.display = "block";
    cropModal.classList.add("active");
    cropModal.setAttribute("aria-hidden", "false");
  };
}

function drawCropCanvas() {
  cropCtx.clearRect(0, 0, cropCanvas.width, cropCanvas.height);

  // draw image first
  cropCtx.drawImage(img, 0, 0, imgW, imgH, 0, 0, cropCanvas.width, cropCanvas.height);

  // darken outside the crop square
  cropCtx.save();
  cropCtx.fillStyle = "rgba(0,0,0,0.5)";
  cropCtx.beginPath();
  cropCtx.rect(0, 0, cropCanvas.width, cropCanvas.height); // full area
  cropCtx.rect(crop.x, crop.y, crop.size, crop.size);       // hole
  cropCtx.fill("evenodd"); // uses even-odd rule to cut a hole
  cropCtx.restore();

  // white border
  cropCtx.strokeStyle = "#fff";
  cropCtx.lineWidth = 2;
  cropCtx.strokeRect(crop.x, crop.y, crop.size, crop.size);

  // small white handles
  const hs = 10;
  cropCtx.fillStyle = "#fff";
  cropCtx.strokeStyle = "#000";
  const corners = [
    [crop.x, crop.y],
    [crop.x + crop.size, crop.y],
    [crop.x, crop.y + crop.size],
    [crop.x + crop.size, crop.y + crop.size],
  ];
  corners.forEach(([cx, cy]) => {
    cropCtx.fillRect(cx - hs / 2, cy - hs / 2, hs, hs);
    cropCtx.strokeRect(cx - hs / 2, cy - hs / 2, hs, hs);
  });
}


function getMousePos(e) {
  const rect = cropCanvas.getBoundingClientRect();
  return {
    x: ((e.clientX - rect.left) / rect.width) * cropCanvas.width,
    y: ((e.clientY - rect.top) / rect.height) * cropCanvas.height,
  };
}

function hitHandle(p) {
  const hs = 10;
  const handles = {
    nw: [crop.x, crop.y],
    ne: [crop.x + crop.size, crop.y],
    sw: [crop.x, crop.y + crop.size],
    se: [crop.x + crop.size, crop.y + crop.size],
  };
  for (const key in handles) {
    const [hx, hy] = handles[key];
    if (
      p.x >= hx - hs / 2 &&
      p.x <= hx + hs / 2 &&
      p.y >= hy - hs / 2 &&
      p.y <= hy + hs / 2
    )
      return key;
  }
  return null;
}

cropCanvas.addEventListener("mousedown", (e) => {
  const p = getMousePos(e);
  const handle = hitHandle(p);
  if (handle) {
    action = "resize";
    activeHandle = handle;
  } else if (
    p.x >= crop.x &&
    p.x <= crop.x + crop.size &&
    p.y >= crop.y &&
    p.y <= crop.y + crop.size
  ) {
    action = "drag";
    dragOffset.x = p.x - crop.x;
    dragOffset.y = p.y - crop.y;
  } else {
    action = null;
  }
});

window.addEventListener("mousemove", (e) => {
  if (!action) return;
  const p = getMousePos(e);

  if (action === "drag") {
    crop.x = Math.max(0, Math.min(cropCanvas.width - crop.size, p.x - dragOffset.x));
    crop.y = Math.max(0, Math.min(cropCanvas.height - crop.size, p.y - dragOffset.y));
  } else if (action === "resize" && activeHandle) {
    const oldX = crop.x;
    const oldY = crop.y;
    switch (activeHandle) {
      case "se":
        crop.size = Math.max(MIN_CROP, Math.min(p.x - oldX, p.y - oldY));
        break;
      case "nw":
        const dx = oldX - p.x;
        const dy = oldY - p.y;
        const d = Math.max(dx, dy);
        crop.size = Math.max(MIN_CROP, crop.size + d);
        crop.x = oldX - d;
        crop.y = oldY - d;
        break;
      case "ne":
        const dx2 = p.x - oldX;
        const dy2 = oldY - p.y;
        const d2 = Math.max(dx2, dy2);
        crop.size = Math.max(MIN_CROP, d2);
        crop.y = oldY - (crop.size - dy2);
        break;
      case "sw":
        const dx3 = oldX - p.x;
        const dy3 = p.y - oldY;
        const d3 = Math.max(dx3, dy3);
        crop.size = Math.max(MIN_CROP, d3);
        crop.x = oldX - (crop.size - dx3);
        break;
    }
    // keep within bounds
    if (crop.x < 0) crop.x = 0;
    if (crop.y < 0) crop.y = 0;
    if (crop.x + crop.size > cropCanvas.width)
      crop.size = cropCanvas.width - crop.x;
    if (crop.y + crop.size > cropCanvas.height)
      crop.size = cropCanvas.height - crop.y;
  }

  drawCropCanvas();
});

window.addEventListener("mouseup", () => {
  action = null;
  activeHandle = null;
});


// cancel crop
cropCancel.addEventListener("click", () => {
  cropModal.classList.remove("active");
  cropModal.setAttribute("aria-hidden", "true");
  cropModal.style.display = "none";
});

// save crop
cropSubmit.addEventListener("click", () => {
  const finalSize = 400;
  const tmp = document.createElement("canvas");
  tmp.width = finalSize;
  tmp.height = finalSize;
  const tCtx = tmp.getContext("2d");

  const sx = (crop.x / cropCanvas.width) * imgW;
  const sy = (crop.y / cropCanvas.height) * imgH;
  const sSize = (crop.size / cropCanvas.width) * imgW;

  tCtx.drawImage(img, sx, sy, sSize, sSize, 0, 0, finalSize, finalSize);
  const finalData = tmp.toDataURL("image/png");
  retakeBtn.style.display = "inline-block";

  photoInput.value = finalData;
  preview.src = finalData;
  preview.style.display = "block";

  cropModal.classList.remove("active");
  cropModal.setAttribute("aria-hidden", "true");
  cropModal.style.display = "none";

  // revert to "Open Camera" button
  const liveArea = document.getElementById("live-area");
  const openBtn = document.getElementById("open-camera-btn");
  if (liveArea) liveArea.style.display = "none";
  if (openBtn) openBtn.style.display = "inline-block";
});

retakeBtn.addEventListener("click", () => {
  preview.style.display = "none";
  retakeBtn.style.display = "none";
  const openBtn = document.getElementById("open-camera-btn");
  if (openBtn) openBtn.style.display = "inline-block";
});


// --- Preview ID button ---
document.getElementById("preview-btn").addEventListener("click", async () => {
  try {
    // Gather form values
    const formData = {
      rfid: document.getElementById("rfid").value || "",
      role: document.getElementById("role").value || "",
      firstName: document.getElementById("firstName").value || "",
      middleInitial: document.getElementById("middleInitial").value || "",
      lastName: document.getElementById("lastName").value || "",
      fullName: (
        (document.getElementById("firstName").value || "") + " " +
        (document.getElementById("middleInitial").value || "") + " " +
        (document.getElementById("lastName").value || "")
      ).trim(),
      department: document.getElementById("department").value || "",
      course: document.getElementById("coursePosition").value || "",
      position: document.getElementById("coursePosition").value || "",
      address: document.getElementById("address").value || "",
      contactNumber: document.getElementById("contactNumber").value || "",
      birthdate: document.getElementById("birthdate").value || "",
      height: document.getElementById("height").value || "",
      weight: document.getElementById("weight").value || "",
      gender: document.getElementById("gender").value || "",
      civilStatus: document.getElementById("civilStatus").value || "",
      emergencyContact: document.getElementById("emergencyContact").value || "",
      emergencyAddress: document.getElementById("emergencyAddress").value || "",
      photo: document.getElementById("photo-preview").src || ""
    };

    // 🔄 Choose ID templates based on role
    let frontTemplate = "frontID.html";
    let backTemplate = "backID.html";

    if (formData.role === "faculty" || formData.role === "employee") {
      frontTemplate = "facultyIDfront.html";
      backTemplate = "facultyIDback.html";
    }
    // (You can later add: if visitor → "visitorIDfront.html", etc.)

    // Fetch templates
    const [frontHTML, backHTML] = await Promise.all([
      fetch(frontTemplate).then(r => r.ok ? r.text() : Promise.reject(new Error(`Failed to load ${frontTemplate}`))),
      fetch(backTemplate).then(r => r.ok ? r.text() : Promise.reject(new Error(`Failed to load ${backTemplate}`)))
    ]);

    // Replace placeholders like {{fullName}} etc.
    const replacePlaceholders = (html, data) => {
      let out = html;
      Object.keys(data).forEach(key => {
        const val = (data[key] === null || typeof data[key] === 'undefined') ? '' : String(data[key]);
        const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
        out = out.replace(regex, val);
      });
      return out;
    };

    const populatedFront = replacePlaceholders(frontHTML, formData);
    const populatedBack = replacePlaceholders(backHTML, formData);

    // 🪞 Open preview popup
    const previewWindow = window.open("", "ID Preview", "width=900,height=700");
    if (!previewWindow) {
      alert("Popup blocked. Please allow popups for this site.");
      return;
    }

    const injectedName = JSON.stringify(formData.fullName || "RFID_ID");
    let popupHtml = "";
    popupHtml += '<!doctype html><html><head><meta charset="utf-8"><title>ID Preview</title>';
    popupHtml += '<style>';
    popupHtml += 'body{background:#f0f0f0;font-family:Arial,Helvetica,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0;padding:20px;}';
    popupHtml += '.card-preview-container{position:relative;width:350px;height:500px;perspective:1000px;cursor:pointer;}';
    popupHtml += '.id-card-side{width:100%;height:100%;position:absolute;border-radius:15px;backface-visibility:hidden;transition:transform 0.8s;overflow:hidden;box-shadow:0 10px 25px rgba(0,0,0,0.3);}';
    popupHtml += '.id-card-side.front{transform:rotateY(0deg);}';
    popupHtml += '.id-card-side.back{transform:rotateY(180deg);}';
    popupHtml += '.flipped .front{transform:rotateY(180deg);}';
    popupHtml += '.flipped .back{transform:rotateY(360deg);}';
    popupHtml += '.id-card-side{transform-style:preserve-3d;border:1px solid rgba(255,255,255,0.08);background:#fff;}';
    popupHtml += '.card-preview-container::after{content:"";position:absolute;bottom:-15px;left:10%;width:80%;height:20px;background:rgba(0,0,0,0.18);filter:blur(8px);border-radius:50%;transform:translateY(10px);}';
    popupHtml += '.controls{margin-top:18px;}';
    popupHtml += 'button{padding:10px 14px;border:none;border-radius:6px;font-size:14px;cursor:pointer;background:#007bff;color:#fff;}';
    popupHtml += 'button:hover{background:#0056b3;}';
    popupHtml += '.hint{font-size:13px;color:#444;margin-top:8px;}';
    popupHtml += '</style></head><body>';
    popupHtml += '<div class="card-preview-container" id="cardContainer">';
    popupHtml += `<div class="id-card-side front" id="frontSide">${populatedFront}</div>`;
    popupHtml += `<div class="id-card-side back" id="backSide">${populatedBack}</div>`;
    popupHtml += '</div>';
    popupHtml += '<div class="controls"><button id="downloadBtn">Download as PDF</button></div>';
    popupHtml += '<div class="hint">Click the card to flip. Then click "Download as PDF".</div>';

    // Include scripts
    popupHtml += `<script>var studentName = ${injectedName};</script>`;
    popupHtml += '<script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"><' + '/script>';
    popupHtml += '<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"><' + '/script>';

    // --- (same PDF creation script as before) ---
    popupHtml += `<script>
      try{
        const cardContainer=document.getElementById("cardContainer");
        cardContainer.addEventListener("click",()=>{cardContainer.classList.toggle("flipped");});
        document.getElementById("downloadBtn").addEventListener("click",async()=>{
          try{
            const front=document.getElementById("frontSide");
            const back=document.getElementById("backSide");
            const wrapper=document.createElement("div");
            wrapper.style.position="fixed";wrapper.style.top="-10000px";
            wrapper.style.display="flex";wrapper.style.gap="20px";wrapper.style.background="#fff";
            document.body.appendChild(wrapper);
            const clone=(el)=>{const c=el.cloneNode(true);c.style.transform="none";c.style.position="static";c.style.boxShadow="none";return c;};
            const cleanFront=clone(front);const cleanBack=clone(back);
            wrapper.appendChild(cleanFront);wrapper.appendChild(cleanBack);
            const imgs=wrapper.querySelectorAll("img");
            await Promise.all(Array.from(imgs).map(img=>img.complete?Promise.resolve():new Promise(r=>{img.onload=img.onerror=r;})));
            const fCanvas=await html2canvas(cleanFront,{scale:2,useCORS:true});
            const bCanvas=await html2canvas(cleanBack,{scale:2,useCORS:true});
            wrapper.remove();
            const {jsPDF}=window.jspdf;
            const cardW=350,cardH=500,margin=20;
            const pdf=new jsPDF({orientation:"landscape",unit:"px",format:[cardW*2+margin*3,cardH+margin*2]});
            pdf.addImage(fCanvas.toDataURL("image/png"),"PNG",margin,margin,cardW,cardH);
            pdf.addImage(bCanvas.toDataURL("image/png"),"PNG",margin*2+cardW,margin,cardW,cardH);
            let fileName=(typeof studentName==="string"&&studentName.trim()!==""?studentName:"RFID_ID");
            fileName=fileName.trim().replace(/[^\\w\\s]/g,"").replace(/\\s+/g,"_");
            pdf.save(fileName+"_ID.pdf");
          }catch(e){alert("Error generating PDF: "+e.message);}
        });
      }catch(e){console.error("Popup init error",e);}
    <\/script>`;

    popupHtml += '</body></html>';
    previewWindow.document.open();
    previewWindow.document.write(popupHtml);
    previewWindow.document.close();
  } catch (err) {
    console.error("Preview error:", err);
    alert("Error opening preview: " + (err.message || err));
  }
});

// --- Auto-select role from landing page ---
document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  const role = params.get("role");
  if (role && document.getElementById("role")) {
    document.getElementById("role").value = role;
  }
  // Attach handlers for any preview modal Close buttons (there may be multiple with same id)
  try {
    const previewModal = document.getElementById('previewModal');
    const closePreviewEls = document.querySelectorAll('#closePreview');
    if (closePreviewEls && closePreviewEls.length) {
      closePreviewEls.forEach(el => el.addEventListener('click', () => {
        if (previewModal) {
          previewModal.style.display = 'none';
          previewModal.setAttribute('aria-hidden', 'true');
          const container = document.getElementById('idPreviewContainer');
          if (container) container.innerHTML = '';
        }
      }));
    }
  } catch (e) {
    console.warn('Error attaching preview modal close handlers', e);
  }
});

// --- Handle Form Submission ---
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const data = {
    rfid: document.getElementById("rfid").value.trim(),
    role: document.getElementById("role").value.trim(),
    photo: document.getElementById("photoData").value || "", // Use photoData instead of photo-preview src
    first_name: document.getElementById("firstName").value.trim(),
    middle_initial: document.getElementById("middleInitial").value.trim(),
    last_name: document.getElementById("lastName").value.trim(),
    department: document.getElementById("department").value.trim(),
    course_or_position: document.getElementById("coursePosition").value.trim(),
    address: document.getElementById("address").value.trim(),
    contact_number: document.getElementById("contactNumber").value.trim(),
    birthdate: document.getElementById("birthdate").value.trim(),
    height: document.getElementById("height").value.trim(),
    weight: document.getElementById("weight").value.trim(),
    gender: document.getElementById("gender").value.trim(),
    civil_status: document.getElementById("civilStatus").value.trim(),
    emergency_contact: document.getElementById("emergencyContact").value.trim(),
    emergency_address: document.getElementById("emergencyAddress").value.trim()
  };

  // Validate required fields
  if (!data.rfid) {
    alert('Please scan your RFID card first');
    return;
  }

  if (!data.role) {
    alert('Please select your role');
    return;
  }

  if (!data.first_name || !data.last_name) {
    alert('Please enter your first and last name');
    return;
  }

  console.log("Submitting to dual database:", data);
  await submitForm(data);
});

async function submitForm(data) {
  try {
    console.log("📤 Starting registration...", data);

    const submitBtn = document.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Registering...';
    submitBtn.disabled = true;

    // Use the FIXED PHP file
    const response = await fetch("../src/php/register_user_fixed.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });

    const rawResponse = await response.text();
    console.log("📨 Raw response:", rawResponse);

    let result;
    try {
      result = JSON.parse(rawResponse);
      console.log("✅ Parsed result:", result);
    } catch (parseError) {
      console.error("❌ JSON parse error:", parseError);
      throw new Error(`Server error: ${rawResponse.substring(0, 200)}`);
    }

    if (result.success) {
      alert("✅ Registration successful! Data saved to both databases.");
      
      // Reset form
      form.reset();
      preview.style.display = "none";
      retakeBtn.style.display = "none";
      document.getElementById("open-camera-btn").style.display = "inline-block";
      
    } else {
      alert("❌ Error: " + result.message);
    }

  } catch (error) {
    console.error('💥 Registration error:', error);
    alert("❌ Registration failed: " + error.message);
  } finally {
    const submitBtn = document.querySelector('button[type="submit"]');
    submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit Registration';
    submitBtn.disabled = false;
  }
}

// --- Simple RFID WebSocket Integration ---
document.addEventListener('DOMContentLoaded', function() {
    const rfidInput = document.getElementById("rfid");
    
    // WebSocket connection for RFID
    const socket = new WebSocket("ws://localhost:8765");
    
    socket.onopen = () => {
        console.log("✅ Connected to RFID WebSocket server");
        rfidInput.placeholder = "Ready - Tap your RFID card...";
    };

    socket.onmessage = (event) => {
        const message = event.data.trim();
        console.log("📨 RFID received:", message);

        // Only update if it's a valid RFID number (not errors or status messages)
        if (message && message !== "No reader found" && 
            !message.startsWith("Error") && !message.startsWith("Reader error") &&
            message !== "Waiting for card...") {
            
            rfidInput.value = message;
            
            // Optional: Visual feedback
            rfidInput.style.backgroundColor = '#e8f5e9';
            setTimeout(() => {
                rfidInput.style.backgroundColor = '';
            }, 1000);
        }
    };

    socket.onerror = (error) => {
        console.error("❌ WebSocket error:", error);
        rfidInput.placeholder = "RFID Reader disconnected";
    };

    socket.onclose = () => {
        rfidInput.placeholder = "RFID Reader disconnected";
    };
});