
function updateGesture(gesture) {
  if (!engine) return;

  const hands = gesture.hands || [];
  const hand = hands[0];
  const twoHands = hands.length >= 2 && gesture.twoHands;

  // Ninguna mano detectada
  if (!gesture.detected || !hand) {
    engine.setPointer(0, 0, false);

    engine.setAttraction(
      manualAttraction
        ? { x: 0, y: 0, z: 0 }
        : null
    );

    engine.setExplosion(manualExplosion ? 1 : 0);
    engine.group.scale.setScalar(1);

    previousClosedHand = false;

    if (cameraActive) {
      updateGestureDisplay(
        "Buscando tus manos",
        "Coloca una o ambas manos frente a la cámara."
      );
    }

    return;
  }

  const smoothing = 0.28;

  // ----------------------------------------
  // 1. CONTROL CON DOS MANOS
  // ----------------------------------------

  if (twoHands) {
    const center = gesture.center || {
      x: (hands[0].x + hands[1].x) / 2,
      y: (hands[0].y + hands[1].y) / 2,
      z: (hands[0].z + hands[1].z) / 2
    };

    handControl.x +=
      (center.x - handControl.x) * smoothing;

    handControl.y +=
      (center.y - handControl.y) * smoothing;

    handControl.z +=
      (center.z - handControl.z) * smoothing;

    // El centro entre las manos dirige el universo
    engine.setPointer(
      handControl.x,
      handControl.y,
      true
    );

    engine.group.rotation.y =
      handControl.x * 0.09;

    engine.group.rotation.x =
      -handControl.y * 0.07;

    // Separar las manos expande las partículas.
    // Juntarlas las contrae.
    const expansion = Math.max(
      0,
      Math.min(1, gesture.explosion || 0)
    );

    engine.setExplosion(
      manualExplosion ? 1 : expansion
    );

    engine.group.scale.setScalar(
      0.9 + expansion * 0.35
    );

    // Atracción con los dedos
    if (gesture.pinch && gesture.attraction) {
      engine.setAttraction(gesture.attraction);
    } else if (manualAttraction) {
      engine.setAttraction({
        x: handControl.x,
        y: handControl.y,
        z: handControl.z
      });
    } else {
      engine.setAttraction(null);
    }

    previousClosedHand = false;

    if (cameraActive) {
      updateGestureDisplay(
        "Control con dos manos",
        expansion > 0.5
          ? "Tus manos están separando y expandiendo el universo."
          : "Acerca o separa tus manos para controlar las partículas."
      );
    }

    return;
  }

  // ----------------------------------------
  // 2. CONTROL CON UNA MANO
  // ----------------------------------------

  handControl.x +=
    (hand.x - handControl.x) * smoothing;

  handControl.y +=
    (hand.y - handControl.y) * smoothing;

  handControl.z +=
    (hand.z - handControl.z) * smoothing;

  engine.setPointer(
    handControl.x,
    handControl.y,
    true
  );

  engine.group.rotation.y =
    handControl.x * 0.09;

  engine.group.rotation.x =
    -handControl.y * 0.07;

  // ----------------------------------------
  // 3. ATRACCIÓN
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
  // 4. EXPANSIÓN Y CONTRACCIÓN
  // ----------------------------------------

  if (gesture.openHand) {
    engine.group.scale.setScalar(1.25);

    engine.setExplosion(
      manualExplosion ? 1 : 0.12
    );

  } else if (gesture.closedHand) {
    engine.group.scale.setScalar(0.75);

    engine.setExplosion(
      manualExplosion ? 1 : 0
    );

  } else {
    engine.group.scale.setScalar(1);

    engine.setExplosion(
      manualExplosion ? 1 : 0
    );
  }

  // ----------------------------------------
  // 5. CAMBIO DE FIGURA CON EL PUÑO
  // ----------------------------------------

  if (
    gesture.closedHand &&
    !previousClosedHand
  ) {
    changeShapeWithHand();
  }

  previousClosedHand = gesture.closedHand;

  // ----------------------------------------
  // 6. INFORMACIÓN VISUAL
  // ----------------------------------------

  if (!cameraActive) return;

  let title = "Mano detectada";
  let description =
    "Mueve tu mano para dirigir las partículas.";

  if (gesture.pinch) {
    title = "Atracción activada";
    description =
      "Tus dedos están atrayendo las partículas.";

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

    updateGestureDisplay(title, description);
  }
}
