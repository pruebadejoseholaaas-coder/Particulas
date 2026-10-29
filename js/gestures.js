
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
    this.frameId = null;
    this.lastUpdate = 0;
  }

  async start(video) {
    if (this.running || this.starting) return;
    this.starting = true;
    this.video = video;

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Tu navegador no permite acceder a la cámara aquí.");
      }

      this.onStatus("Solicitando permiso para la cámara…");

      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: "user",
          width: { ideal: 640 },
          height: { ideal: 480 }
        }
      });

      this.video.srcObject = this.stream;
      await this.video.play();

      this.onStatus("Cargando reconocimiento de manos…");

      const vision = await import(
        /* @vite-ignore */
        `${MEDIAPIPE_CDN}/vision_bundle.mjs`
      );

      const fileset = await vision.FilesetResolver.forVisionTasks(
        `${MEDIAPIPE_CDN}/wasm`
      );

      this.landmarker = await vision.HandLandmarker.createFromOptions(
        fileset,
        {
          baseOptions: { modelAssetPath: MODEL_URL },
          runningMode: "VIDEO",
          numHands: 2,
          minHandDetectionConfidence: 0.55,
          minHandPresenceConfidence: 0.5,
          minTrackingConfidence: 0.5
        }
      );

      this.running = true;
      this.starting = false;
      this.onStatus("Cámara activa · muestra una mano");
      this.detectFrame();
    } catch (error) {
      this.starting = false;
      this.stop();
      console.error("Error al iniciar la cámara:", error);
      this.onStatus(
        error?.name === "NotAllowedError"
          ? "Permiso de cámara denegado"
          : "No se pudo iniciar la cámara"
      );
      throw error;
    }
  }

  detectFrame() {
    if (!this.running || !this.video || !this.landmarker) return;

    if (
      this.video.readyState >= 2 &&
      this.video.currentTime !== this.lastVideoTime
    ) {
      this.lastVideoTime = this.video.currentTime;

      try {
        const result = this.landmarker.detectForVideo(
          this.video,
          performance.now()
        );

        const hands = (result.landmarks || []).map((landmarks, index) => {
          const wrist = landmarks[0];
          const palm = landmarks[9];
          const tips = [8, 12, 16, 20];

          let extended = 0;

          for (const tipIndex of tips) {
            const tip = landmarks[tipIndex];
            const middle = landmarks[tipIndex - 2];

            if (Math.hypot(tip.x - wrist.x, tip.y - wrist.y) >
                Math.hypot(middle.x - wrist.x, middle.y - wrist.y) * 1.12) {
              extended++;
            }
          }

          const open = extended >= 3;
          const pinchDistance = Math.hypot(
            landmarks[4].x - landmarks[8].x,
            landmarks[4].y - landmarks[8].y
          );

          return {
            index,
            x: (0.5 - palm.x) * 12,
            y: (0.5 - palm.y) * 8,
            z: -palm.z * 8,
            open,
            extended,
            pinching: pinchDistance < 0.055,
            landmarks
          };
        });

        let gesture = {
          hands,
          detected: hands.length > 0,
          openHand: hands.some(hand => hand.open),
          closedHand: hands.some(hand => !hand.open),
          pinch: hands.some(hand => hand.pinching),
          twoHands: hands.length >= 2,
          attraction: null,
          explosion: 0
        };

        if (hands.length) {
          const center = hands.reduce(
            (acc, hand) => ({
              x: acc.x + hand.x / hands.length,
              y: acc.y + hand.y / hands.length,
              z: acc.z + hand.z / hands.length
            }),
            { x: 0, y: 0, z: 0 }
          );

          if (hands.some(hand => hand.pinching)) {
            gesture.attraction = center;
          }

          if (hands.length >= 2) {
            const distance = Math.hypot(
              hands[0].x - hands[1].x,
              hands[0].y - hands[1].y
            );

            gesture.explosion = Math.max(
              0,
              Math.min(1, (distance - 2) / 5)
            );
          }
        }

        const now = performance.now();
        if (now - this.lastUpdate > 40) {
          this.lastUpdate = now;
          this.onGesture(gesture);
        }
      } catch (error) {
        console.error("Error reconociendo gestos:", error);
      }
    }

    this.frameId = requestAnimationFrame(() => this.detectFrame());
  }

  stop() {
    this.running = false;
    this.starting = false;

    if (this.frameId !== null) {
      cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
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
      explosion: 0
    });
  }
}
