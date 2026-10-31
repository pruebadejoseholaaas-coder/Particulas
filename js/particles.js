
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js";
import { createShape } from "./shapes.js";

const vertexShader = `
  attribute vec3 aTarget;
  attribute float aPhase;

  uniform float uTime;
  uniform float uSpeed;
  uniform float uEnergy;
  uniform float uSize;
  uniform float uExplosion;

  uniform vec3 uAttraction;
  uniform float uAttractionActive;

  uniform vec2 uPointer;
  uniform float uPointerActive;

  varying float vGlow;

  void main() {
    vec3 pos = aTarget;

    float wave = sin(uTime * uSpeed + aPhase);
    float wave2 = cos(uTime * uSpeed * 0.7 + aPhase);

    pos.x += wave * 0.035 * uEnergy;
    pos.y += wave2 * 0.035 * uEnergy;
    pos.z += sin(uTime * 0.5 + aPhase) * 0.025 * uEnergy;

    vec3 direction = normalize(aTarget + vec3(0.001));

    pos += direction * uExplosion * 2.5;

    if (uAttractionActive > 0.5) {
      vec3 diff = uAttraction - pos;
      float dist = length(diff);
      float force = 1.0 / (1.0 + dist * dist * 0.15);
      pos += diff * force * 0.7;
    }

    if (uPointerActive > 0.5) {
      vec2 diff = uPointer - pos.xy;
      float dist = length(diff);
      float force = 1.0 / (1.0 + dist * dist);
      pos.xy += diff * force * 0.35;
    }

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);

    gl_PointSize = uSize * (300.0 / -mvPosition.z);
    gl_PointSize = clamp(gl_PointSize, 1.0, 24.0);

    gl_Position = projectionMatrix * mvPosition;

    vGlow = 0.65 + 0.35 * abs(wave);
  }
`;

const fragmentShader = `
  uniform vec3 uColor;

  varying float vGlow;

  void main() {
    vec2 uv = gl_PointCoord - vec2(0.5);
    float dist = length(uv);

    if (dist > 0.5) discard;

    float core = smoothstep(0.5, 0.0, dist);
    float glow = exp(-dist * 9.0);

    vec3 color = uColor * (core + glow * 0.45);
    gl_FragColor = vec4(color * vGlow, core * 0.95);
  }
`;

export class ParticleEngine {
  constructor(container) {
    this.container = container;
    this.count = 1000;
    this.speed = 1;
    this.energy = 1;
    this.particleSize = 0.035;
    this.color = "#65e6ff";
    this.paused = false;
    this.mode = "galaxy";
    this.attraction = null;
    this.explosion = 0;
    this.pointer = { x: 0, y: 0, active: false };
    this.clock = new THREE.Clock();
    this.frameCount = 0;
    this.lastFpsTime = 0;
    this.lastFrameTime = 0;
    this.fps = 0;
    this.disposed = false;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color("#07090d");
    this.scene.fog = new THREE.FogExp2("#07090d", 0.018);

    this.camera = new THREE.PerspectiveCamera(
      55,
      container.clientWidth / Math.max(container.clientHeight, 1),
      0.1,
      100
    );

    this.camera.position.set(0, 0, 17);

    this.renderer = new THREE.WebGLRenderer({
      antialias: false,
      alpha: false,
      powerPreference: "high-performance"
    });

    this.renderer.setPixelRatio(1);
    this.renderer.setSize(
      container.clientWidth,
      container.clientHeight
    );

    container.appendChild(this.renderer.domElement);

    this.group = new THREE.Group();
    this.scene.add(this.group);

    this.createParticles(this.count);

    this.resizeHandler = () => this.resize();
    window.addEventListener("resize", this.resizeHandler);

    this.animate = this.animate.bind(this);
    this.animationId = requestAnimationFrame(this.animate);
  }

  createParticles(count) {
    if (this.points) {
      this.group.remove(this.points);
      this.points.geometry.dispose();
      this.points.material.dispose();
    }

    this.count = count;

    this.positions = createShape(this.mode, count);
    this.targets = this.positions.slice();

    const phases = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      phases[i] = Math.random() * Math.PI * 2;
    }

    const geometry = new THREE.BufferGeometry();

    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(this.positions, 3)
    );

    geometry.setAttribute(
      "aTarget",
      new THREE.BufferAttribute(this.targets, 3)
    );

    geometry.setAttribute(
      "aPhase",
      new THREE.BufferAttribute(phases, 1)
    );

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uSpeed: { value: this.speed },
        uEnergy: { value: this.energy },
        uSize: { value: this.particleSize },
        uColor: { value: new THREE.Color(this.color) },
        uExplosion: { value: 0 },

        uAttraction: {
          value: new THREE.Vector3()
        },

        uAttractionActive: { value: 0 },

        uPointer: {
          value: new THREE.Vector2()
        },

        uPointerActive: { value: 0 }
      },

      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    this.points = new THREE.Points(
      geometry,
      this.material
    );

    this.group.add(this.points);
  }

  setShape(name) {
    this.mode = name;
    this.targets = createShape(name, this.count);

    const attribute = this.points.geometry.attributes.aTarget;
    attribute.array.set(this.targets);
    attribute.needsUpdate = true;
  }

  setCount(count) {
    this.createParticles(count);
  }

  setColor(color) {
    this.color = color;
    this.material.uniforms.uColor.value.set(color);
  }

  setSize(size) {
    this.particleSize = size;
    this.material.uniforms.uSize.value = size;
  }

  setSpeed(speed) {
    this.speed = speed;
    this.material.uniforms.uSpeed.value = speed;
  }

  setEnergy(energy) {
    this.energy = energy;
    this.material.uniforms.uEnergy.value = energy;
  }

  setAttraction(point) {
    this.attraction = point;

    const uniforms = this.material.uniforms;

    if (point) {
      uniforms.uAttraction.value.set(
        point.x,
        point.y,
        point.z
      );

      uniforms.uAttractionActive.value = 1;
    } else {
      uniforms.uAttractionActive.value = 0;
    }
  }

  setExplosion(value) {
    this.explosion = value;
    this.material.uniforms.uExplosion.value = value;
  }

  setPointer(x, y, active = true) {
    this.pointer.x = x;
    this.pointer.y = y;
    this.pointer.active = active;

    const uniforms = this.material.uniforms;

    uniforms.uPointer.value.set(x, y);
    uniforms.uPointerActive.value = active ? 1 : 0;
  }

  setPaused(value) {
    this.paused = value;
  }

  resize() {
    if (this.disposed) return;

    const width = Math.max(this.container.clientWidth, 1);
    const height = Math.max(this.container.clientHeight, 1);

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height);
  }

  animate() {
    if (this.disposed) return;

    this.animationId = requestAnimationFrame(this.animate);

    if (document.hidden) {
      this.clock.getDelta();
      return;
    }

    const now = performance.now();

    if (now - this.lastFrameTime < 30) return;

    this.lastFrameTime = now;

    const delta = Math.min(this.clock.getDelta(), 0.05);
    const elapsed = this.clock.elapsedTime;

    if (!this.paused) {
      this.material.uniforms.uTime.value = elapsed;

      this.explosion *= Math.pow(0.08, delta);

      if (this.explosion < 0.001) {
        this.explosion = 0;
      }

      this.material.uniforms.uExplosion.value = this.explosion;

      this.group.rotation.y += delta * 0.06 * this.speed;
      this.group.rotation.x = Math.sin(elapsed * 0.15) * 0.08;
    }

    this.renderer.render(this.scene, this.camera);

    this.frameCount++;

    if (elapsed - this.lastFpsTime >= 1) {
      this.fps = this.frameCount;
      this.frameCount = 0;
      this.lastFpsTime = elapsed;
    }
  }

  dispose() {
    this.disposed = true;

    cancelAnimationFrame(this.animationId);

    window.removeEventListener(
      "resize",
      this.resizeHandler
    );

    this.renderer.dispose();

    if (this.points) {
      this.group.remove(this.points);
      this.points.geometry.dispose();
      this.points.material.dispose();
    }

    this.renderer.domElement.remove();
  }
}
