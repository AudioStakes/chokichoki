import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

const GRID_SIZE = 8;
const PAPER_SIZE = 4;
const CELL_SIZE = PAPER_SIZE / GRID_SIZE;
const HALF_SIZE = PAPER_SIZE / 2;
const PANEL_HALF = CELL_SIZE * 0.5;
const PANEL_Z_EPS = 0.08;
const FOLD_DURATION_MS = 900;
const UNFOLD_DURATION_MS = 850;
const UNFOLD_PAUSE_MS = 280;
const MASK_SIZE = 256;
const HEART_CUT_SIZE = 0.36;
const HEART_CUT_RADIUS = HEART_CUT_SIZE * 0.62;
const MAX_FOLDS_PER_AXIS = 3;
const DEFAULT_ORBIT = { yaw: 0, pitch: Math.PI / 2, distance: 6.4 };
const PAPER_COLOR = "#8fd3ff";

type FoldDirection = "vertical" | "horizontal";

type FoldOp = {
  id: string;
  name: string;
  direction: FoldDirection;
  line: number;
  axis: [number, number, number];
  point: [number, number, number];
  angle: number;
};

type ActiveFold = { type: "fold" | "unfold"; index: number; progress: number } | null;

type Panel = {
  id: number;
  row: number;
  col: number;
  center: THREE.Vector3;
};

type CutFragment = {
  id?: string;
  panelId: number;
  localX: number;
  localY: number;
  localQuaternion: number[];
};

type PanelObject = {
  panel: Panel;
  object: THREE.Group;
};

type OrigamiModel = {
  root: THREE.Group;
  panelObjects: PanelObject[];
  axes: { op: FoldOp; object: THREE.Line }[];
};

function createFoldOp(direction: FoldDirection, axisFoldIndex: number, orderIndex: number): FoldOp {
  const crease = HALF_SIZE - PAPER_SIZE / Math.pow(2, axisFoldIndex + 1);

  if (direction === "vertical") {
    return {
      id: `vertical-${axisFoldIndex + 1}-${orderIndex}`,
      name: `Vertical fold ${axisFoldIndex + 1}`,
      direction,
      line: crease,
      axis: [0, 1, 0],
      point: [crease, 0, 0],
      angle: Math.PI,
    };
  }

  return {
    id: `horizontal-${axisFoldIndex + 1}-${orderIndex}`,
    name: `Horizontal fold ${axisFoldIndex + 1}`,
    direction,
    line: crease,
    axis: [1, 0, 0],
    point: [0, crease, 0],
    angle: -Math.PI,
  };
}

function countFoldsByDirection(foldOps: FoldOp[], direction: FoldDirection) {
  return foldOps.filter((op) => op.direction === direction).length;
}

function toVector3(value: unknown, fallback: [number, number, number] = [0, 0, 0]) {
  if (value instanceof THREE.Vector3) return value.clone();
  if (Array.isArray(value) && value.length >= 3) {
    return new THREE.Vector3(
      Number.isFinite(Number(value[0])) ? Number(value[0]) : fallback[0],
      Number.isFinite(Number(value[1])) ? Number(value[1]) : fallback[1],
      Number.isFinite(Number(value[2])) ? Number(value[2]) : fallback[2]
    );
  }
  return new THREE.Vector3(fallback[0], fallback[1], fallback[2]);
}

function isFiniteVector3(value: unknown) {
  return value instanceof THREE.Vector3 && Number.isFinite(value.x) && Number.isFinite(value.y) && Number.isFinite(value.z);
}

function isOnMovingSide(op: FoldOp | undefined, position: THREE.Vector3) {
  if (!op || !isFiniteVector3(position)) return false;
  if (op.direction === "vertical") return position.x < op.line;
  if (op.direction === "horizontal") return position.y < op.line;
  return false;
}

function easeInOutCubic(value: number) {
  const t = Math.min(1, Math.max(0, Number(value) || 0));
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function rotationAroundAxisMatrix(pointLike: unknown, axisLike: unknown, angle: number) {
  const point = toVector3(pointLike);
  const axis = toVector3(axisLike, [0, 1, 0]);
  if (axis.lengthSq() === 0) axis.set(0, 1, 0);

  const quaternion = new THREE.Quaternion().setFromAxisAngle(axis.normalize(), Number(angle) || 0);
  const toOrigin = new THREE.Matrix4().makeTranslation(-point.x, -point.y, -point.z);
  const rotate = new THREE.Matrix4().makeRotationFromQuaternion(quaternion);
  const back = new THREE.Matrix4().makeTranslation(point.x, point.y, point.z);
  return back.multiply(rotate).multiply(toOrigin);
}

function createPanels(): Panel[] {
  const panels: Panel[] = [];
  let id = 0;

  for (let row = 0; row < GRID_SIZE; row += 1) {
    for (let col = 0; col < GRID_SIZE; col += 1) {
      const x = -HALF_SIZE + CELL_SIZE / 2 + col * CELL_SIZE;
      const y = HALF_SIZE - CELL_SIZE / 2 - row * CELL_SIZE;
      panels.push({ id: id++, row, col, center: new THREE.Vector3(x, y, 0) });
    }
  }

  return panels;
}

function progressForFold(index: number, committedCount: number, active: ActiveFold) {
  if (active && active.type === "fold" && active.index === index) return active.progress;
  if (active && active.type === "unfold" && active.index === index) return 1 - active.progress;
  return index < committedCount ? 1 : 0;
}

function matrixForPanel(panel: Panel, foldOps: FoldOp[], committedCount: number, active: ActiveFold, zLift = 0) {
  const center = panel.center instanceof THREE.Vector3 ? panel.center : new THREE.Vector3();
  let transform = new THREE.Matrix4().identity();

  for (let index = 0; index < foldOps.length; index += 1) {
    const op = foldOps[index];
    const progress = progressForFold(index, committedCount, active);
    if (!op || progress <= 0) continue;

    const currentCenter = center.clone().applyMatrix4(transform);
    if (!isOnMovingSide(op, currentCenter)) continue;

    const rotation = rotationAroundAxisMatrix(op.point, op.axis, op.angle * easeInOutCubic(progress));
    transform = rotation.multiply(transform);
  }

  const base = new THREE.Matrix4().makeTranslation(center.x, center.y, 0);
  const lift = new THREE.Matrix4().makeTranslation(0, 0, Number(zLift) || 0);
  return transform.multiply(base).multiply(lift);
}

function createMaskState() {
  const canvas = document.createElement("canvas");
  canvas.width = MASK_SIZE;
  canvas.height = MASK_SIZE;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create mask canvas context");

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.NoColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;

  return { canvas, ctx, texture };
}

function localToMaskPixel(localX: number, localY: number) {
  return {
    x: (localX / CELL_SIZE + 0.5) * MASK_SIZE,
    y: (0.5 - localY / CELL_SIZE) * MASK_SIZE,
  };
}

function drawHeartPath(ctx: CanvasRenderingContext2D, sizePx: number) {
  const s = sizePx / 32;
  ctx.beginPath();
  ctx.moveTo(0, 9 * s);
  ctx.bezierCurveTo(-18 * s, -5 * s, -15 * s, -22 * s, 0, -13 * s);
  ctx.bezierCurveTo(15 * s, -22 * s, 18 * s, -5 * s, 0, 9 * s);
  ctx.closePath();
}

function applyHeartTransformFromQuaternion(ctx: CanvasRenderingContext2D, quaternionArray: number[]) {
  const quaternion = new THREE.Quaternion().fromArray(
    Array.isArray(quaternionArray) && quaternionArray.length === 4 ? quaternionArray : [0, 0, 0, 1]
  );

  const xAxis = new THREE.Vector3(1, 0, 0).applyQuaternion(quaternion);
  const yAxis = new THREE.Vector3(0, 1, 0).applyQuaternion(quaternion);

  const a = Number.isFinite(xAxis.x) ? xAxis.x : 1;
  const b = Number.isFinite(-xAxis.y) ? -xAxis.y : 0;
  const c = Number.isFinite(yAxis.x) ? yAxis.x : 0;
  const d = Number.isFinite(-yAxis.y) ? -yAxis.y : 1;
  ctx.transform(a, b, c, d, 0, 0);
}

function redrawPanelMask(maskState: ReturnType<typeof createMaskState>, panelCuts: CutFragment[]) {
  const { ctx, texture } = maskState;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, MASK_SIZE, MASK_SIZE);
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, MASK_SIZE, MASK_SIZE);

  const cuts = Array.isArray(panelCuts) ? panelCuts : [];
  for (const cut of cuts) {
    const { x, y } = localToMaskPixel(cut.localX || 0, cut.localY || 0);
    const sizePx = (HEART_CUT_SIZE / CELL_SIZE) * MASK_SIZE;

    ctx.save();
    ctx.translate(x, y);
    applyHeartTransformFromQuaternion(ctx, cut.localQuaternion);
    ctx.fillStyle = "black";
    drawHeartPath(ctx, sizePx);
    ctx.fill();
    ctx.restore();
  }

  ctx.restore();
  texture.needsUpdate = true;
}

function createPanelObject(panel: Panel) {
  const group = new THREE.Group();
  group.name = `paper-panel-${panel.id}`;
  group.matrixAutoUpdate = false;

  const maskState = createMaskState();
  redrawPanelMask(maskState, []);

  const material = new THREE.MeshBasicMaterial({
    color: PAPER_COLOR,
    side: THREE.DoubleSide,
    transparent: false,
    alphaMap: maskState.texture,
    alphaTest: 0.5,
    depthWrite: true,
    depthTest: true,
  });

  const geometry = new THREE.PlaneGeometry(CELL_SIZE * 1.018, CELL_SIZE * 1.018, 1, 1);
  const surface = new THREE.Mesh(geometry, material);
  surface.userData.isPaperSurface = true;
  group.add(surface);

  group.userData.maskState = maskState;
  group.userData.maskSignature = "";
  return group;
}

function createAxisObject(op: FoldOp, active = false) {
  const axis = toVector3(op.axis, [0, 1, 0]);
  const point = toVector3(op.point);
  if (axis.lengthSq() === 0) axis.set(0, 1, 0);
  axis.normalize();

  const geometry = new THREE.BufferGeometry().setFromPoints([
    point.clone().add(axis.clone().multiplyScalar(-2.55)),
    point.clone().add(axis.clone().multiplyScalar(2.55)),
  ]);
  const material = new THREE.LineBasicMaterial({
    color: active ? "#f97316" : "#64748b",
    transparent: true,
    opacity: active ? 1 : 0.45,
  });
  const line = new THREE.Line(geometry, material);
  line.name = `axis-${op.id}`;
  line.visible = false;
  return line;
}

function createOrigamiRoot(foldOps: FoldOp[]): OrigamiModel {
  const root = new THREE.Group();
  root.name = "origami-root";
  root.rotation.set(0, 0, 0);
  root.position.set(0, 0, 0);

  const panels = createPanels();
  const panelObjects = panels.map((panel) => {
    const object = createPanelObject(panel);
    root.add(object);
    return { panel, object };
  });

  const axes = foldOps.map((op) => {
    const object = createAxisObject(op, false);
    root.add(object);
    return { op, object };
  });

  return { root, panelObjects, axes };
}

function cutSignature(panelCuts: CutFragment[]) {
  return JSON.stringify(
    (Array.isArray(panelCuts) ? panelCuts : []).map((cut) => ({
      id: cut.id,
      panelId: cut.panelId,
      localX: Number(cut.localX).toFixed(4),
      localY: Number(cut.localY).toFixed(4),
      localQuaternion: (cut.localQuaternion || [0, 0, 0, 1]).map((value) => Number(value).toFixed(4)),
    }))
  );
}

function updateOrigamiRoot(model: OrigamiModel | null, foldOps: FoldOp[], committedCount: number, active: ActiveFold, cuts: CutFragment[]) {
  if (!model) return;

  const cutsByPanelId = new Map<number, CutFragment[]>();
  (Array.isArray(cuts) ? cuts : []).forEach((cut) => {
    if (!Number.isInteger(cut.panelId)) return;
    if (!cutsByPanelId.has(cut.panelId)) cutsByPanelId.set(cut.panelId, []);
    cutsByPanelId.get(cut.panelId)!.push(cut);
  });

  model.panelObjects.forEach(({ panel, object }) => {
    object.matrix.copy(matrixForPanel(panel, foldOps, committedCount, active, 0));
    object.matrixAutoUpdate = false;

    const panelCuts = cutsByPanelId.get(panel.id) || [];
    const signature = cutSignature(panelCuts);
    if (signature !== object.userData.maskSignature) {
      object.userData.maskSignature = signature;
      redrawPanelMask(object.userData.maskState, panelCuts);
    }
  });

  model.axes.forEach(({ object }) => {
    object.visible = false;
  });
}

function cameraPositionFromOrbit(orbit: typeof DEFAULT_ORBIT) {
  const yaw = Number.isFinite(Number(orbit?.yaw)) ? Number(orbit.yaw) : DEFAULT_ORBIT.yaw;
  const pitch = Math.min(
    Math.PI / 2,
    Math.max(0.08, Number.isFinite(Number(orbit?.pitch)) ? Number(orbit.pitch) : DEFAULT_ORBIT.pitch)
  );
  const distance = Math.min(
    10,
    Math.max(3, Number.isFinite(Number(orbit?.distance)) ? Number(orbit.distance) : DEFAULT_ORBIT.distance)
  );

  return new THREE.Vector3(
    distance * Math.cos(pitch) * Math.sin(yaw),
    distance * Math.cos(pitch) * Math.cos(yaw),
    distance * Math.sin(pitch)
  );
}

function findPanelGroup(object: THREE.Object3D) {
  let current: THREE.Object3D | null = object;
  while (current) {
    if (typeof current.name === "string" && current.name.startsWith("paper-panel-")) return current as THREE.Group;
    current = current.parent;
  }
  return null;
}

function collectHeartCutFragmentsAtWorldPoint(model: OrigamiModel, worldPoint: THREE.Vector3, sourcePanelGroup: THREE.Group) {
  if (!model || !worldPoint || !sourcePanelGroup) return [];

  const sourceWorldQuaternion = sourcePanelGroup.getWorldQuaternion(new THREE.Quaternion());
  const fragments: CutFragment[] = [];

  for (const { panel, object } of model.panelObjects) {
    object.updateMatrixWorld(true);
    const localPoint = object.worldToLocal(worldPoint.clone());

    const overlapsHeartBounds =
      Math.abs(localPoint.x) <= PANEL_HALF + HEART_CUT_RADIUS &&
      Math.abs(localPoint.y) <= PANEL_HALF + HEART_CUT_RADIUS &&
      Math.abs(localPoint.z) <= PANEL_Z_EPS;

    if (!overlapsHeartBounds) continue;

    const panelWorldQuaternion = object.getWorldQuaternion(new THREE.Quaternion());
    const localQuaternion = panelWorldQuaternion.invert().multiply(sourceWorldQuaternion.clone());

    fragments.push({
      panelId: panel.id,
      localX: localPoint.x,
      localY: localPoint.y,
      localQuaternion: localQuaternion.toArray(),
    });
  }

  fragments.sort((a, b) => a.panelId - b.panelId);
  return fragments;
}

function renderStateForUnfoldProgress(foldOps: FoldOp[], startFoldCount: number, progress: number) {
  const total = Math.max(0, Math.min(foldOps.length, Number(startFoldCount) || 0));
  const p = Math.min(1, Math.max(0, Number(progress) || 0));

  if (total === 0) return { committedCount: 0, active: null as ActiveFold };
  if (p <= 0) return { committedCount: total, active: null as ActiveFold };
  if (p >= 1) return { committedCount: 0, active: null as ActiveFold };

  const scaled = p * total;
  const segment = Math.min(total - 1, Math.floor(scaled));
  const segmentProgress = scaled - segment;
  const index = total - 1 - segment;

  return { committedCount: index + 1, active: { type: "unfold", index, progress: segmentProgress } as ActiveFold };
}

function OrigamiSceneManager({
  foldOps,
  committedCount,
  active,
  cuts,
  orbitRef,
  pendingCut,
  onCutPlaced,
}: {
  foldOps: FoldOp[];
  committedCount: number;
  active: ActiveFold;
  cuts: CutFragment[];
  orbitRef: React.MutableRefObject<typeof DEFAULT_ORBIT>;
  pendingCut: { id: string; clientX: number; clientY: number } | null;
  onCutPlaced: (cuts: CutFragment[] | null) => void;
}) {
  const { scene, camera, gl } = useThree();
  const modelRef = useRef<OrigamiModel | null>(null);
  const lastPendingCutIdRef = useRef<string | null>(null);
  const target = useMemo(() => new THREE.Vector3(0, 0, 0), []);

  useEffect(() => {
    scene.background = new THREE.Color("#ffffff");
    const ambient = new THREE.AmbientLight("#ffffff", 0.92);
    const model = createOrigamiRoot(foldOps);
    modelRef.current = model;
    scene.add(ambient, model.root);

    return () => {
      scene.remove(ambient, model.root);
      model.root.traverse((object: any) => {
        if (object.geometry) object.geometry.dispose?.();
        if (object.material) {
          if (Array.isArray(object.material)) object.material.forEach((material: THREE.Material) => material.dispose?.());
          else object.material.dispose?.();
        }
        object.userData?.maskState?.texture?.dispose?.();
      });
    };
  }, [scene, foldOps]);

  useEffect(() => {
    if (!pendingCut || pendingCut.id === lastPendingCutIdRef.current) return;
    lastPendingCutIdRef.current = pendingCut.id;

    const model = modelRef.current;
    if (!model) return;

    updateOrigamiRoot(model, foldOps, committedCount, active, cuts);
    model.root.updateMatrixWorld(true);
    camera.updateMatrixWorld(true);

    const rect = gl.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((pendingCut.clientX - rect.left) / rect.width) * 2 - 1,
      -((pendingCut.clientY - rect.top) / rect.height) * 2 + 1
    );

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(ndc, camera);
    const targets = model.panelObjects.flatMap(({ object }) =>
      object.children.filter((child) => child.type === "Mesh" && child.userData.isPaperSurface)
    );
    const intersects = raycaster.intersectObjects(targets, true);
    const firstHit = intersects.find((hit) => findPanelGroup(hit.object));

    if (!firstHit) {
      onCutPlaced(null);
      return;
    }

    const sourcePanelGroup = findPanelGroup(firstHit.object);
    if (!sourcePanelGroup) {
      onCutPlaced(null);
      return;
    }

    const cutsThroughStack = collectHeartCutFragmentsAtWorldPoint(model, firstHit.point.clone(), sourcePanelGroup);
    onCutPlaced(cutsThroughStack.length > 0 ? cutsThroughStack : null);
  }, [pendingCut, committedCount, active, cuts, camera, gl, onCutPlaced, foldOps]);

  useFrame(() => {
    updateOrigamiRoot(modelRef.current, foldOps, committedCount, active, cuts);
    const desired = cameraPositionFromOrbit(orbitRef.current || DEFAULT_ORBIT);
    camera.position.lerp(desired, 0.22);
    camera.up.set(0, 1, 0);
    camera.lookAt(target);
  });

  return null;
}

function runOrigamiMathTests() {
  const results: { name: string; pass: boolean }[] = [];
  const expect = (name: string, condition: boolean) => results.push({ name, pass: Boolean(condition) });

  const folds = [
    createFoldOp("vertical", 0, 0),
    createFoldOp("vertical", 1, 1),
    createFoldOp("vertical", 2, 2),
    createFoldOp("horizontal", 0, 3),
    createFoldOp("horizontal", 1, 4),
    createFoldOp("horizontal", 2, 5),
  ];

  expect("can create three vertical and three horizontal folds", folds.length === 6);
  expect("third vertical crease is x=1.5", Math.abs(folds[2].line - 1.5) < 0.001);
  expect("third horizontal crease is y=1.5", Math.abs(folds[5].line - 1.5) < 0.001);
  expect(
    "default camera is front-facing",
    Math.abs(cameraPositionFromOrbit(DEFAULT_ORBIT).x) < 0.001 &&
      Math.abs(cameraPositionFromOrbit(DEFAULT_ORBIT).y) < 0.001 &&
      cameraPositionFromOrbit(DEFAULT_ORBIT).z > 0
  );

  const model = createOrigamiRoot([]);
  model.root.updateMatrixWorld(true);
  const sourcePanelGroup = model.panelObjects[27].object;
  const fragments = collectHeartCutFragmentsAtWorldPoint(model, new THREE.Vector3(0, 0, 0), sourcePanelGroup);
  expect("heart cut crossing internal panel boundaries creates fragments on neighboring panels", fragments.length >= 4);

  model.root.traverse((object: any) => {
    object.geometry?.dispose?.();
    if (object.material) {
      if (Array.isArray(object.material)) object.material.forEach((material: THREE.Material) => material.dispose?.());
      else object.material.dispose?.();
    }
    object.userData?.maskState?.texture?.dispose?.();
  });

  return results;
}

export default function App() {
  const [phase, setPhase] = useState("ready");
  const [foldOps, setFoldOps] = useState<FoldOp[]>([]);
  const [committedCount, setCommittedCount] = useState(0);
  const [active, setActive] = useState<ActiveFold>(null);
  const [cuts, setCuts] = useState<CutFragment[]>([]);
  const [placingCut, setPlacingCut] = useState(false);
  const [pendingCut, setPendingCut] = useState<{ id: string; clientX: number; clientY: number } | null>(null);
  const [unfoldScrub, setUnfoldScrub] = useState<{ startFoldCount: number } | null>(null);
  const [unfoldProgress, setUnfoldProgress] = useState(0);
  const [orbitState, setOrbitState] = useState(DEFAULT_ORBIT);

  const orbitRef = useRef(DEFAULT_ORBIT);
  const rafRef = useRef<number | null>(null);
  const unfoldRafRef = useRef<number | null>(null);
  const cutSequenceRef = useRef(1);
  const dragRef = useRef({ active: false, moved: false, pointerId: null as number | null, x: 0, y: 0 });

  useEffect(() => {
    orbitRef.current = orbitState;
  }, [orbitState]);

  useEffect(() => {
    const failed = runOrigamiMathTests().filter((result) => !result.pass);
    if (failed.length > 0) console.warn("Origami math tests failed", failed);
  }, []);

  const cancelCurrentAnimation = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (unfoldRafRef.current) cancelAnimationFrame(unfoldRafRef.current);
    rafRef.current = null;
    unfoldRafRef.current = null;
  }, []);

  const animateProgress = useCallback(
    (duration: number, onProgress: (progress: number) => void) => {
      cancelCurrentAnimation();
      return new Promise<void>((resolve) => {
        const start = performance.now();
        const tick = (now: number) => {
          const progress = Math.min(1, (now - start) / duration);
          onProgress(progress);
          if (progress < 1) {
            rafRef.current = requestAnimationFrame(tick);
          } else {
            rafRef.current = null;
            resolve();
          }
        };
        rafRef.current = requestAnimationFrame(tick);
      });
    },
    [cancelCurrentAnimation]
  );

  const addFold = useCallback(
    async (direction: FoldDirection) => {
      if (phase === "folding" || phase === "unfolding" || placingCut || cuts.length > 0 || Boolean(unfoldScrub)) return;
      const axisFoldIndex = countFoldsByDirection(foldOps, direction);
      if (axisFoldIndex >= MAX_FOLDS_PER_AXIS) return;

      const op = createFoldOp(direction, axisFoldIndex, foldOps.length);
      const nextIndex = foldOps.length;
      const nextFoldOps = [...foldOps, op];
      setFoldOps(nextFoldOps);
      setPhase("folding");
      await animateProgress(FOLD_DURATION_MS, (progress) => setActive({ type: "fold", index: nextIndex, progress }));
      setCommittedCount(nextIndex + 1);
      setActive(null);
      setPhase("ready");
    },
    [animateProgress, cuts.length, foldOps, phase, placingCut, unfoldScrub]
  );

  const startPlacingCut = useCallback(() => {
    if (phase === "folding" || phase === "unfolding" || committedCount === 0) return;
    setPlacingCut(true);
    setPhase("placing-cut");
  }, [committedCount, phase]);

  const handleCutPlaced = useCallback(
    (cut: CutFragment[] | null) => {
      if (!placingCut) return;
      if (!cut) {
        setPlacingCut(false);
        setPhase("ready");
        return;
      }

      const cutList = Array.isArray(cut) ? cut : [cut];
      setCuts((current) => [
        ...current,
        ...cutList.map((item) => ({ ...item, id: `cut-${cutSequenceRef.current++}` })),
      ]);
      setPendingCut(null);
      setPlacingCut(true);
      setPhase("placing-cut");
    },
    [placingCut]
  );

  const unfoldAll = useCallback(() => {
    if (phase === "folding" || phase === "unfolding" || committedCount === 0) return;
    const startFoldCount = committedCount;
    setPhase("unfolding");
    setUnfoldScrub({ startFoldCount });
    setUnfoldProgress(0);

    if (unfoldRafRef.current) cancelAnimationFrame(unfoldRafRef.current);
    const start = performance.now();
    const duration = Math.max(900, startFoldCount * UNFOLD_DURATION_MS + Math.max(0, startFoldCount - 1) * UNFOLD_PAUSE_MS);

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      setUnfoldProgress(progress);
      if (progress < 1) {
        unfoldRafRef.current = requestAnimationFrame(tick);
      } else {
        unfoldRafRef.current = null;
        setPhase("complete");
      }
    };
    unfoldRafRef.current = requestAnimationFrame(tick);
  }, [committedCount, phase]);

  const reset = useCallback(() => {
    cancelCurrentAnimation();
    setPhase("ready");
    setFoldOps([]);
    setCommittedCount(0);
    setActive(null);
    setCuts([]);
    setPlacingCut(false);
    setPendingCut(null);
    setUnfoldScrub(null);
    setUnfoldProgress(0);
    setOrbitState(DEFAULT_ORBIT);
    orbitRef.current = DEFAULT_ORBIT;
    cutSequenceRef.current = 1;
  }, [cancelCurrentAnimation]);

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragRef.current = { active: true, moved: false, pointerId: event.pointerId, x: event.clientX, y: event.clientY };
  }, []);

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag.active || drag.pointerId !== event.pointerId) return;

    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
    drag.x = event.clientX;
    drag.y = event.clientY;

    setOrbitState((current) => {
      const next = {
        ...current,
        yaw: current.yaw - dx * 0.006,
        pitch: Math.min(Math.PI / 2, Math.max(0.08, current.pitch + dy * 0.006)),
      };
      orbitRef.current = next;
      return next;
    });
  }, []);

  const handlePointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      event.currentTarget.releasePointerCapture?.(event.pointerId);
      dragRef.current = { active: false, moved: false, pointerId: null, x: 0, y: 0 };

      if (!drag.moved && placingCut) {
        setPendingCut({ id: `pending-${cutSequenceRef.current++}`, clientX: event.clientX, clientY: event.clientY });
      }
    },
    [placingCut]
  );

  const handleWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    setOrbitState((current) => {
      const next = {
        ...current,
        distance: Math.min(10, Math.max(3, current.distance + event.deltaY * 0.006)),
      };
      orbitRef.current = next;
      return next;
    });
  }, []);

  const scrubRenderState = unfoldScrub ? renderStateForUnfoldProgress(foldOps, unfoldScrub.startFoldCount, unfoldProgress) : null;
  const renderCommittedCount = scrubRenderState ? scrubRenderState.committedCount : committedCount;
  const renderActive = scrubRenderState ? scrubRenderState.active : active;
  const busy = phase === "folding";
  const verticalCount = countFoldsByDirection(foldOps, "vertical");
  const horizontalCount = countFoldsByDirection(foldOps, "horizontal");
  const lockedByCutOrUnfold = cuts.length > 0 || placingCut || Boolean(unfoldScrub);

  return (
    <div className="app">
      <div
        className="canvasLayer"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onWheel={handleWheel}
      >
        <Canvas camera={{ position: [0, 0, DEFAULT_ORBIT.distance], fov: 42, near: 0.1, far: 100 }}>
          <OrigamiSceneManager
            foldOps={foldOps}
            committedCount={renderCommittedCount}
            active={renderActive}
            cuts={cuts}
            orbitRef={orbitRef}
            pendingCut={pendingCut}
            onCutPlaced={handleCutPlaced}
          />
        </Canvas>
      </div>

      <div
        className="controls"
        onPointerDown={(event) => event.stopPropagation()}
        onPointerMove={(event) => event.stopPropagation()}
        onPointerUp={(event) => event.stopPropagation()}
      >
        <button
          onClick={() => addFold("vertical")}
          disabled={busy || verticalCount >= MAX_FOLDS_PER_AXIS || lockedByCutOrUnfold}
          className="controlButton"
        >
          縦に折る {verticalCount}/3
        </button>
        <button
          onClick={() => addFold("horizontal")}
          disabled={busy || horizontalCount >= MAX_FOLDS_PER_AXIS || lockedByCutOrUnfold}
          className="controlButton"
        >
          横に折る {horizontalCount}/3
        </button>
        <button
          onClick={startPlacingCut}
          onPointerUp={(event) => event.stopPropagation()}
          disabled={busy || committedCount === 0 || Boolean(unfoldScrub)}
          title={committedCount === 0 ? "Fold once before cutting" : "Enter cut placement mode"}
          className="controlButton cutButton"
        >
          ♥ cut
        </button>
        <button onClick={unfoldAll} disabled={busy || committedCount === 0 || Boolean(unfoldScrub)} className="controlButton">
          unfold
        </button>
        <button onClick={reset} className="controlButton">
          reset
        </button>
      </div>

      {unfoldScrub && (
        <div
          className="scrubber"
          onPointerDown={(event) => event.stopPropagation()}
          onPointerMove={(event) => event.stopPropagation()}
          onPointerUp={(event) => event.stopPropagation()}
        >
          <input
            type="range"
            min="0"
            max="1"
            step="0.001"
            value={unfoldProgress}
            onPointerDown={() => {
              if (unfoldRafRef.current) cancelAnimationFrame(unfoldRafRef.current);
              unfoldRafRef.current = null;
            }}
            onChange={(event) => {
              const value = Number(event.target.value);
              setUnfoldProgress(value);
              setPhase(value >= 1 ? "complete" : "unfolding");
            }}
          />
          <div className="scrubberLabels">
            <span>folded</span>
            <span>{Math.round(unfoldProgress * 100)}%</span>
            <span>unfolded</span>
          </div>
        </div>
      )}
    </div>
  );
}
