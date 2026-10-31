
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
let previousClosedHand = false;

// Posición suavizada de la mano
let handControl = {
  x: 0,
  y: 0,
  z: 0
};

// ==========================================
// MENSAJES
// ==========================================

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
  if (ui.topStatus) {
    ui.topStatus.textContent = message;
  }

  if (ui.statusDot) {
    ui.statusDot.classList.toggle("offline", !online);
  }
}

function updateGestureDisplay(title, description) {
  if (ui.gestureTitle) {
    ui.gestureTitle.textContent = title;
  }

  if (ui.gestureDescription) {
    ui.gestureDescription.textContent = description;
  }
}

// ==========================================
// MÉTRICAS
// ==========================================

function updateMetrics() {
  if (!engine) return;

  if (ui.particleMetric) {
    ui.particleMetric.textContent =
      engine.count.toLocaleString("es-DO");
  }

  if (ui.fpsMetric) {
    ui.fpsMetric.textContent = String(engine.fps);
  }
}

// ==========================================
// CONTROL DE FIGURAS CON GESTOS
// ==========================================

function changeShapeWithHand() {
  if (!engine || !ui.shapeSelect) return;

  const shapes = Array.from(ui.shapeSelect.options)
    .map(option => option.value)
    .filter(Boolean);

  if (!shapes.length) return;

  const currentIndex = shapes.indexOf(
    ui.shapeSelect.value
  );

  const nextIndex = (currentIndex + 1) % shapes.length;

  const nextShape = shapes[nextIndex];

  ui.shapeSelect.value = nextShape;

  engine.setShape(nextShape);

  showToast("Tu mano cambió la forma: " + nextShape);
}

// ==========================================
// CONTROL PRINCIPAL DE LAS MANOS
// ==========================================

function updateGesture(gesture) {
  if (!engine) return;

  const hands = gesture.hands || [];
  const hand = hands[0];

  if (!gesture.detected || !hand) {
    engine.setPointer(0, 0, false);

    engine.setAttraction(
      manualAttraction
        ? { x: 0, y: 0, z: 0 }
        : null
    );

    engine.group.scale.setScalar(1);

    previousClosedHand = false;

    if (cameraActive) {
      updateGestureDisplay(
        "Buscando tus manos",
        "Coloca tu mano frente a la cámara."
      );
    }

    return;
  }

  // ----------------------------------------
  // 1. MOVIMIENTO DE LA MANO
  // ----------------------------------------

  const smoothing = 0.28;

  handControl.x +=
    (hand.x - handControl.x) * smoothing;

  handControl.y +=
    (hand.y - handControl.y) * smoothing;

  handControl.z +=
    (hand.z - handControl.z) * smoothing;

  // La mano mueve el punto de interacción
  engine.setPointer(
    handControl.x,
    handControl.y,
    true
  );

  // La mano también controla la rotación
  engine.group.rotation.y =
    handControl.x * 0.09;

  engine.group.rotation.x =
    -handControl.y * 0.07;

  // ----------------------------------------
  // 2. ATRACCIÓN CON LOS DEDOS
  // ----------------------------------------

  if (gesture.pinch) {
    engine.setAttraction({
      x: handControl.x,
      y: handControl.y,
      z: handControl.z
    });
  } else if (manualAttraction) {
    engine.setAttraction({
      x: 0,
      y: 0,
      z: 0
    });
  } else {
    engine.setAttraction(null);
  }

  // ----------------------------------------
  // 3. EXPANSIÓN Y CONTRACCIÓN
  // ----------------------------------------

  if (gesture.openHand) {
    // Mano abierta: expandir
    engine.group.scale.setScalar(1.25);

    engine.setExplosion(
      manualExplosion ? 1 : 0.12
    );

  } else if (gesture.closedHand) {
    // Puño cerrado: contraer
    engine.group.scale.setScalar(0.75);

    engine.setExplosion(
      manualExplosion ? 1 : 0
    );

  } else {
    // Posición normal
    engine.group.scale.setScalar(1);

    engine.setExplosion(
      manualExplosion ? 1 : 0
    );
  }

  // ----------------------------------------
  // 4. CAMBIO DE FIGURA CON EL PUÑO
  // ----------------------------------------

  if (
    gesture.closedHand &&
    !previousClosedHand
  ) {
    changeShapeWithHand();
  }

  previousClosedHand = gesture.closedHand;

  // ----------------------------------------
  // 5. INFORMACIÓN VISUAL
  // ----------------------------------------

  if (!cameraActive) return;

  let title = "Mano detectada";
  let description = "Mueve tu mano para dirigir las partículas.";

  if (gesture.pinch) {
    title = "Atracción activada";

    description =
      "Tus dedos están atrayendo las partículas hacia tu mano.";

  } else if (gesture.openHand) {
    title = "Expansión activada";

    description =
      "Tu mano abierta está expandiendo el universo.";

  } else if (gesture.closedHand) {
    title = "Cambio de forma";

    description =
      "Tu puño contrae las partículas y cambia su figura.";
  }

  const currentText = `${title}|${description}`;

  if (currentText !== lastGestureText) {
    lastGestureText = currentText;

    updateGestureDisplay(
      title,
      description
    );
  }
}

// ==========================================
// FIGURAS ALEATORIAS
// ==========================================

function randomizeShape() {
  if (!ui.shapeSelect || !engine) return;

  const shapes = Array.from(ui.shapeSelect.options)
    .map(option => option.value)
    .filter(Boolean);

  if (!shapes.length) return;

  const alternatives = shapes.filter(
    shape => shape !== ui.shapeSelect.value
  );

  const choices = alternatives.length
    ? alternatives
    : shapes;

  const shape = choices[
    Math.floor(Math.random() * choices.length)
  ];

  ui.shapeSelect.value = shape;

  engine.setShape(shape);

  showToast("Nueva forma: " + shape);
}

// ==========================================
// RESTABLECER UNIVERSO
// ==========================================

function resetView() {
  if (!engine) return;

  engine.group.rotation.set(0, 0, 0);

  engine.group.scale.setScalar(1);

  engine.camera.position.set(0, 0, 17);

  engine.camera.lookAt(0, 0, 0);

  engine.setAttraction(null);
  engine.setExplosion(0);
  engine.setPointer(0, 0, false);

  manualAttraction = false;
  manualExplosion = false;

  previousClosedHand = false;

  handControl = {
    x: 0,
    y: 0,
    z: 0
  };

  ui.attractButton?.classList.remove("active");
  ui.explodeButton?.classList.remove("active");

  showToast("Vista restablecida");
}

// ==========================================
// CONTROLES DE INTERFAZ
// ==========================================

function setupControls() {

  ui.shapeSelect?.addEventListener("change", () => {
    engine.setShape(ui.shapeSelect.value);

    showToast("Forma: " + ui.shapeSelect.value);
  });

  ui.randomShape?.addEventListener(
    "click",
    randomizeShape
  );

  ui.resetView?.addEventListener(
    "click",
    resetView
  );

  // Límite de partículas según dispositivo
  const countLimit = () => {
    const weakDevice =
      window.innerWidth < 900 ||
      (navigator.hardwareConcurrency || 4) <= 4 ||
      (navigator.deviceMemory || 4) <= 4;

    return weakDevice ? 3000 : 12000;
  };

  ui.particleCount?.addEventListener("input", () => {
    const label = $("countValue");

    if (label) {
      label.textContent = Math.min(
        Number(ui.particleCount.value),
        countLimit()
      );
    }
  });

  ui.particleCount?.addEventListener("change", () => {
    const count = Math.min(
      Number(ui.particleCount.value),
      countLimit()
    );

    if (Number.isFinite(count) && count >= 100) {
      ui.particleCount.value = String(count);

      engine.setCount(count);

      updateMetrics();
    }
  });

  // Tamaño
  ui.particleSize?.addEventListener("input", () => {
    const value = Number(ui.particleSize.value);

    engine.setSize(0.035 * value / 100);

    const label = $("sizeValue");

    if (label) {
      label.textContent = value + "%";
    }
  });

  // Velocidad
  ui.speed?.addEventListener("input", () => {
    const value = Number(ui.speed.value);

    engine.setSpeed(value / 50);

    const label = $("speedValue");

    if (label) {
      label.textContent = value + "%";
    }
  });

  // Energía
  ui.energy?.addEventListener("input", () => {
    const value = Number(ui.energy.value);

    engine.setEnergy(value / 60);

    const label = $("energyValue");

    if (label) {
      label.textContent = value + "%";
    }
  });

  // Color
  ui.colorPicker?.addEventListener("input", () => {
    engine.setColor(ui.colorPicker.value);
  });

  // Colores rápidos
  document.querySelectorAll(".swatch[data-color]")
    .forEach(button => {
      button.addEventListener("click", () => {
        const color = button.dataset.color;

        if (!color) return;

        engine.setColor(color);

        if (ui.colorPicker) {
          ui.colorPicker.value = color;
        }

        document.querySelectorAll(".swatch[data-color]")
          .forEach(swatch => {
            swatch.classList.toggle(
              "active",
              swatch === button
            );
          });
      });
    });

  // Panel
  ui.panelToggle?.addEventListener("click", () => {
    ui.controlPanel?.classList.toggle("collapsed");
  });

  // Pantalla completa
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

  // Pausa
  ui.pauseButton?.addEventListener("click", () => {
    paused = !paused;

    engine.setPaused(paused);

    ui.pauseButton.classList.toggle(
      "active",
      paused
    );

    ui.pauseButton.textContent = paused
      ? "▶ Reanudar"
      : "Ⅱ Pausar";

    showToast(
      paused
        ? "Animación pausada"
        : "Animación reanudada"
    );
  });

  // Atracción manual
  ui.attractButton?.addEventListener("click", () => {
    manualAttraction = !manualAttraction;

    if (manualAttraction) {
      manualExplosion = false;
    }

    ui.attractButton.classList.toggle(
      "active",
      manualAttraction
    );

    ui.explodeButton?.classList.toggle(
      "active",
      manualExplosion
    );

    showToast(
      manualAttraction
        ? "Atracción activada"
        : "Atracción desactivada"
    );
  });

  // Expansión manual
  ui.explodeButton?.addEventListener("click", () => {
    manualExplosion = !manualExplosion;

    if (manualExplosion) {
      manualAttraction = false;
    }

    ui.explodeButton.classList.toggle(
      "active",
      manualExplosion
    );

    ui.attractButton?.classList.toggle(
      "active",
      manualAttraction
    );

    engine.setExplosion(
      manualExplosion ? 1 : 0
    );

    showToast(
      manualExplosion
        ? "Expansión activada"
        : "Expansión desactivada"
    );
  });

  // Interacción con ratón cuando no se usa cámara
  ui.scene?.addEventListener("pointermove", event => {
    if (cameraActive || !engine) return;

    const rect = ui.scene.getBoundingClientRect();

    const x =
      ((event.clientX - rect.left) / rect.width - 0.5) * 12;

    const y =
      (0.5 - (event.clientY - rect.top) / rect.height) * 8;

    engine.setPointer(x, y, true);
  });

  ui.scene?.addEventListener("pointerleave", () => {
    if (!cameraActive) {
      engine?.setPointer(0, 0, false);
    }
  });
}

// ==========================================
// CÁMARA
// ==========================================

async function toggleCamera() {

  // DESACTIVAR
  if (cameraActive) {
    handController?.stop();

    cameraActive = false;

    engine?.setPointer(0, 0, false);
    engine?.setAttraction(null);
    engine?.group.scale.setScalar(1);

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
      "Activa la cámara para controlar las partículas con tus manos."
    );

    showToast("Cámara desactivada");

    return;
  }

  // ACTIVAR
  if (ui.cameraButton) {
    ui.cameraButton.disabled = true;

    ui.cameraButton.textContent = "Iniciando cámara…";
  }

  handController = new HandGestureController(
    updateGesture,
    message => {
      if (ui.gestureStatus) {
        ui.gestureStatus.textContent = message;
      }
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

    setStatus("Control gestual activo");

    updateGestureDisplay(
      "Control con las manos activado",
      "Mueve tu mano para comenzar a controlar el universo."
    );

    showToast("Control gestual activado");

  } catch (error) {
    cameraActive = false;

    showToast(
      error?.name === "NotAllowedError"
        ? "Permite el acceso a la cámara en tu navegador"
        : "No se pudo iniciar la cámara"
    );

    updateGestureDisplay(
      "Cámara no disponible",
      "Comprueba los permisos de cámara y tu conexión a internet."
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

// ==========================================
// INICIAR APLICACIÓN
// ==========================================

function startApp() {

  if (!ui.scene) {
    throw new Error(
      "No se encontró el elemento #scene en index.html"
    );
  }

  engine = new ParticleEngine(ui.scene);

  if (ui.shapeSelect) {
    engine.setShape(
      ui.shapeSelect.value || "galaxy"
    );
  }

  // Detectar dispositivos de menor potencia
  const weakDevice =
    window.innerWidth < 900 ||
    (navigator.hardwareConcurrency || 4) <= 4 ||
    (navigator.deviceMemory || 4) <= 4;

  const initialCount = weakDevice ? 1500 : 4000;

  engine.setCount(initialCount);

  if (ui.particleCount) {
    ui.particleCount.value = String(initialCount);
  }

  if (ui.particleSize) {
    engine.setSize(
      0.035 * Number(ui.particleSize.value) / 100
    );
  }

  if (ui.speed) {
    engine.setSpeed(
      Number(ui.speed.value) / 50
    );
  }

  if (ui.energy) {
    engine.setEnergy(
      Number(ui.energy.value) / 60
    );
  }

  setupControls();

  ui.cameraButton?.addEventListener(
    "click",
    toggleCamera
  );

  updateMetrics();

  setStatus("Motor 3D activo");

  const metricsInterval = setInterval(
    updateMetrics,
    1000
  );

  window.addEventListener("beforeunload", () => {
    clearInterval(metricsInterval);

    handController?.stop();

    engine?.dispose();
  });

  console.info(
    "Particle Universe 3D está listo."
  );
}

// ==========================================
// INICIALIZACIÓN SEGURA
// ==========================================

try {
  startApp();

} catch (error) {
  console.error(
    "No se pudo iniciar Particle Universe 3D:",
    error
  );

  setStatus("Error al iniciar", false);

  showToast("Error al iniciar el motor 3D");
}
