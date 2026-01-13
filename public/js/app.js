const API_BASE = "http://localhost:3000/api";
let currentVideoId = null;
let pollInterval = null;

// DOM Elements
const dropZone = document.getElementById("dropZone");
const fileInput = document.getElementById("fileInput");
const processCard = document.getElementById("processCard");
const resultsSection = document.getElementById("resultsSection");
const videoNameEl = document.getElementById("videoName");
const statusBadge = document.getElementById("statusBadge");
const progressBar = document.getElementById("progressBar");
const errorContainer = document.getElementById("errorContainer");
const queueInfo = document.getElementById("queueInfo");
const queueText = document.getElementById("queueText");

// Steps
const steps = {
  upload: document.getElementById("stepUpload"),
  extract: document.getElementById("stepExtract"),
  transcribe: document.getElementById("stepTranscribe"),
  finalize: document.getElementById("stepFinalize"),
};

// --- Initialization ---
document.addEventListener("DOMContentLoaded", () => {
  fetchQueueStatus();
  setInterval(fetchQueueStatus, 10000); // Check queue every 10s
});

// --- Event Listeners ---

// Drag & Drop
dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropZone.classList.add("drag-active");
});

dropZone.addEventListener("dragleave", (e) => {
  e.preventDefault();
  dropZone.classList.remove("drag-active");
});

dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.classList.remove("drag-active");

  if (e.dataTransfer.files.length) {
    handleFile(e.dataTransfer.files[0]);
  }
});

// Click to Browse
dropZone.addEventListener("click", () => fileInput.click());

fileInput.addEventListener("change", (e) => {
  if (e.target.files.length) {
    handleFile(e.target.files[0]);
  }
});

// --- Core Logic ---

async function handleFile(file) {
  if (!file.type.startsWith("video/")) {
    showError("Please upload a valid video file.");
    return;
  }

  if (file.size > 2 * 1024 * 1024 * 1024) {
    // 2GB
    showError("File is too large. Max size is 2GB.");
    return;
  }

  // Reset UI
  showError(null);
  resultsSection.style.display = "none";
  processCard.style.display = "block";
  dropZone.style.display = "none";

  videoNameEl.textContent = file.name;
  updateUI("uploading", 0);

  // Upload
  try {
    const formData = new FormData();
    formData.append("video", file);

    activateStep("stepUpload");

    const response = await fetch(`${API_BASE}/upload`, {
      method: "POST",
      body: formData,
    });

    const data = await response.json();

    if (!data.success) throw new Error(data.error);

    currentVideoId = data.videoId;
    startPolling(currentVideoId);
  } catch (err) {
    showError(`Upload failed: ${err.message}`);
    resetUI(false);
  }
}

function startPolling(videoId) {
  if (pollInterval) clearInterval(pollInterval);

  pollInterval = setInterval(async () => {
    try {
      const response = await fetch(`${API_BASE}/status/${videoId}`);
      const data = await response.json();

      if (!data.success) {
        clearInterval(pollInterval);
        showError(data.error || "Unknown error during processing");
        return;
      }

      const status = data.video.status;
      const percentage = data.progress?.percentage || 0;

      updateUI(status, percentage);

      if (status === "completed") {
        clearInterval(pollInterval);
        showSuccess();
      } else if (status === "failed") {
        clearInterval(pollInterval);
        showError("Processing failed on the server.");
        statusBadge.textContent = "FAILED";
        statusBadge.className = "status-badge error";
      }
    } catch (err) {
      console.error("Polling error:", err);
    }
  }, 2000);
}

// --- UI Updates ---

function updateUI(status, percentage) {
  statusBadge.textContent = status.replace("_", " ").toUpperCase();
  progressBar.style.width = `${percentage}%`;

  // Step Highlighting
  if (status === "uploaded" || status === "queued") {
    activateStep("stepUpload");
    statusBadge.className = "status-badge active";
  } else if (status === "extracting_audio" || status === "splitting") {
    activateStep("stepExtract");
    statusBadge.className = "status-badge active";
  } else if (status === "transcribing") {
    activateStep("stepTranscribe");
    statusBadge.className = "status-badge active";
  } else if (status === "merging") {
    activateStep("stepFinalize");
  }
}

function activateStep(stepId) {
  Object.values(steps).forEach((el) => el.classList.remove("active"));

  // Add active to current and all previous steps logic if needed,
  // but for now just highlight current phase
  const stepEl = document.getElementById(stepId);
  if (stepEl) stepEl.classList.add("active");
}

function showSuccess() {
  processCard.style.display = "none";
  resultsSection.style.display = "block";
  statusBadge.className = "status-badge completed";
  statusBadge.textContent = "COMPLETED";
}

function showError(msg) {
  if (msg) {
    errorContainer.textContent = msg;
    errorContainer.style.display = "block";
  } else {
    errorContainer.style.display = "none";
  }
}

window.resetUI = function (fullRequest = true) {
  if (fullRequest) {
    currentVideoId = null;
    fileInput.value = "";
  }

  resultsSection.style.display = "none";
  processCard.style.display = "none";
  dropZone.style.display = "block";
  errorContainer.style.display = "none";
  progressBar.style.width = "0%";

  // Reset steps
  Object.values(steps).forEach((el) => el.classList.remove("active"));
};

window.downloadCaption = function (format) {
  if (!currentVideoId) return;
  window.location.href = `${API_BASE}/download/${currentVideoId}?format=${format}`;
};

async function fetchQueueStatus() {
  try {
    const response = await fetch(`${API_BASE}/queue`);
    const data = await response.json();

    if (data.success) {
      queueInfo.style.display = "inline-flex";
      const { activeProcesses, queueSize } = data.queue;

      if (activeProcesses > 0 || queueSize > 0) {
        queueText.textContent = `Processing: ${activeProcesses} | In Queue: ${queueSize}`;
      } else {
        queueText.textContent = "System Idle";
      }
    }
  } catch (e) {
    console.log("Queue fetch failed", e);
  }
}
