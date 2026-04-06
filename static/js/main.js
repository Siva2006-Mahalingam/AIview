async function api(url, options = {}) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    credentials: "same-origin",
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

function byId(id) {
  return document.getElementById(id);
}

async function requestDocumentFullscreen() {
  const root = document.documentElement;
  const requestFullscreen =
    root.requestFullscreen ||
    root.webkitRequestFullscreen ||
    root.msRequestFullscreen;
  if (!requestFullscreen) return false;
  try {
    const result = requestFullscreen.call(root);
    if (result && typeof result.then === "function") {
      await result;
    }
    return true;
  } catch (err) {
    console.warn("Unable to enter fullscreen mode.", err);
    return false;
  }
}

async function exitDocumentFullscreen() {
  const exitFullscreen =
    document.exitFullscreen ||
    document.webkitExitFullscreen ||
    document.msExitFullscreen;
  if (!exitFullscreen) return false;
  try {
    const result = exitFullscreen.call(document);
    if (result && typeof result.then === "function") {
      await result;
    }
    return true;
  } catch (err) {
    console.warn("Unable to exit fullscreen mode.", err);
    return false;
  }
}

function readJSONStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function getInterviewQAStorageKey(sessionId) {
  return `interviewQA:${sessionId}`;
}

function getTabSwitchStorageKey(sessionId) {
  return `interviewTabSwitches:${sessionId}`;
}

function normalizeQuestionKey(value) {
  return String(value || "").trim().toLowerCase();
}

function getStoredInterviewQA(sessionId) {
  return readJSONStorage(getInterviewQAStorageKey(sessionId), []);
}

function appendStoredInterviewQA(sessionId, qaPair) {
  const existing = getStoredInterviewQA(sessionId);
  existing.push(qaPair);
  localStorage.setItem(getInterviewQAStorageKey(sessionId), JSON.stringify(existing));
}

function getStoredTabSwitchCount(sessionId) {
  return Number(localStorage.getItem(getTabSwitchStorageKey(sessionId)) || "0");
}

function incrementStoredTabSwitchCount(sessionId) {
  const next = getStoredTabSwitchCount(sessionId) + 1;
  localStorage.setItem(getTabSwitchStorageKey(sessionId), String(next));
  return next;
}

function setupAuthPage() {
  const form = byId("auth-form");
  if (!form) return;
  let mode = "signin";
  const toggleBtn = byId("toggle-auth-mode");
  const title = byId("auth-title");
  const subtitle = byId("auth-subtitle");
  const submit = byId("auth-submit");
  const signupEls = document.querySelectorAll(".signup-only");

  const render = () => {
    const signup = mode === "signup";
    signupEls.forEach((el) => el.classList.toggle("hidden", !signup));
    title.textContent = signup ? "Create Account" : "Welcome Back";
    subtitle.textContent = signup ? "Start your journey to interview success" : "Sign in to continue your interview practice";
    submit.textContent = signup ? "Create Account" : "Sign In";
    toggleBtn.textContent = signup ? "Already have an account? Sign In" : "Don't have an account? Sign Up";
  };

  toggleBtn.addEventListener("click", () => {
    mode = mode === "signup" ? "signin" : "signup";
    render();
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const payload = Object.fromEntries(fd.entries());
    try {
      if (mode === "signup") {
        await api("/api/auth/signup/", { method: "POST", body: JSON.stringify(payload) });
      } else {
        await api("/api/auth/login/", { method: "POST", body: JSON.stringify(payload) });
      }
      window.location.href = "/dashboard/";
    } catch (err) {
      alert(err.message);
    }
  });
  render();
}

function setupDashboardPage() {
  const logoutBtn = byId("logout-btn");
  if (!logoutBtn) return;
  const finishFlag = localStorage.getItem("interviewFinishedRedirect");
  if (finishFlag === "1") {
    const banner = byId("post-finish-banner");
    if (banner) banner.classList.remove("hidden");
    localStorage.removeItem("interviewFinishedRedirect");
  }
  logoutBtn.addEventListener("click", async () => {
    await api("/api/auth/logout/", { method: "POST" });
    window.location.href = "/";
  });
  api("/api/sessions/")
    .then((data) => {
      const wrap = byId("recent-sessions");
      wrap.innerHTML = "";
      data.sessions.slice(0, 5).forEach((s) => {
        const el = document.createElement("a");
        el.className = "card";
        el.href = `/results/${s.id}/`;
        el.innerHTML = `<strong>${s.interview_type}</strong> - ${s.role} <div>${s.status}</div>`;
        wrap.appendChild(el);
      });
    })
    .catch(() => {});
}

function setupInterviewSetupPage() {
  const form = byId("setup-form");
  if (!form) return;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    sessionStorage.setItem("startInterviewFullscreen", "1");
    await requestDocumentFullscreen();
    const fd = new FormData(form);
    let resumeId = null;
    const file = fd.get("file");
    if (file && file.size > 0) {
      const upload = new FormData();
      upload.append("file", file);
      const res = await fetch("/api/resumes/", { method: "POST", body: upload, credentials: "same-origin" });
      const data = await res.json();
      if (!res.ok) return alert(data.error || "Resume upload failed");
      resumeId = data.resume.id;
    }
    const payload = {
      interview_type: fd.get("interview_type"),
      role: fd.get("role"),
      resume_id: resumeId,
    };
    const data = await api("/api/sessions/", { method: "POST", body: JSON.stringify(payload) });
    window.location.href = `/interview/${data.session.id}/`;
  });
}

function addChatMessage(kind, text) {
  const log = byId("chat-log");
  const el = document.createElement("div");
  el.className = `chat-msg ${kind}`;
  el.textContent = text;
  log.appendChild(el);
  log.scrollTop = log.scrollHeight;
}

async function setupInterviewPage() {
  const page = document.querySelector('[data-page="interview"]');
  if (!page) return;
  const sessionId = page.getAttribute("data-session-id");
  const isCompletedSession = () => localStorage.getItem("completedInterviewSessionId") === String(sessionId);
  if (isCompletedSession()) {
    window.location.replace("/dashboard/");
    return;
  }
  let isInterviewActive = true;
  let historyGuardTimer = null;
  const interviewUrl = window.location.href;

  const pushInterviewHistoryState = () => {
    history.pushState({ interviewGuard: true }, "", window.location.href);
  };

  const handleInterviewPopState = () => {
    if (!isInterviewActive) return;
    pushInterviewHistoryState();
    if (window.location.href !== interviewUrl) {
      window.location.replace(interviewUrl);
    }
  };

  history.replaceState({ interviewRoot: true }, "", window.location.href);
  pushInterviewHistoryState();
  window.addEventListener("popstate", handleInterviewPopState);
  window.addEventListener("pageshow", (event) => {
    if (!event.persisted || !isInterviewActive) return;
    pushInterviewHistoryState();
  });

  const ensureFullscreenOnInteraction = () => {
    const onInteract = async () => {
      await requestDocumentFullscreen();
      if (document.fullscreenElement) {
        window.removeEventListener("pointerdown", onInteract);
        window.removeEventListener("keydown", onInteract);
        window.removeEventListener("touchstart", onInteract);
      }
    };
    window.addEventListener("pointerdown", onInteract);
    window.addEventListener("keydown", onInteract);
    window.addEventListener("touchstart", onInteract);
  };

  if (sessionStorage.getItem("startInterviewFullscreen") === "1") {
    sessionStorage.removeItem("startInterviewFullscreen");
  }
  const enteredFullscreen = await requestDocumentFullscreen();
  if (!enteredFullscreen || !document.fullscreenElement) {
    ensureFullscreenOnInteraction();
  }
  historyGuardTimer = window.setInterval(() => {
    if (!isInterviewActive) return;
    pushInterviewHistoryState();
  }, 800);

  const form = byId("chat-form");
  const input = byId("chat-input");
  const finish = byId("finish-interview");
  const preview = byId("local-preview");
  const mediaStatus = byId("media-status");
  const voiceStatus = byId("voice-status");
  const messages = [];
  let stream = null;
  let mediaRecorder = null;
  let recordedChunks = [];
  let currentQuestionNumber = 1;
  const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
  const supportsSpeechRecognition = typeof SpeechRecognitionCtor !== "undefined";
  const supportsSpeechSynthesis = typeof window.speechSynthesis !== "undefined" && typeof window.SpeechSynthesisUtterance !== "undefined";
  let recognition = null;
  let speechTimeoutId = null;
  let recognitionShouldRestart = false;
  let recognitionStopRequested = false;
  let isListening = false;
  let isSpeakingQuestion = false;
  let finalizedTranscript = "";
  let isInterviewEnding = false;
  let isSubmittingAnswer = false;
  let speakingRetryAttempted = false;
  let silenceTimeoutId = null;

  function updateVoiceStatus(text) {
    if (voiceStatus) voiceStatus.textContent = text;
  }

  function clearSpeechTimeout() {
    if (!speechTimeoutId) return;
    window.clearTimeout(speechTimeoutId);
    speechTimeoutId = null;
  }

  function clearSilenceTimeout() {
    if (!silenceTimeoutId) return;
    window.clearTimeout(silenceTimeoutId);
    silenceTimeoutId = null;
  }

  function stopVoiceRecognition({ manual = false, allowRestart = false } = {}) {
    recognitionShouldRestart = allowRestart;
    recognitionStopRequested = manual;
    clearSpeechTimeout();
    if (!recognition) return;
    if (isListening) {
      try {
        recognition.stop();
      } catch (err) {
        console.warn("SpeechRecognition stop failed", err);
      }
    }
  }

  function startVoiceRecognition({ auto = false } = {}) {
    if (!supportsSpeechRecognition || !isInterviewActive || isInterviewEnding || isSpeakingQuestion) return;
    if (!recognition) {
      recognition = new SpeechRecognitionCtor();
      recognition.lang = "en-US";
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      recognition.onstart = () => {
        isListening = true;
        updateVoiceStatus("Listening...");
      };
      recognition.onresult = (event) => {
        let interimText = "";
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const transcript = event.results[i][0]?.transcript || "";
          if (event.results[i].isFinal) {
            finalizedTranscript = `${finalizedTranscript} ${transcript}`.trim();
          } else {
            interimText += transcript;
          }
        }
        const merged = `${finalizedTranscript} ${interimText}`.trim();
        if (merged) input.value = merged;
        updateVoiceStatus(interimText ? "Listening... transcribing" : "Listening...");
      };
      recognition.onerror = (event) => {
        const code = event?.error || "unknown_error";
        if (code === "not-allowed" || code === "service-not-allowed") {
          recognitionShouldRestart = false;
          recognitionStopRequested = true;
          updateVoiceStatus("Microphone permission denied.");
        } else if (code === "no-speech") {
          updateVoiceStatus("No speech detected. Listening will retry...");
        } else {
          updateVoiceStatus(`Voice recognition error: ${code}`);
        }
      };
      recognition.onend = () => {
        isListening = false;
        clearSpeechTimeout();
        clearSilenceTimeout();
        if (recognitionShouldRestart && !recognitionStopRequested && isInterviewActive && !isInterviewEnding) {
          window.setTimeout(() => {
            startVoiceRecognition({ auto: true });
          }, 250);
          return;
        }
        if (!input.value.trim()) {
          updateVoiceStatus("Waiting for response...");
        } else {
          updateVoiceStatus("Transcription ready.");
        }
      };
    }
    recognitionStopRequested = false;
    recognitionShouldRestart = true;
    clearSpeechTimeout();
    speechTimeoutId = window.setTimeout(() => {
      clearSpeechTimeout();
    }, 45000);
    if (!auto) updateVoiceStatus("Starting microphone...");
    try {
      recognition.start();
    } catch (err) {
      updateVoiceStatus("Unable to start voice recognition.");
      console.warn("SpeechRecognition start failed", err);
    }
  }

  async function speakQuestionAndListen(questionText) {
    if (!isInterviewActive || isInterviewEnding) return;
    stopVoiceRecognition({ manual: true, allowRestart: false });
    finalizedTranscript = "";
    input.value = "";
    if (!supportsSpeechSynthesis) {
      if (supportsSpeechRecognition) {
        updateVoiceStatus("Question shown. Listening...");
        startVoiceRecognition({ auto: true });
      } else {
        updateVoiceStatus("Voice features unavailable in this browser.");
      }
      return;
    }
    window.speechSynthesis.cancel();
    updateVoiceStatus("Speaking question...");
    isSpeakingQuestion = true;
    const spoken = await new Promise((resolve) => {
      const utterance = new SpeechSynthesisUtterance(questionText);
      utterance.rate = 0.98;
      utterance.pitch = 1;
      utterance.volume = 1;
      utterance.onend = () => resolve(true);
      utterance.onerror = () => resolve(false);
      window.speechSynthesis.speak(utterance);
    });
    if (!spoken && !speakingRetryAttempted) {
      speakingRetryAttempted = true;
      isSpeakingQuestion = false;
      return speakQuestionAndListen(questionText);
    }
    speakingRetryAttempted = false;
    isSpeakingQuestion = false;
    if (supportsSpeechRecognition) {
      updateVoiceStatus("Listening...");
      startVoiceRecognition({ auto: true });
    } else {
      updateVoiceStatus("Question spoken. This browser does not support voice input.");
    }
  }

  if (!supportsSpeechRecognition && !supportsSpeechSynthesis) {
    updateVoiceStatus("Voice features unavailable in this browser.");
  } else if (!supportsSpeechRecognition) {
    updateVoiceStatus("Question voice enabled. Voice input unavailable.");
  } else if (!supportsSpeechSynthesis) {
    updateVoiceStatus("Voice input enabled. Question voice unavailable.");
  } else {
    updateVoiceStatus("Voice ready.");
  }

  const handleVisibilityChange = () => {
    if (!isInterviewActive || !document.hidden) return;
    const tabSwitchCount = incrementStoredTabSwitchCount(sessionId);
    if (mediaStatus) {
      mediaStatus.textContent = `Warning: tab switch detected (${tabSwitchCount}). Please stay on the interview tab.`;
    }
  };
  document.addEventListener("visibilitychange", handleVisibilityChange);

  async function enableMedia() {
    if (!window.isSecureContext && location.hostname !== "localhost" && location.hostname !== "127.0.0.1") {
      mediaStatus.textContent = "Camera/mic require HTTPS or localhost.";
      return;
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      mediaStatus.textContent = "Media devices API not supported in this browser.";
      return;
    }
    try {
      mediaStatus.textContent = "Requesting camera/mic permission...";
      stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      preview.srcObject = stream;
      mediaStatus.textContent = "Camera and microphone enabled.";
      await preview.play().catch(() => {});
    } catch (err) {
      const reason = err?.name ? `${err.name}: ${err.message}` : (err?.message || String(err));
      mediaStatus.textContent = `Permission denied or unavailable: ${reason}`;
      updateVoiceStatus("Microphone/camera permission denied.");
    }
  }

  function startRecording() {
    if (!stream) return;
    if (typeof MediaRecorder === "undefined") {
      mediaStatus.textContent = "MediaRecorder not supported in this browser.";
      return;
    }
    recordedChunks = [];
    const preferredTypes = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
    const mimeType = preferredTypes.find((t) => MediaRecorder.isTypeSupported(t));
    mediaRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) recordedChunks.push(event.data);
    };
    mediaRecorder.start(1000);
    mediaStatus.textContent = "Recording in progress...";
  }

  async function stopAndUploadRecording(questionNumber) {
    if (!mediaRecorder || mediaRecorder.state === "inactive") return;
    await new Promise((resolve) => {
      mediaRecorder.onstop = resolve;
      mediaRecorder.stop();
    });
    const blob = new Blob(recordedChunks, { type: "video/webm" });
    if (blob.size === 0) return;
    const fd = new FormData();
    fd.append("session_id", String(sessionId));
    fd.append("question_number", String(questionNumber));
    fd.append("video", blob, `q${questionNumber}-${Date.now()}.webm`);
    const res = await fetch("/api/media/upload-answer-video/", {
      method: "POST",
      body: fd,
      credentials: "same-origin",
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.warn("Video upload failed", err.error || res.statusText);
    }
  }

  await enableMedia();

  const initial = await api("/api/ai/interview-chat/", {
    method: "POST",
    body: JSON.stringify({ session_id: Number(sessionId), messages: [{ role: "user", content: "Start the interview." }] }),
  });
  addChatMessage("ai", initial.reply);
  messages.push({ role: "assistant", content: initial.reply });
  await speakQuestionAndListen(initial.reply);
  startRecording();

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (isSubmittingAnswer) return;
    isSubmittingAnswer = true;
    try {
      stopVoiceRecognition({ manual: true, allowRestart: false });
      const text = input.value.trim();
      if (!text) return;
      addChatMessage("user", text);
      input.value = "";
      const qNo = Math.floor(messages.length / 2) + 1;
      currentQuestionNumber = qNo;
      const currentQuestionText = messages[messages.length - 1]?.content || "Interview Question";
      await api("/api/questions/", {
        method: "POST",
        body: JSON.stringify({ session_id: Number(sessionId), question_number: qNo, question: currentQuestionText, answer: text }),
      });
      appendStoredInterviewQA(sessionId, {
        question_number: qNo,
        question: currentQuestionText,
        answer: text,
      });
      await stopAndUploadRecording(qNo);
      messages.push({ role: "user", content: text });
      const data = await api("/api/ai/interview-chat/", {
        method: "POST",
        body: JSON.stringify({ session_id: Number(sessionId), messages }),
      });
      addChatMessage("ai", data.reply);
      messages.push({ role: "assistant", content: data.reply });
      await speakQuestionAndListen(data.reply);
      startRecording();
    } finally {
      isSubmittingAnswer = false;
    }
  });

  finish.addEventListener("click", async () => {
    isInterviewEnding = true;
    stopVoiceRecognition({ manual: true, allowRestart: false });
    clearSilenceTimeout();
    if (supportsSpeechSynthesis) window.speechSynthesis.cancel();
    try {
      await stopAndUploadRecording(currentQuestionNumber);
    } catch (err) {
      console.warn("Final video upload failed", err);
    }
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      mediaStatus.textContent = "Camera and microphone stopped.";
    }
    try {
      await api(`/api/sessions/${Number(sessionId)}/`, {
        method: "PUT",
        body: JSON.stringify({ status: "completed", end_now: true }),
      });
    } catch (err) {
      console.warn("Session finalize failed", err);
    }
    isInterviewActive = false;
    window.removeEventListener("popstate", handleInterviewPopState);
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    if (historyGuardTimer) {
      window.clearInterval(historyGuardTimer);
      historyGuardTimer = null;
    }
    localStorage.setItem("completedInterviewSessionId", String(sessionId));
    await exitDocumentFullscreen();
    localStorage.setItem("interviewFinishedRedirect", "1");
    window.location.replace("/dashboard/");
  });
}

function setupResultsPage() {
  const page = document.querySelector('[data-page="results"]');
  if (!page) return;
  const sessionId = Number(page.getAttribute("data-session-id"));
  const wrap = byId("results-card");
  api("/api/ai/generate-feedback/", { method: "POST", body: JSON.stringify({ session_id: sessionId }) })
    .then((data) => {
      const fb = data.feedback;
      wrap.innerHTML = `
        <h2>Performance: ${fb.performancePercentage}%</h2>
        <p><strong>ATS:</strong> ${fb.atsScore === null ? "Resume required" : fb.atsScore}</p>
        <p><strong>Overall:</strong> ${fb.overallFeedback}</p>
        <p><strong>Improvements:</strong> ${fb.improvements}</p>
        <a class="btn btn-primary" href="/dashboard/">Back to Dashboard</a>
      `;
    })
    .catch((err) => {
      wrap.textContent = err.message;
    });
}

function setupHistoryPage() {
  const wrap = byId("history-list");
  if (!wrap) return;
  api("/api/sessions/").then((data) => {
    wrap.innerHTML = "";
    data.sessions.forEach((s) => {
      const el = document.createElement("div");
      el.className = "card";
      const started = new Date(s.started_at).toLocaleString();
      const videoHtml = s.latest_video_url
        ? `<video controls preload="metadata" style="width:100%;margin-top:10px;border-radius:10px;" src="${s.latest_video_url}"></video>`
        : `<div style="margin-top:8px;color:#64748b;">No recorded answer video found.</div>`;
      el.innerHTML = `
        <a href="/results/${s.id}/" style="text-decoration:none;color:inherit;display:block;">
          <strong>${s.interview_type}</strong> - ${s.role}
          <div>${started}</div>
          <div style="margin-top:4px;color:#64748b;">Questions: ${s.question_count ?? 0} | Status: ${s.status}</div>
        </a>
        ${videoHtml}
        <details style="margin-top:10px;">
          <summary style="cursor:pointer;">View question-wise progress</summary>
          <div id="session-details-${s.id}" style="margin-top:8px;color:#334155;">Loading...</div>
        </details>
      `;
      wrap.appendChild(el);

      api(`/api/sessions/${s.id}/`)
        .then((detail) => {
          const target = byId(`session-details-${s.id}`);
          if (!target) return;
          const questions = detail.questions || [];
          const storedQAPairs = getStoredInterviewQA(s.id);
          const storedByQuestionNumber = new Map(
            storedQAPairs
              .filter((qa) => Number.isFinite(Number(qa.question_number)))
              .map((qa) => [Number(qa.question_number), qa])
          );
          const storedByQuestionText = new Map(
            storedQAPairs
              .filter((qa) => normalizeQuestionKey(qa.question))
              .map((qa) => [normalizeQuestionKey(qa.question), qa])
          );
          const tabSwitchCount = getStoredTabSwitchCount(s.id);
          if (!questions.length) {
            target.innerHTML = "No recorded questions.";
            return;
          }
          target.innerHTML = questions
            .map((q) => {
              const byNumber = storedByQuestionNumber.get(Number(q.question_number));
              const byText = storedByQuestionText.get(normalizeQuestionKey(q.question));
              const matchedQA = byNumber || byText;
              const answerText = q.answer || matchedQA?.answer || "Answer not available.";
              const video = q.video_url
                ? `<video controls preload="metadata" style="width:100%;margin-top:6px;border-radius:8px;" src="${q.video_url}"></video>`
                : `<div style="color:#64748b;margin-top:6px;">No video for this answer.</div>`;
              return `
                <div style="border:1px solid #e5e7eb;border-radius:10px;padding:10px;margin-bottom:8px;">
                  <div><strong>Q${q.question_number}</strong> - Score: ${q.score ?? "-"}</div>
                  <div style="margin-top:4px;">${q.question || ""}</div>
                  <div style="margin-top:6px;"><strong>Answer:</strong> ${answerText}</div>
                  ${video}
                </div>
              `;
            })
            .join("");
          if (tabSwitchCount > 0) {
            target.innerHTML = `<div style="margin-bottom:8px;color:#b45309;"><strong>Tab switches detected:</strong> ${tabSwitchCount}</div>${target.innerHTML}`;
          }
        })
        .catch(() => {
          const target = byId(`session-details-${s.id}`);
          if (target) target.innerHTML = "Failed to load question details.";
        });
    });
  });
}

function setupProfilePage() {
  const form = byId("profile-form");
  if (!form) return;
  api("/api/profile/").then((data) => {
    Object.entries(data.profile).forEach(([k, v]) => {
      const input = form.querySelector(`[name="${k}"]`);
      if (input) input.value = v || "";
    });
  });
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(form).entries());
    await api("/api/profile/", { method: "PUT", body: JSON.stringify(payload) });
    alert("Profile saved");
  });
}

function setupAnalyticsPage() {
  const wrap = byId("analytics-summary");
  if (!wrap) return;
  api("/api/analytics/").then((data) => {
    wrap.innerHTML = `
      <div class="card"><h3>${data.summary.avg_performance}%</h3><p>Avg Performance</p></div>
      <div class="card"><h3>${data.summary.avg_ats}%</h3><p>Avg ATS</p></div>
      <div class="card"><h3>${data.summary.total}</h3><p>Total Interviews</p></div>
    `;
  });
}

function setupLeaderboardPage() {
  const wrap = byId("leaderboard-list");
  if (!wrap) return;
  api("/api/leaderboard/?timeframe=month").then((data) => {
    wrap.innerHTML = "";
    data.leaderboard.forEach((row) => {
      const el = document.createElement("div");
      el.className = "card";
      el.innerHTML = `<strong>#${row.rank} ${row.displayName}</strong><div>${row.avgScore}% (${row.totalInterviews} interviews)</div>`;
      wrap.appendChild(el);
    });
  });
}

function setupAdminPage() {
  const wrap = byId("admin-overview");
  if (!wrap) return;
  api("/api/admin/overview/")
    .then((data) => {
      wrap.innerHTML = `<p>Total Users: ${data.stats.totalUsers}</p><p>Total Sessions: ${data.stats.totalSessions}</p><p>Avg Score: ${data.stats.avgScore}%</p>`;
    })
    .catch((err) => {
      wrap.textContent = err.message;
    });
}

document.addEventListener("DOMContentLoaded", () => {
  setupAuthPage();
  setupDashboardPage();
  setupInterviewSetupPage();
  setupInterviewPage();
  setupResultsPage();
  setupHistoryPage();
  setupProfilePage();
  setupAnalyticsPage();
  setupLeaderboardPage();
  setupAdminPage();
});
