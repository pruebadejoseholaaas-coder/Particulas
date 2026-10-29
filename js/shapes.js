export function createShape(name, count) {
  const positions = new Float32Array(count * 3);
  const random = Math.random;

  for (let i = 0; i < count; i++) {
    const k = i * 3;
    const u = random();
    const v = random();
    const angle = u * Math.PI * 2;

    let x = 0;
    let y = 0;
    let z = 0;

    switch (name) {
      case "sphere": {
        const a = random() * Math.PI * 2;
        const b = Math.acos(2 * random() - 1);
        const r = 4.5;
        x = r * Math.sin(b) * Math.cos(a);
        y = r * Math.cos(b);
        z = r * Math.sin(b) * Math.sin(a);
        break;
      }

      case "heart": {
        const t = angle;
        const r = Math.sqrt(random());
        x = 0.18 * r * 16 * Math.pow(Math.sin(t), 3);
        y = 0.18 * r * (
          13 * Math.cos(t) -
          5 * Math.cos(2 * t) -
          2 * Math.cos(3 * t) -
          Math.cos(4 * t)
        );
        z = (random() - 0.5) * 1.5;
        break;
      }

      case "flower": {
        const t = angle;
        const r = 4 * Math.cos(5 * t) * Math.sqrt(random());
        x = r * Math.cos(t);
        y = r * Math.sin(t);
        z = (random() - 0.5) * 0.8;
        break;
      }

      case "saturn": {
        if (random() < 0.58) {
          const a = random() * Math.PI * 2;
          const b = Math.acos(2 * random() - 1);
          x = 2 * Math.sin(b) * Math.cos(a);
          y = 2 * Math.cos(b);
          z = 2 * Math.sin(b) * Math.sin(a);
        } else {
          const a = random() * Math.PI * 2;
          const r = 2.8 + random() * 2.2;
          x = r * Math.cos(a);
          y = (random() - 0.5) * 0.15;
          z = r * Math.sin(a) * 0.55;
        }
        break;
      }

      case "wave": {
        x = (u - 0.5) * 11;
        z = (v - 0.5) * 8;
        y = Math.sin(x * 1.2) * Math.cos(z * 0.8) * 1.6;
        break;
      }

      case "burst": {
        const a = random() * Math.PI * 2;
        const b = Math.acos(2 * random() - 1);
        const r = 1 + Math.pow(random(), 0.45) * 5;
        x = r * Math.sin(b) * Math.cos(a);
        y = r * Math.cos(b);
        z = r * Math.sin(b) * Math.sin(a);
        break;
      }

      case "dna": {
        const t = (u - 0.5) * Math.PI * 8;
        const strand = random() < 0.5 ? 0 : Math.PI;
        const r = 2;
        x = Math.cos(t + strand) * r;
        y = (u - 0.5) * 10;
        z = Math.sin(t + strand) * r;
        break;
      }

      case "torus": {
        const a = random() * Math.PI * 2;
        const b = random() * Math.PI * 2;
        const R = 3.2;
        const r = 1.1;
        x = (R + r * Math.cos(b)) * Math.cos(a);
        y = r * Math.sin(b);
        z = (R + r * Math.cos(b)) * Math.sin(a);
        break;
      }

      case "helix": {
        const t = (u - 0.5) * Math.PI * 10;
        const strand = random() < 0.5 ? 0 : Math.PI;
        x = Math.cos(t + strand) * 2.2;
        y = (u - 0.5) * 10;
        z = Math.sin(t + strand) * 2.2;
        break;
      }

      case "galaxy":
      default: {
        const arms = 5;
        const arm = Math.floor(random() * arms);
        const radius = Math.pow(random(), 0.62) * 6;
        const a = (arm / arms) * Math.PI * 2 + radius * 0.55;
        const spread = (random() - 0.5) * (0.35 + radius * 0.09);
        x = Math.cos(a + spread) * radius;
        y = (random() - 0.5) * (0.3 + radius * 0.12);
        z = Math.sin(a + spread) * radius;
      }
    }

    positions[k] = x;
    positions[k + 1] = y;
    positions[k + 2] = z;
  }

  return positions;
    }
          
