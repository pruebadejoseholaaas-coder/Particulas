
const MEDIAPIPE_CDN =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";

const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

export class HandGestureController {
  constructor(onGesture, onStatus) {
    this.onGesture = onGesture;
    this.onStatus = onStatus;

    this.stream = null;
    this.video = null;
    this.landmarker = null;

    this.running = false;
    this.starting = false;

    this.lastVideoTime = -1;
    this.lastDetect = 0;
    this.lastUpdate = 0;

    this.frameId = null;
  }

  // ========================================
  // INICIAR CÁMARA
  // ========================================

  async start(video) {
    if (this.running || this.starting) return;

    this.starting = true;
    this.video = video;

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error(
          "Tu navegador no permite acceder a la cámara."
        );
      }

      this.onStatus("Solicitando permiso para la cámara…");

      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: "user",
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 24, max: 30 }
        }
      });

      this.video.srcObject = this.stream;

      await this.video.play();

      this.onStatus("Cargando reconocimiento de manos…");

      const vision = await import(
        `${MEDIAPIPE_CDN}/vision_bundle.mjs`
      );

      const fileset =
        await vision.FilesetResolver.forVisionTasks(
          `${MEDIAPIPE_CDN}/wasm`
        );

      this.landmarker =
        await vision.HandLandmarker.createFromOptions(
          fileset,
          {
            baseOptions: {
              modelAssetPath: MODEL_URL
            },

            runningMode: "VIDEO",

            // Reconocer dos manos
            numHands: 2,

            minHandDetectionConfidence: 0.55,
            minHandPresenceConfidence: 0.5,
            minTrackingConfidence: 0.5
          }
        );

      this.running = true;
      this.starting = false;

      this.lastVideoTime = -1;
      this.lastDetect = 0;
      this.lastUpdate = 0;

      this.onStatus(
        "Cámara activa · muestra tus manos"
      );

      this.detectFrame();

    } catch (error) {
      this.starting = false;

      this.stop();

      console.error(
        "Error al iniciar la cámara:",
        error
      );

      this.onStatus(
        error?.name === "NotAllowedError"
          ? "Permiso de cámara denegado"
          : "No se pudo iniciar la cámara"
      );

      throw error;
    }
  }

  // ========================================
  // ANALIZAR UNA MANO
  // ========================================

  analyzeHand(landmarks, index) {
    const wrist = landmarks[0];

    const tips = [8, 12, 16, 20];

    let extended = 0;

    for (const tipIndex of tips) {
      const tip = landmarks[tipIndex];
      const middle = landmarks[tipIndex - 2];

      const tipDistance = Math.hypot(
        tip.x - wrist.x,
        tip.y - wrist.y
      );

      const middleDistance = Math.hypot(
        middle.x - wrist.x,
        middle.y - wrist.y
      );

      if (tipDistance > middleDistance * 1.12) {
        extended++;
      }
    }

    const open = extended >= 3;

    // Distancia entre pulgar e índice
    const pinchDistance = Math.hypot(
      landmarks[4].x - landmarks[8].x,
      landmarks[4].y - landmarks[8].y
    );

    const pinching = pinchDistance < 0.055;

    // Centro de la palma
    const palm = landmarks[9];

    return {
      index,

      x: (0.5 - palm.x) * 12,
      y: (0.5 - palm.y) * 8,
      z: -palm.z * 8,

      open,
      extended,
      pinching,

      pinchDistance,

      landmarks
    };
  }

  // ========================================
  // DETECCIÓN CONTINUA
  // ========================================

  detectFrame() {
    if (
      !this.running ||
      !this.video ||
      !this.landmarker
    ) {
      return;
    }

    const nowCheck = performance.now();

    // Limitar reconocimiento para cuidar el rendimiento
    if (
      this.video.readyState >= 2 &&
      this.video.currentTime !== this.lastVideoTime &&
      nowCheck - this.lastDetect >= 66
    ) {
      this.lastDetect = nowCheck;

      this.lastVideoTime = this.video.currentTime;

      try {
        const result = this.landmarker.detectForVideo(
          this.video,
          nowCheck
        );

        // Analizar cada mano detectada
        const hands = (result.landmarks || []).map(
          (landmarks, index) => {
            return this.analyzeHand(
              landmarks,
              index
            );
          }
        );

        // ------------------------------------
        // INFORMACIÓN GENERAL
        // ------------------------------------

        const detected = hands.length > 0;

        const openHand = hands.some(
          hand => hand.open
        );

        const closedHand = hands.length > 0 &&
          hands.every(hand => !hand.open);

        const pinch = hands.some(
          hand => hand.pinching
        );

        const twoHands = hands.length >= 2;

        const gesture = {
          hands,

          detected,
          openHand,
          closedHand,
          pinch,
          twoHands,

          attraction: null,
          explosion: 0,

          handDistance: 0,
          center: null
        };

        // ------------------------------------
        // CENTRO DE LAS MANOS
        // ------------------------------------

        if (detected) {
          const center = hands.reduce(
            (acc, hand) => ({
              x: acc.x + hand.x / hands.length,
              y: acc.y + hand.y / hands.length,
              z: acc.z + hand.z / hands.length
            }),
            { x: 0, y: 0, z: 0 }
          );

          gesture.center = center;

          // Pinza: atraer hacia el centro de la mano
          if (pinch) {
            gesture.attraction = center;
          }
        }

        // ------------------------------------
        // CONTROL CON DOS MANOS
        // ------------------------------------

        if (twoHands) {
          const first = hands[0];
          const second = hands[1];

          const distance = Math.hypot(
            first.x - second.x,
            first.y - second.y
          );

          gesture.handDistance = distance;

          // Separar las manos produce expansión
          gesture.explosion = Math.max(
            0,
            Math.min(
              1,
              (distance - 2) / 5
            )
          );

          // El punto central entre ambas manos
          gesture.center = {
            x: (first.x + second.x) / 2,
            y: (first.y + second.y) / 2,
            z: (first.z + second.z) / 2
          };
        }

        // ------------------------------------
        // ENVIAR RESULTADOS
        // ------------------------------------

        const now = performance.now();

        if (now - this.lastUpdate >= 40) {
          this.lastUpdate = now;

          this.onGesture(gesture);
        }

      } catch (error) {
        console.error(
          "Error reconociendo gestos:",
          error
        );
      }
    }

    if (this.running) {
      this.frameId = requestAnimationFrame(
        () => this.detectFrame()
      );
    }
  }

  // ========================================
  // DETENER CÁMARA
  // ========================================

  stop() {
    this.running = false;
    this.starting = false;

    if (this.frameId !== null) {
      cancelAnimationFrame(this.frameId);

      this.frameId = null;
    }

    if (this.stream) {
      this.stream.getTracks().forEach(track => {
        track.stop();
      });

      this.stream = null;
    }

    if (this.video) {
      this.video.pause();

      this.video.srcObject = null;
    }

    if (this.landmarker) {
      this.landmarker.close();

      this.landmarker = null;
    }

    this.onGesture({
      hands: [],

      detected: false,
      openHand: false,
      closedHand: false,
      pinch: false,
      twoHands: false,

      attraction: null,
      explosion: 0,

      handDistance: 0,
      center: null
    });

    this.onStatus("Cámara desactivada");
  }
}
