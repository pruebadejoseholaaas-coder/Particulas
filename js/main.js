import { ParticleEngine } from "./particles.js";
import { HandGestureController } from "./gestures.js";

const $ = (id) => document.getElementById(id);

const ui = {
  scene: $("scene"),
  statusDot: $("statusDot"),
  topStatus: $("topStatus"),
  particleMetric: $("particleMetric"),
  fpsMetric: $("fpsMetric"),
  controlPanel: $("controlPanel"),
  panelToggle: $("panelToggle"),
  fullscreen: $("fullscreen"),
  shapeSelect: $("shapeSelect"),
  randomShape: $("randomShape"),
  resetView: $("resetView"),
  particleCount: $("particleCount"),
  particleSize: $("particleSize"),
  speed: $("speed"),
  energy: $("energy"),
  colorPicker: $("colorPicker"),
  gestureStatus: $("gestureStatus"),
  gestureTitle: $("gestureTitle"),
  gestureDescription: $("gestureDescription"),
  cameraPreview: $("cameraPreview"),
  cameraButton: $("cameraButton"),
  attractButton: $("attractButton"),
  explodeButton: $("explodeButton"),
  pauseButton: $("pauseButton"),
  toast: $("toast")
};

let engine;
let handController;
let toastTimeout;
let paused = false;
let cameraActive = false;
let manualAttraction = false;
let manualExplosion = false;
let lastGestureText = "";

function showToast(message) {
  if (!ui.toast) return;

  ui.toast.textContent = message;
  ui.toast.classList.add("visible");

  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    ui.toast.classList.remove("visible");
  }, 2400);
}

function setStatus(message, online = true) {
  if (ui.topStatus) ui.topStatus.textContent = message;

  if (ui.statusDot) {
    ui.statusDot.classList.toggle("offline", !online);
  }
}

function updateGestureDisplay(title, description) {
  if (ui.gestureTitle) ui.gestureTitle.textContent = title;
  if (ui.gestureDescription) {
    ui.gestureDescription.textContent = description;
  }
}

function updateMetrics() {
  if (!engine) return;

  if (ui.particleMetric) {
    ui.particleMetric.textContent = engine.count.toLocaleString("es-DO");
  }

  if (ui.fpsMetric) {
    ui.fpsMetric.textContent = String(engine.fps);
  }
}

function updateGesture(gesture) {
  if (!engine) return;

  engine.setAttraction(
    gesture.attraction || (manualAttraction
      ? { x: 0, y: 0, z: 0 }
      : null)
  );

  engine.setExplosion(
    manualExplosion ? 1 : gesture.explosion || 0
  );

  if (!cameraActive) return;

  if (!gesture.detected) {
    updateGestureDisplay(
      "Buscando tus manos",
      "Coloca una o ambas manos frente a la cámara."
    );
    return;
  }

  let title = "Manos detectadas";
  let description = "Mueve las manos para interactuar con las partículas.";

  if (gesture.twoHands) {
    title = "Dos manos detectadas";
    description = "Separa las manos para expandir las partículas.";
  } else if (gesture.pinch) {
    title = "Pinza detectada";
    description = "Junta el pulgar y el índice para atraer las partículas.";
  } else if (gesture.openHand) {
    title = "Mano abierta";
    description = "Abre la mano y muévela frente a la cámara.";
  } else if (gesture.closedHand) {
    title = "Mano cerrada";
    description = "Prueba a abrir la mano o juntar dos dedos.";
  }

  const currentText = `${title}|${description}`;

  if (currentText !== lastGestureText) {
    lastGestureText = currentText;
    updateGestureDisplay(title, description);
  }
}

function randomizeShape() {
  if (!ui.shapeSelect || !engine) return;

  const shapes = Array.from(ui.shapeSelect.options)
    .map(option => option.value)
    .filter(Boolean);

  if (!shapes.length) return;

  const alternatives = shapes.filter(
    shape => shape !== ui.shapeSelect.value
  );

  const choices = alternatives.length ? alternatives : shapes;
  const shape = choices[Math.floor(Math.random() * choices.length)];

  ui.shapeSelect.value = shape;
  engine.setShape(shape);
  showToast("Nueva forma: " + shape);
}

function resetView() {
  if (!engine) return;

  engine.group.rotation.set(0, 0, 0);
  engine.camera.position.set(0, 0, 17);
  engine.camera.lookAt(0, 0, 0);
  engine.setAttraction(null);
  engine.setExplosion(0);
  engine.setPointer(0, 0, false);

  manualAttraction = false;
  manualExplosion = false;

  ui.attractButton?.classList.remove("active");
  ui.explodeButton?.classList.remove("active");

  showToast("Vista restablecida");
}

function setupControls() {
  ui.shapeSelect?.addEventListener("change", () => {
    engine.setShape(ui.shapeSelect.value);
    showToast("Forma: " + ui.shapeSelect.value);
  });

  ui.randomShape?.addEventListener("click", randomizeShape);

  ui.resetView?.addEventListener("click", resetView);

  ui.particleCount?.addEventListener("input", () => {
    const count = Number(ui.particleCount.value);

    if (Number.isFinite(count) && count >= 100) {
      engine.setCount(Math.min(count, 20000));
      updateMetrics();
    }
  });

  ui.particleSize?.addEventListener("input", () => {
    const value = Number(ui.particleSize.value);
    engine.setSize(0.035 * value / 100);
    const label = document.getElementById("sizeValue");
    if (label) label.textContent = value + "%";
  });

  ui.speed?.addEventListener("input", () => {
    const value = Number(ui.speed.value);
    engine.setSpeed(value / 50);
    const label = document.getElementById("speedValue");
    if (label) label.textContent = value + "%";
  });

  ui.energy?.addEventListener("input", () => {
    const value = Number(ui.energy.value);
    engine.setEnergy(value / 60);
    const label = document.getElementById("energyValue");
    if (label) label.textContent = value + "%";
  });

  ui.colorPicker?.addEventListener("input", () => {
    engine.setColor(ui.colorPicker.value);
  });

  document.querySelectorAll(".swatch[data-color]").forEach(button => {
    button.addEventListener("click", () => {
      const color = button.dataset.color;

      if (!color) return;

      engine.setColor(color);

      if (ui.colorPicker) {
        ui.colorPicker.value = color;
      }

      document.querySelectorAll(".swatch[data-color]")
        .forEach(swatch => {
          swatch.classList.toggle("active", swatch === button);
        });
    });
  });

  ui.panelToggle?.addEventListener("click", () => {
    ui.controlPanel?.classList.toggle("collapsed");
  });

  ui.fullscreen?.addEventListener("click", async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      showToast("No se pudo activar pantalla completa");
    }
  });

  ui.pauseButton?.addEventListener("click", () => {
    paused = !paused;
    engine.setPaused(paused);

    ui.pauseButton.classList.toggle("active", paused);
    ui.pauseButton.textContent = paused ? "▶ Reanudar" : "Ⅱ Pausar";

    showToast(paused ? "Animación pausada" : "Animación reanudada");
  });

  ui.attractButton?.addEventListener("click", () => {
    manualAttraction = !manualAttraction;

    if (manualAttraction) manualExplosion = false;

    ui.attractButton.classList.toggle("active", manualAttraction);
    ui.explodeButton?.classList.toggle("active", manualExplosion);

    showToast(manualAttraction ? "Atracción activada" : "Atracción desactivada");
  });

  ui.explodeButton?.addEventListener("click", () => {
    manualExplosion = !manualExplosion;

    if (manualExplosion) manualAttraction = false;

    ui.explodeButton.classList.toggle("active", manualExplosion);
    ui.attractButton?.classList.toggle("active", manualAttraction);

    if (manualExplosion) engine.setExplosion(1);

    showToast(manualExplosion ? "Expansión activada" : "Expansión desactivada");
  });

  ui.scene?.addEventListener("pointermove", event => {
    if (cameraActive || !engine) return;

    const rect = ui.scene.getBoundingClientRect();

    const x = ((event.clientX - rect.left) / rect.width - 0.5) * 12;
    const y = (0.5 - (event.clientY - rect.top) / rect.height) * 8;

    engine.setPointer(x, y, true);
  });

  ui.scene?.addEventListener("pointerleave", () => {
    engine?.setPointer(0, 0, false);
  });
}

async function toggleCamera() {
  if (cameraActive) {
    handController?.stop();
    cameraActive = false;

    if (ui.cameraButton) {
      ui.cameraButton.textContent = "Activar cámara";
      ui.cameraButton.classList.remove("active");
    }

    if (ui.cameraPreview) {
      ui.cameraPreview.style.display = "none";
    }

    setStatus("Motor 3D activo");
    updateGestureDisplay(
      "Cámara desactivada",
      "Activa la cámara cuando quieras controlar las partículas con las manos."
    );

    showToast("Cámara desactivada");
    return;
  }

  if (ui.cameraButton) {
    ui.cameraButton.disabled = true;
    ui.cameraButton.textContent = "Iniciando cámara…";
  }

  handController = new HandGestureController(
    updateGesture,
    message => {
      if (ui.gestureStatus) ui.gestureStatus.textContent = message;
    }
  );

  try {
    await handController.start(ui.cameraPreview);
    cameraActive = true;

    if (ui.cameraPreview) {
      ui.cameraPreview.style.display = "block";
    }

    if (ui.cameraButton) {
      ui.cameraButton.textContent = "Desactivar cámara";
      ui.cameraButton.classList.add("active");
    }

    setStatus("Reconocimiento de manos activo");
    showToast("Cámara conectada");
  } catch (error) {
    cameraActive = false;

    showToast(
      error?.name === "NotAllowedError"
        ? "Permite el acceso a la cámara en tu navegador"
        : "No se pudo iniciar la cámara"
    );

    updateGestureDisplay(
      "Cámara no disponible",
      "Comprueba el permiso de cámara y la conexión a internet."
    );
  } finally {
    if (ui.cameraButton) {
      ui.cameraButton.disabled = false;

      if (!cameraActive) {
        ui.cameraButton.textContent = "Activar cámara";
        ui.cameraButton.classList.remove("active");
      }
    }
  }
}

function startApp() {
  if (!ui.scene) {
    throw new Error("No se encontró el elemento #scene en index.html");
  }

  engine = new ParticleEngine(ui.scene);

  if (ui.shapeSelect) {
    engine.setShape(ui.shapeSelect.value || "galaxy");
  }

   const weakDevice =
    window.innerWidth < 900 ||
    (navigator.hardwareConcurrency || 4) <= 4 ||
    (navigator.deviceMemory || 4) <= 4;

  const initialCount = weakDevice ? 1500 : 4000;
  engine.setCount(initialCount);

  if (ui.particleCount) ui.particleCount.value = String(initialCount);

  if (ui.particleSize) {
    engine.setSize(0.035 * Number(ui.particleSize.value) / 100);
  }
  if (ui.speed) engine.setSpeed(Number(ui.speed.value) / 50);
  if (ui.energy) engine.setEnergy(Number(ui.energy.value) / 60);

  setupControls();

  ui.cameraButton?.addEventListener("click", toggleCamera);

  updateMetrics();
  setStatus("Motor 3D activo");

  setInterval(updateMetrics, 1000);

  window.addEventListener("beforeunload", () => {
    handController?.stop();
    engine?.dispose();
  });

  console.info("Particle Universe 3D está listo.");
}

try {
  startApp();
} catch (error) {
  console.error("No se pudo iniciar Particle Universe 3D:", error);
  setStatus("Error al iniciar", false);
  showToast("Error al iniciar el motor 3D");
    }
    
