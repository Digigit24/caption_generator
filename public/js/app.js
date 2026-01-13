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

// Steps references updated as per new HTML
const steps = {
  upload: document.getElementById("stepUpload"),
  extract: document.getElementById("stepExtract"),
  chunks: document.getElementById("stepChunks"),
  transcribe: document.getElementById("stepTranscribe"),
  finalize: document.getElementById("stepFinalize"),
};

// --- Initialization ---
document.addEventListener("DOMContentLoaded", () => {
  fetchQueueStatus();
  setInterval(fetchQueueStatus, 10000); // Check queue every 10s
  initLanguageSelector(); // New Pill Logic
});

function initLanguageSelector() {
  const select = document.getElementById("languageSelect");
  if (!select) return;

  // Hide original select but keep it in DOM for value reading
  select.style.display = "none";
  const wrapper = select.closest(".select-wrapper") || select.parentElement;
  if (wrapper) {
    wrapper.querySelector(".select-icon")?.remove();
    wrapper.style.display = "block"; // Ensure container is visible
  }

  // Create Pill Container
  const pillContainer = document.createElement("div");
  pillContainer.className = "flex flex-wrap gap-2 mt-2";

  const options = [
    { value: "english", label: "English" },
    { value: "hindi", label: "Hindi (Roman)" },
    { value: "marathi", label: "Marathi" },
    { value: "hinglish", label: "Hinglish" },
  ];

  options.forEach((opt) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = opt.label;
    btn.className = `px-4 py-2 text-sm font-medium rounded-full border transition-all duration-200 
                         ${
                           select.value === opt.value
                             ? "bg-zinc-100 text-zinc-900 border-zinc-100 shadow-sm"
                             : "bg-zinc-900/50 text-zinc-400 border-zinc-800 hover:border-zinc-700 hover:text-zinc-200"
                         }`;

    btn.onclick = () => {
      // Update Select
      select.value = opt.value;
      // Update UI
      Array.from(pillContainer.children).forEach((c) => {
        c.className =
          "px-4 py-2 text-sm font-medium rounded-full border transition-all duration-200 bg-zinc-900/50 text-zinc-400 border-zinc-800 hover:border-zinc-700 hover:text-zinc-200";
      });
      btn.className =
        "px-4 py-2 text-sm font-medium rounded-full border transition-all duration-200 bg-zinc-100 text-zinc-900 border-zinc-100 shadow-sm";
    };

    pillContainer.appendChild(btn);
  });

  // Insert after the label
  const label = document.querySelector('label[for="languageSelect"]');
  if (label) {
    label.parentNode.insertBefore(pillContainer, select.nextSibling); // Insert after label or select
    // Actually insert after the wrapper div if possible, or append to the input-group.
    // In the new HTML 'input-group' contains label and wrapper.
    // wrapper contains select.
    // Let's replace the wrapper content with pills?
    // No, we need select index for formData.
    // Let's append pills to the .input-group
    const group = select.closest(".input-group");
    if (group) group.appendChild(pillContainer);
  }
}

// --- Event Listeners ---
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
  if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
});

dropZone.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", (e) => {
  if (e.target.files.length) handleFile(e.target.files[0]);
});

// --- Core Logic ---
function handleFile(file) {
  if (!file.type.startsWith("video/")) {
    showError("Please upload a valid video file.");
    return;
  }
  if (file.size > 2 * 1024 * 1024 * 1024) {
    showError("File is too large. Max size is 2GB.");
    return;
  }

  // Reset UI
  showError(null);
  resultsSection.style.display = "none";
  processCard.style.display = "block";

  const uploadCard = document.querySelector(".upload-card");
  if (uploadCard) uploadCard.style.display = "none";

  videoNameEl.textContent = file.name;

  // Set initial state
  activateStep("stepUpload");
  statusBadge.textContent = "UPLOADING...";
  statusBadge.className = "badge active";
  progressBar.style.width = "0%";

  uploadFile(file);
}

function uploadFile(file) {
  const xhr = new XMLHttpRequest();
  const formData = new FormData();
  formData.append("video", file);

  const language = document.getElementById("languageSelect").value;
  formData.append("language", language);

  xhr.open("POST", `${API_BASE}/upload`, true);

  // Track Upload Progress
  xhr.upload.onprogress = (e) => {
    if (e.lengthComputable) {
      const percentage = (e.loaded / e.total) * 100;
      progressBar.style.width = `${percentage}%`;
      statusBadge.textContent = `UPLOADING (${Math.round(percentage)}%)`;
    }
  };

  xhr.onload = () => {
    if (xhr.status === 200) {
      const data = JSON.parse(xhr.responseText);
      if (data.success) {
        currentVideoId = data.videoId;
        startPolling(currentVideoId);
      } else {
        showError(`Upload failed: ${data.error}`);
        resetUI(false);
      }
    } else {
      showError("Upload failed: Server error");
      resetUI(false);
    }
  };

  xhr.onerror = () => {
    showError("Upload failed: Network error");
    resetUI(false);
  };

  xhr.send(formData);
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
        statusBadge.className = "badge error";
      }
    } catch (err) {
      console.error("Polling error:", err);
    }
  }, 1000);
}

function updateUI(status, percentage) {
  statusBadge.textContent = status.replace("_", " ").toUpperCase();

  // Simulated progress logic when backend returns 0 or undefined for intermediate steps
  let displayPercentage = percentage;

  if (!displayPercentage || displayPercentage === 0) {
    if (status === "uploaded" || status === "queued") displayPercentage = 10;
    else if (status === "extracting_audio") displayPercentage = 25;
    else if (status === "splitting") displayPercentage = 40;
    else if (status === "transcribing") displayPercentage = 60;
    else if (status === "merging") displayPercentage = 90;
    else if (status === "completed") displayPercentage = 100;
  }

  if (status !== "uploaded" && status !== "queued") {
    progressBar.style.width = `${displayPercentage}%`;
  } else {
    // Even for queued, show minimal progress
    if (status === "queued") progressBar.style.width = "10%";
  }

  const stageMap = {
    uploaded: 1,
    queued: 1,
    extracting_audio: 2,
    splitting: 3,
    transcribing: 4,
    merging: 5,
    completed: 6,
  };

  const currentStage = stageMap[status] || 0;

  setStepState("stepUpload", currentStage >= 1 ? "completed" : "pending");
  setStepState(
    "stepExtract",
    currentStage === 2 ? "active" : currentStage > 2 ? "completed" : "pending"
  );
  setStepState(
    "stepChunks",
    currentStage === 3 ? "active" : currentStage > 3 ? "completed" : "pending"
  );
  setStepState(
    "stepTranscribe",
    currentStage === 4 ? "active" : currentStage > 4 ? "completed" : "pending"
  );
  setStepState(
    "stepFinalize",
    currentStage === 5 ? "active" : currentStage > 5 ? "completed" : "pending"
  );

  if (status === "failed") {
    statusBadge.className = "badge error";
  } else {
    statusBadge.className = "badge active";
  }
}

function setStepState(elementId, state) {
  const el = document.getElementById(elementId);
  if (!el) return;

  el.classList.remove("active", "completed");
  if (state === "active") el.classList.add("active");
  if (state === "completed") el.classList.add("completed");
}

function showSuccess(skipFetch = false) {
  processCard.style.display = "none";
  resultsSection.style.display = "block";
  statusBadge.className = "badge completed"; // Updated
  statusBadge.textContent = "COMPLETED";

  if (currentVideoId) {
    fetchTranscriptPreview(currentVideoId);
  }
}

window.resetUI = function (fullRequest = true) {
  if (pollInterval) clearInterval(pollInterval);

  if (fullRequest) {
    currentVideoId = null;
    fileInput.value = "";
  }

  document.getElementById("historySection").style.display = "none";

  // Show Upload Card
  const uploadCard = document.querySelector(".upload-card");
  if (uploadCard) uploadCard.style.display = "block";

  resultsSection.style.display = "none";
  processCard.style.display = "none";
  errorContainer.style.display = "none";
  progressBar.style.width = "0%";

  document
    .querySelectorAll(".step")
    .forEach((el) => el.classList.remove("active", "completed"));

  document.getElementById("transcriptionPreview").innerHTML =
    '<span style="color: var(--text-dim); font-style: italic;">Loading preview...</span>';
};

function setStepState(elementId, state) {
  const el = document.getElementById(elementId);
  if (!el) return;

  el.classList.remove("active", "completed");
  if (state === "active") el.classList.add("active");
  if (state === "completed") el.classList.add("completed");
}

function activateStep(stepId) {
  // Deprecated in favor of setStepState logic above
}

// --- New Features Logic ---

window.toggleHistory = function () {
  const historySection = document.getElementById("historySection");
  const mainContent = document.getElementById("mainContent");

  if (historySection.style.display === "none") {
    historySection.style.display = "block";
    mainContent.style.display = "none";
    fetchHistory(); // Load data
  } else {
    historySection.style.display = "none";
    mainContent.style.display = "block";
  }
};

async function fetchHistory() {
  try {
    const res = await fetch(`${API_BASE}/history`);
    const data = await res.json();
    if (data.success) {
      renderHistory(data.history);
    }
  } catch (e) {
    console.error("Failed to load history", e);
  }
}

function renderHistory(items) {
  const list = document.getElementById("historyList");
  list.innerHTML = "";

  if (items.length === 0) {
    list.innerHTML =
      '<div style="color: var(--text-dim); text-align: center;">No history found.</div>';
    return;
  }

  items.forEach((item) => {
    const div = document.createElement("div");
    div.style.cssText = `
            background: var(--surface);
            padding: 1rem;
            border-radius: var(--radius);
            border: 1px solid var(--border);
            display: flex;
            justify-content: space-between;
            align-items: center;
        `;

    const dateStr = new Date(
      item.completedAt || item.createdAt
    ).toLocaleString();

    div.innerHTML = `
            <div>
                <div style="font-weight: 600;">${item.filename}</div>
                <div style="font-size: 0.8rem; color: var(--text-dim);">${dateStr}</div>
            </div>
            <div style="display: flex; gap: 0.5rem;">
                <button class="btn" style="padding: 0.4rem;" onclick="loadHistoryItem('${item.videoId}')">📂 View</button>
                <button class="btn" style="padding: 0.4rem; background: var(--error); border-color: var(--error);" onclick="deleteHistoryItem('${item.videoId}')">🗑️</button>
            </div>
        `;
    list.appendChild(div);
  });
}

window.deleteHistoryItem = async function (videoId) {
  if (!confirm("Are you sure you want to delete this transcription?")) return;

  try {
    await fetch(`${API_BASE}/history/${videoId}`, { method: "DELETE" });
    fetchHistory(); // Refresh
  } catch (e) {
    alert("Failed to delete");
  }
};

window.loadHistoryItem = function (videoId) {
  // Switch to view mode for this ID
  currentVideoId = videoId;
  window.toggleHistory(); // Close history view

  // Simulate Success State
  processCard.style.display = "none";
  dropZone.style.display = "none";
  resultsSection.style.display = "block";

  showSuccess(true); // true = skip polling, just show results
};

// --- Modal Logic ---
window.cancelProcess = function () {
  document.getElementById("confirmModal").style.display = "flex";
};

window.closeConfirmModal = function () {
  document.getElementById("confirmModal").style.display = "none";
};

window.confirmCancelProcess = function () {
  closeConfirmModal();
  if (pollInterval) clearInterval(pollInterval);
  // Optional: send cancel request to backend
  resetUI();
};

async function fetchTranscriptPreview(videoId) {
  try {
    const previewEl = document.getElementById("transcriptionPreview");
    previewEl.innerHTML =
      '<div class="flex items-center justify-center h-full text-zinc-500 italic">Loading transcript...</div>';

    const res = await fetch(`${API_BASE}/transcript/${videoId}`);
    const data = await res.json();

    if (data.success && Array.isArray(data.transcript)) {
      previewEl.innerHTML = ""; // Clear loader

      const listContainer = document.createElement("div");
      listContainer.className = "flex flex-col gap-0"; // Tailwind classes

      data.transcript.forEach((segment) => {
        const row = document.createElement("div");
        row.className =
          "flex flex-col sm:flex-row gap-2 sm:gap-4 p-4 border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors group";

        const time = document.createElement("div");
        time.className =
          "text-violet-400 font-mono text-xs sm:text-sm whitespace-nowrap pt-1 select-none opacity-70 group-hover:opacity-100 transition-opacity";
        time.textContent = segment.start;

        const text = document.createElement("div");
        text.className =
          "text-zinc-200 text-sm sm:text-base font-medium leading-relaxed";
        text.textContent = segment.text;

        row.appendChild(time);
        row.appendChild(text);
        listContainer.appendChild(row);
      });

      previewEl.appendChild(listContainer);
    } else {
      previewEl.innerHTML =
        '<div class="text-error p-4 text-center">Failed to load preview format.</div>';
    }
  } catch (e) {
    console.error("Preview error", e);
    document.getElementById("transcriptionPreview").innerHTML =
      '<div class="text-error p-4 text-center">Error loading transcript.</div>';
  }
}

function showSuccess(skipFetch = false) {
  processCard.style.display = "none";
  resultsSection.style.display = "block";
  // statusBadge logic moved to timeline only?
  // statusBadge is in processCard, so it hides with it.
  // But we might want to keep statusBadge visible elsewhere?
  // No, Results section has its own "Captions Ready" header.

  if (currentVideoId) {
    fetchTranscriptPreview(currentVideoId);
  }
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
  if (pollInterval) clearInterval(pollInterval);

  if (fullRequest) {
    currentVideoId = null;
    fileInput.value = "";
  }

  // Hide History Section if open
  document.getElementById("historySection").style.display = "none";
  document.getElementById("mainContent").style.display = "block";

  resultsSection.style.display = "none";
  processCard.style.display = "none";
  dropZone.style.display = "block";
  errorContainer.style.display = "none";
  progressBar.style.width = "0%";

  // Clear styles
  document
    .querySelectorAll(".step-item")
    .forEach((el) => el.classList.remove("active", "completed"));

  document.getElementById("transcriptionPreview").innerHTML =
    '<span style="color: var(--text-dim); font-style: italic;">Loading preview...</span>';
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
