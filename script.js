// =====================================================
// Pressed — Flower Field Guide
// script.js
// =====================================================

const API_BASE = "https://fs19x6d5j6.execute-api.ap-south-1.amazonaws.com";

// ===============================
// DOM Elements
// ===============================
const dropzone = document.getElementById("dropzone");
const dropzoneEmpty = document.getElementById("dropzoneEmpty");
const fileInput = document.getElementById("fileInput");
const previewImage = document.getElementById("previewImage");

const openCameraBtn = document.getElementById("openCameraBtn");
const captureBtn = document.getElementById("captureBtn");
const clearBtn = document.getElementById("clearBtn");
const recognizeBtn = document.getElementById("recognizeBtn");
const switchCameraBtn = document.getElementById("switchCameraBtn");

const viewfinder = document.getElementById("viewfinder");
const cameraFeed = document.getElementById("cameraFeed");
const captureCanvas = document.getElementById("captureCanvas");

const loadingState = document.getElementById("loadingState");
const loadingText = document.getElementById("loadingText");

const flowerName = document.getElementById("flowerName");
const flowerDescription = document.getElementById("flowerDescription");
const confidenceBadge = document.getElementById("confidenceBadge");
const confidenceValue = document.getElementById("confidenceValue");

const audioPlayer = document.getElementById("audioPlayer");
const imageLink = document.getElementById("imageLink");
const audioLink = document.getElementById("audioLink");

const historyGrid = document.getElementById("historyGrid");
const refreshHistoryBtn = document.getElementById("refreshHistoryBtn");

// ===============================
// State
// ===============================
let selectedImage = "";
let mediaStream = null;
let facingMode = "environment"; // back camera by default
let availableFacingModes = { user: true, environment: true }; // optimistic until proven otherwise

const LOADING_MESSAGES = [
  "Consulting the herbarium…",
  "Comparing petals and leaf shape…",
  "Cross-referencing the species index…",
  "Writing the field note…",
];

// ===============================
// Helpers
// ===============================
function hasImage() {
  return selectedImage !== "";
}

function setLoading(isLoading) {
  loadingState.hidden = !isLoading;
  recognizeBtn.disabled = isLoading || !hasImage();
  if (isLoading) {
    loadingText.textContent =
      LOADING_MESSAGES[Math.floor(Math.random() * LOADING_MESSAGES.length)];
  }
}

function clearResult() {
  flowerName.textContent = "Awaiting a specimen";
  flowerDescription.textContent =
    "Collect a photo above, and this card will fill in with the species, a written note, and a spoken field recording.";
  confidenceValue.textContent = "—";
  confidenceBadge.style.visibility = "hidden";
  audioPlayer.removeAttribute("src");
  imageLink.href = "#";
  audioLink.href = "#";
  imageLink.classList.add("is-disabled");
  audioLink.classList.add("is-disabled");
}

function setPreview(dataUrl) {
  selectedImage = dataUrl;
  previewImage.src = dataUrl;
  previewImage.hidden = false;
  dropzoneEmpty.hidden = true;
  clearBtn.hidden = false;
  recognizeBtn.disabled = false;
}

function resetCapture() {
  selectedImage = "";
  previewImage.hidden = true;
  previewImage.removeAttribute("src");
  dropzoneEmpty.hidden = false;
  clearBtn.hidden = true;
  recognizeBtn.disabled = true;
  fileInput.value = "";
  clearResult();
}

// ===============================
// File upload (click + drag/drop)
// ===============================
dropzone.addEventListener("click", () => fileInput.click());
dropzone.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    fileInput.click();
  }
});

fileInput.addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (!file) return;
  readFileAsImage(file);
});

["dragover", "dragenter"].forEach((evt) =>
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropzone.classList.add("is-dragover");
  })
);
["dragleave", "dragend", "drop"].forEach((evt) =>
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropzone.classList.remove("is-dragover");
  })
);
dropzone.addEventListener("drop", (e) => {
  const file = e.dataTransfer.files && e.dataTransfer.files[0];
  if (file && file.type.startsWith("image/")) readFileAsImage(file);
});

function readFileAsImage(file) {
  const reader = new FileReader();
  reader.onload = (e) => setPreview(e.target.result);
  reader.readAsDataURL(file);
}

clearBtn.addEventListener("click", resetCapture);

// ===============================
// Camera — open, switch front/back, capture
// ===============================
async function startCamera(mode) {
  stopCamera();
  try {
    const constraints = { video: { facingMode: { ideal: mode } }, audio: false };
    mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
    cameraFeed.srcObject = mediaStream;
    viewfinder.hidden = false;
    captureBtn.hidden = false;
    facingMode = mode;
  } catch (error) {
    console.error(error);
    // Fall back to any available camera if the requested facing mode fails
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      cameraFeed.srcObject = mediaStream;
      viewfinder.hidden = false;
      captureBtn.hidden = false;
    } catch (fallbackError) {
      console.error(fallbackError);
      alert("Unable to access camera. Check your browser permissions.");
    }
  }
}

function stopCamera() {
  if (mediaStream) {
    mediaStream.getTracks().forEach((track) => track.stop());
    mediaStream = null;
  }
}

openCameraBtn.addEventListener("click", () => {
  if (!viewfinder.hidden) {
    // Camera already open — treat as close
    stopCamera();
    viewfinder.hidden = true;
    captureBtn.hidden = true;
    openCameraBtn.textContent = "Open camera";
    return;
  }
  startCamera(facingMode);
  openCameraBtn.textContent = "Close camera";
});

switchCameraBtn.addEventListener("click", () => {
  const nextMode = facingMode === "environment" ? "user" : "environment";
  startCamera(nextMode);
});

captureBtn.addEventListener("click", () => {
  if (!mediaStream) {
    alert("Please open the camera first.");
    return;
  }

  captureCanvas.width = cameraFeed.videoWidth;
  captureCanvas.height = cameraFeed.videoHeight;
  const ctx = captureCanvas.getContext("2d");

  // Mirror the preview for the front camera so the capture matches what was framed
  if (facingMode === "user") {
    ctx.translate(captureCanvas.width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(cameraFeed, 0, 0);

  setPreview(captureCanvas.toDataURL("image/jpeg", 0.92));

  stopCamera();
  viewfinder.hidden = true;
  captureBtn.hidden = true;
  openCameraBtn.textContent = "Open camera";
});

// Mirror the live preview when using the front camera
cameraFeed.addEventListener("loadedmetadata", () => {
  cameraFeed.style.transform = facingMode === "user" ? "scaleX(-1)" : "none";
});

// ===============================
// Recognize
// ===============================
recognizeBtn.addEventListener("click", recognizeFlower);

async function recognizeFlower() {
  if (!hasImage()) {
    alert("Please upload or capture an image first.");
    return;
  }

  clearResult();
  setLoading(true);

  try {
    const response = await fetch(API_BASE + "/recognize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: selectedImage }),
    });

    const data = await response.json();
    setLoading(false);

    if (!response.ok || !data.success) {
      alert(data.error || "Recognition failed.");
      return;
    }

    // Result text
    flowerName.textContent = data.flowerName;
    flowerDescription.textContent = data.description;

    // Confidence stamp, if the backend provides one
    if (data.confidence !== undefined && data.confidence !== null) {
      confidenceValue.textContent =
        Math.round(Number(data.confidence)) + "%";
      confidenceBadge.style.visibility = "visible";
    }

    // Links
    imageLink.href = data.imageUrl;
    imageLink.classList.remove("is-disabled");
    audioLink.href = data.audioUrl;
    audioLink.classList.remove("is-disabled");

    // Audio player
    audioPlayer.src = data.audioUrl;
    audioPlayer.load();
    try {
      await audioPlayer.play();
    } catch (e) {
      console.log("Autoplay blocked by browser.");
    }

    console.log("Detected Labels:", data.labels);

    loadHistory();
  } catch (error) {
    setLoading(false);
    console.error(error);
    alert("Unable to connect to the server.");
  }
}

// ===============================
// Field notebook / history
// ===============================
async function loadHistory() {
  try {
    const response = await fetch(API_BASE + "/history");
    const data = await response.json();

    historyGrid.innerHTML = "";

    if (!data.success) {
      historyGrid.innerHTML = `<p class="notebook-empty">Unable to load history.</p>`;
      return;
    }

    if (!data.history || data.history.length === 0) {
      historyGrid.innerHTML = `<p class="notebook-empty">No specimens logged yet.</p>`;
      return;
    }

    data.history.forEach((item, index) => {
      const card = document.createElement("article");
      card.className = "notebook-card";
      card.style.setProperty("--tilt", `${(index % 2 === 0 ? -1 : 1) * (0.4 + (index % 3) * 0.3)}deg`);

      card.innerHTML = `
        <img src="${item.imageUrl}" alt="${item.flowerName}" loading="lazy">
        <h3>${item.flowerName}</h3>
        <p>${item.description}</p>
        <audio controls>
          <source src="${item.audioUrl}" type="audio/mpeg">
        </audio>
        <div class="notebook-card__links">
          <a href="${item.imageUrl}" target="_blank" rel="noopener">Image ↗</a>
          <a href="${item.audioUrl}" target="_blank" rel="noopener">Audio ↗</a>
        </div>
        <p class="notebook-card__time">${new Date(item.timestamp).toLocaleString()}</p>
      `;

      historyGrid.appendChild(card);
    });
  } catch (error) {
    console.error(error);
    historyGrid.innerHTML = `<p class="notebook-empty">Server connection failed.</p>`;
  }
}

refreshHistoryBtn.addEventListener("click", loadHistory);

// ===============================
// Init
// ===============================
window.addEventListener("load", () => {
  clearResult();
  loadHistory();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && hasImage() && document.activeElement !== fileInput) {
    recognizeFlower();
  }
});