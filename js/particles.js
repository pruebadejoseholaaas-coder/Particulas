
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js";
import { createShape } from "./shapes.js";

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
      antialias: true,
      alpha: false,
      powerPreference: "high-performance"
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
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
    this.velocities = new Float32Array(count * 3);
    this.randomOffsets = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      this.randomOffsets[i] = Math.random() * Math.PI * 2;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage)
    );

    this.material = new THREE.PointsMaterial({
      color: this.color,
      size: this.particleSize,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    this.points = new THREE.Points(geometry, this.material);
    this.group.add(this.points);
  }

  setShape(name) {
    this.mode = name;
    this.targets = createShape(name, this.count);
  }

  setCount(count) {
    this.createParticles(count);
  }

  setColor(color) {
    this.color = color;
    this.material.color.set(color);
  }

  setSize(size) {
    this.particleSize = size;
    this.material.size = size;
  }

  setSpeed(speed) {
    this.speed = speed;
  }

  setEnergy(energy) {
    this.energy = energy;
  }

  setAttraction(point) {
    this.attraction = point;
  }

  setExplosion(value) {
    this.explosion = value;
  }

  setPointer(x, y, active = true) {
    this.pointer.x = x;
    this.pointer.y = y;
    this.pointer.active = active;
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

    const delta = Math.min(this.clock.getDelta(), 0.05);
    const elapsed = this.clock.elapsedTime;

    if (!this.paused) {
      const positions = this.positions;
      const targets = this.targets;
      const velocities = this.velocities;
      const count = this.count;
      const attraction = this.attraction;
      const explosion = this.explosion;
      const pointer = this.pointer;

      for (let i = 0; i < count; i++) {
        const k = i * 3;
        const phase = this.randomOffsets[i];
        const wave = Math.sin(elapsed * this.speed + phase) * 0.025 * this.energy;

        let tx = targets[k];
        let ty = targets[k + 1];
        let tz = targets[k + 2];

        tx += Math.cos(elapsed * 0.35 + phase) * wave;
        ty += Math.sin(elapsed * 0.45 + phase) * wave;
        tz += Math.cos(elapsed * 0.4 + phase) * wave;

        if (attraction) {
          const dx = attraction.x - positions[k];
          const dy = attraction.y - positions[k + 1];
          const dz = attraction.z - positions[k + 2];
          const distance = Math.sqrt(dx * dx + dy * dy + dz * dz) + 0.001;
          const force = Math.min(0.09, 1.8 / (distance * distance));
          velocities[k] += dx * force * delta;
          velocities[k + 1] += dy * force * delta;
          velocities[k + 2] += dz * force * delta;
        }

        if (pointer.active) {
          const dx = pointer.x - positions[k];
          const dy = pointer.y - positions[k + 1];
          const distanceSq = dx * dx + dy * dy + 0.5;
          const force = Math.min(0.035, 0.5 / distanceSq) * delta;
          velocities[k] += dx * force;
          velocities[k + 1] += dy * force;
        }

        if (explosion > 0.01) {
          const length = Math.sqrt(
            positions[k] * positions[k] +
            positions[k + 1] * positions[k + 1] +
            positions[k + 2] * positions[k + 2]
          ) + 0.001;

          const force = explosion * delta * 5 / length;
          velocities[k] += positions[k] * force;
          velocities[k + 1] += positions[k + 1] * force;
          velocities[k + 2] += positions[k + 2] * force;
        }

        const damping = Math.pow(0.92, delta * 60);
        velocities[k] *= damping;
        velocities[k + 1] *= damping;
        velocities[k + 2] *= damping;

        const follow = Math.min(1, delta * 2.5 * this.speed);
        positions[k] += (tx - positions[k]) * follow + velocities[k];
        positions[k + 1] += (ty - positions[k + 1]) * follow + velocities[k + 1];
        positions[k + 2] += (tz - positions[k + 2]) * follow + velocities[k + 2];
      }

      this.points.geometry.attributes.position.needsUpdate = true;
      this.group.rotation.y += delta * 0.06 * this.speed;
      this.group.rotation.x = Math.sin(elapsed * 0.15) * 0.08;
      this.explosion *= Math.pow(0.08, delta);
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
    window.removeEventListener("resize", this.resizeHandler);
    this.renderer.dispose();
    this.material.dispose();
    this.points.geometry.dispose();
    this.renderer.domElement.remove();
  }
}
