<!--
  知识图谱页：基于 three.js 的 3D 文档关系可视化。
  每个上传文档为一个球体节点（大小随分块数），两两文档平均向量相似度达阈值时以线段相连（颜色随相关度）。
  支持拖拽旋转 / 滚轮缩放 / 悬停查看详情 / 点击或右侧列表聚焦节点。
-->
<template>
  <div class="graph-page">
    <div class="graph-header">
      <span class="toolbar-tip">共 {{ nodes.length }} 个文档节点</span>
      <el-button :loading="loading" @click="loadGraph">
        <el-icon><Refresh /></el-icon>
        刷新
      </el-button>
    </div>

    <div class="graph-body" v-loading="loading">
      <div v-if="empty" class="graph-empty-panel">
        <el-empty description="暂无文档，先去上传资料建立知识库吧" />
      </div>
      <template v-else>
        <!-- 3D 画布 -->
        <div class="graph-canvas">
          <canvas ref="canvasRef" class="gl-canvas"></canvas>

          <!-- 悬停提示 -->
          <div
            v-show="tooltip.visible"
            class="graph-tooltip"
            :style="{ left: tooltip.x + 'px', top: tooltip.y + 'px' }"
          >
            <div class="tooltip-name">{{ tooltip.name }}</div>
            <div class="tooltip-meta">分块 {{ tooltip.chunkCount }} · 关联 {{ tooltip.degree }} 个文档</div>
          </div>

          <!-- 操作提示 -->
          <div class="graph-hint">
            <el-icon><Mouse /></el-icon> 拖拽旋转 · 滚轮缩放 · 点击节点聚焦
          </div>
        </div>

        <!-- 右侧文档列表 -->
        <aside class="graph-side">
          <div class="side-title">文档节点（{{ nodes.length }}）</div>
          <ul v-if="nodes.length > 0" class="node-list">
            <li
              v-for="(node, index) in nodes"
              :key="node.id"
              :class="{ active: selectedIndex === index }"
              @click="focusNode(index)"
            >
              <span class="node-dot" :style="{ background: nodeColor(index) }"></span>
              <span class="node-name" :title="node.name">{{ node.name }}</span>
              <span class="node-count">{{ node.chunkCount }}</span>
            </li>
          </ul>
          <div v-else class="side-empty">暂无文档</div>
        </aside>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { Refresh, Mouse } from '@element-plus/icons-vue';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { GraphNode } from '@ai-knowledge-base/shared';
import { statsApi } from '@/api/stats';

const loading = ref(false);
const canvasRef = ref<HTMLCanvasElement | null>(null);

const nodes = ref<GraphNode[]>([]);
const edges = ref<{ source: number; target: number; weight: number }[]>([]);
const empty = computed(() => !loading.value && nodes.value.length === 0);
const selectedIndex = ref(-1);

const tooltip = ref({
  visible: false,
  x: 0,
  y: 0,
  name: '',
  chunkCount: 0,
  degree: 0,
});

// three.js 运行时引用
let renderer: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene | null = null;
let camera: THREE.PerspectiveCamera | null = null;
let controls: OrbitControls | null = null;
let animationId = 0;
let resizeObserver: ResizeObserver | null = null;

const meshes: THREE.Mesh[] = [];
const baseColors: THREE.Color[] = [];
const positions: THREE.Vector3[] = [];
const degreeByIndex: number[] = [];
const hues: number[] = [];
const posById = new Map<number, number>();
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

// 聚焦动画状态
const focusFrom = new THREE.Vector3();
const focusTo = new THREE.Vector3();
const cameraTargetFrom = new THREE.Vector3();
const cameraTargetTo = new THREE.Vector3();
let focusProgress = 1;
let hasFocusTarget = false;

/** 依据关联度取色相：无关联为灰，关联越多越偏暖（蓝 → 橙），-1 表示灰色 */
const colorForIndex = (index: number): THREE.Color => {
  const hue = hues[index];
  if (hue !== undefined && hue >= 0) {
    return new THREE.Color().setHSL(hue / 360, 0.85, 0.55);
  }
  return new THREE.Color('#64748b');
};

/** 右侧列表节点色点，与 3D 球体颜色保持一致 */
const nodeColor = (index: number) => {
  const hue = hues[index];
  return hue !== undefined && hue >= 0 ? `hsl(${hue}, 85%, 55%)` : 'hsl(220, 10%, 55%)';
};

/** 生成文本标签精灵（canvas 纹理，支持中文） */
const createLabel = (text: string): THREE.Sprite => {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = 'bold 26px "Microsoft YaHei", "PingFang SC", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.75)';
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#ffffff';
    const display = text.length > 14 ? `${text.slice(0, 14)}…` : text;
    ctx.fillText(display, canvas.width / 2, canvas.height / 2);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(5, 1.25, 1);
  return sprite;
};

/** 计算节点度数（关联边数）与对应色相 */
const computeHues = () => {
  hues.length = 0;
  degreeByIndex.length = 0;
  for (let i = 0; i < nodes.value.length; i += 1) {
    degreeByIndex.push(0);
  }
  for (const edge of edges.value) {
    const s = posById.get(edge.source);
    const t = posById.get(edge.target);
    if (s === undefined || t === undefined) continue;
    degreeByIndex[s] += 1;
    degreeByIndex[t] += 1;
  }
  const maxDegree = Math.max(1, ...degreeByIndex);
  for (let i = 0; i < nodes.value.length; i += 1) {
    const degree = degreeByIndex[i];
    hues.push(degree > 0 ? 209 - (degree / maxDegree) * 144 : -1);
  }
};

const buildScene = () => {
  if (!canvasRef.value) return;
  const container = canvasRef.value.parentElement as HTMLElement;
  if (!container) return;
  const width = container.clientWidth || 1;
  const height = container.clientHeight || 1;

  scene = new THREE.Scene();
  scene.background = new THREE.Color('#0b1424');

  camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);

  renderer = new THREE.WebGLRenderer({ canvas: canvasRef.value, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;

  scene.add(new THREE.AmbientLight(0xffffff, 0.8));
  const keyLight = new THREE.PointLight(0xffffff, 0.7);
  keyLight.position.set(20, 30, 20);
  scene.add(keyLight);
  const fillLight = new THREE.PointLight(0x4a8cff, 0.5);
  fillLight.position.set(-25, -15, -30);
  scene.add(fillLight);

  // 背景星星
  const starCount = 400;
  const starPositions = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i += 1) {
    starPositions[i * 3] = (Math.random() - 0.5) * 220;
    starPositions[i * 3 + 1] = (Math.random() - 0.5) * 220;
    starPositions[i * 3 + 2] = (Math.random() - 0.5) * 220;
  }
  const starGeometry = new THREE.BufferGeometry();
  starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  const stars = new THREE.Points(
    starGeometry,
    new THREE.PointsMaterial({ color: 0xffffff, size: 0.16, transparent: true, opacity: 0.55 }),
  );
  scene.add(stars);

  // 斐波那契球面布局
  const count = nodes.value.length;
  const radius = Math.max(7, Math.cbrt(count) * 5.5);
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  positions.length = 0;
  posById.clear();
  for (let i = 0; i < count; i += 1) {
    const y = 1 - (i / Math.max(1, count - 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = goldenAngle * i;
    const position = new THREE.Vector3(Math.cos(theta) * r, y * 0.85, Math.sin(theta) * r).multiplyScalar(radius);
    positions.push(position);
    posById.set(nodes.value[i].id, i);
  }

  computeHues();

  // 节点球体 + 标签
  meshes.length = 0;
  baseColors.length = 0;
  for (let i = 0; i < count; i += 1) {
    const node = nodes.value[i];
    const size = Math.min(1.6, 0.55 + Math.cbrt(node.chunkCount) * 0.16);
    const geometry = new THREE.SphereGeometry(size, 24, 24);
    const color = colorForIndex(i);
    baseColors.push(color.clone());
    const material = new THREE.MeshPhongMaterial({
      color,
      emissive: color.clone().multiplyScalar(0.25),
      shininess: 40,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(positions[i]);
    mesh.userData.index = i;
    scene.add(mesh);
    meshes.push(mesh);

    const label = createLabel(node.name);
    label.position.copy(positions[i]);
    label.position.y += size + 0.9;
    scene.add(label);
  }

  // 关联连线（顶点着色，颜色随相关度）
  const linePositions: number[] = [];
  const lineColors: number[] = [];
  for (const edge of edges.value) {
    const s = posById.get(edge.source);
    const t = posById.get(edge.target);
    if (s === undefined || t === undefined) continue;
    const a = positions[s];
    const b = positions[t];
    linePositions.push(a.x, a.y, a.z, b.x, b.y, b.z);
    const edgeColor = new THREE.Color().setHSL(0.58 - edge.weight * 0.3, 0.85, 0.55);
    lineColors.push(edgeColor.r, edgeColor.g, edgeColor.b, edgeColor.r, edgeColor.g, edgeColor.b);
  }
  if (linePositions.length > 0) {
    const lineGeometry = new THREE.BufferGeometry();
    lineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
    lineGeometry.setAttribute('color', new THREE.Float32BufferAttribute(lineColors, 3));
    const lineMaterial = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.7,
    });
    scene.add(new THREE.LineSegments(lineGeometry, lineMaterial));
  }

  // 相机初始位置与目标
  camera.position.set(radius * 1.5, radius * 0.8, radius * 1.9);
  controls.target.set(0, 0, 0);
  controls.update();

  // 事件绑定
  renderer.domElement.addEventListener('pointermove', onPointerMove);
  renderer.domElement.addEventListener('pointerleave', onPointerLeave);
  renderer.domElement.addEventListener('click', onCanvasClick);

  resizeObserver = new ResizeObserver(onResize);
  resizeObserver.observe(container);

  animate();
};

/** 将事件坐标换算为 NDC，并同步 raycaster 指针 */
const getPointerNDC = (event: PointerEvent): boolean => {
  if (!renderer) return false;
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  return true;
};

const onPointerMove = (event: PointerEvent) => {
  if (!renderer || !camera || !getPointerNDC(event)) return;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(meshes, false);
  if (hits.length > 0) {
    const index = hits[0].object.userData.index as number;
    const node = nodes.value[index];
    const rect = renderer.domElement.getBoundingClientRect();
    tooltip.value = {
      visible: true,
      x: event.clientX - rect.left + 14,
      y: event.clientY - rect.top + 14,
      name: node.name,
      chunkCount: node.chunkCount,
      degree: degreeByIndex[index] ?? 0,
    };
    renderer.domElement.style.cursor = 'pointer';
  } else {
    tooltip.value.visible = false;
    renderer.domElement.style.cursor = 'grab';
  }
};

const onPointerLeave = () => {
  tooltip.value.visible = false;
};

const onCanvasClick = (event: PointerEvent) => {
  if (!renderer || !camera || !getPointerNDC(event)) return;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(meshes, false);
  if (hits.length > 0) {
    focusNode(hits[0].object.userData.index as number);
  } else {
    selectedIndex.value = -1;
  }
};

/** 聚焦某节点：相机与目标点平滑移动到该节点附近 */
const focusNode = (index: number) => {
  if (!camera || !controls) return;
  const target = positions[index];
  if (!target) return;
  selectedIndex.value = index;
  focusFrom.copy(camera.position);
  cameraTargetFrom.copy(controls.target);
  focusTo.copy(target).add(new THREE.Vector3(5.5, 4, 5.5));
  cameraTargetTo.copy(target);
  focusProgress = 0;
  hasFocusTarget = true;
};

const animate = () => {
  animationId = requestAnimationFrame(animate);
  if (controls) {
    controls.update();
  }

  if (hasFocusTarget && camera && controls) {
    focusProgress = Math.min(1, focusProgress + 0.035);
    const eased = 1 - Math.pow(1 - focusProgress, 3);
    camera.position.lerpVectors(focusFrom, focusTo, eased);
    controls.target.lerpVectors(cameraTargetFrom, cameraTargetTo, eased);
    if (focusProgress >= 1) {
      hasFocusTarget = false;
    }
  }

  for (let i = 0; i < meshes.length; i += 1) {
    const material = meshes[i].material as THREE.MeshPhongMaterial;
    if (i === selectedIndex.value) {
      material.color.set('#ffd166');
      material.emissive.set('#ffd166').multiplyScalar(0.7);
    } else {
      material.color.copy(baseColors[i]);
      material.emissive.copy(baseColors[i]).multiplyScalar(0.25);
    }
  }

  if (renderer && scene && camera) {
    renderer.render(scene, camera);
  }
};

const onResize = () => {
  if (!renderer || !camera || !canvasRef.value) return;
  const container = canvasRef.value.parentElement as HTMLElement;
  if (!container) return;
  const width = container.clientWidth;
  const height = container.clientHeight;
  if (width === 0 || height === 0) return;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
};

const disposeScene = () => {
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = 0;
  }
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
  if (renderer) {
    renderer.domElement.removeEventListener('pointermove', onPointerMove);
    renderer.domElement.removeEventListener('pointerleave', onPointerLeave);
    renderer.domElement.removeEventListener('click', onCanvasClick);
    renderer.dispose();
    renderer = null;
  }
  scene = null;
  camera = null;
  controls = null;
  meshes.length = 0;
  baseColors.length = 0;
  positions.length = 0;
  degreeByIndex.length = 0;
  hues.length = 0;
  posById.clear();
  selectedIndex.value = -1;
  tooltip.value.visible = false;
  hasFocusTarget = false;
  focusProgress = 1;
};

const loadGraph = async () => {
  loading.value = true;
  try {
    const data = await statsApi.getGraph();
    nodes.value = data.nodes;
    edges.value = data.edges;
    disposeScene();
    if (data.nodes.length > 0) {
      await nextTick();
      buildScene();
    }
  } catch (error) {
    console.error(error);
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  loadGraph();
});

onBeforeUnmount(() => {
  disposeScene();
});
</script>

<style scoped>
.graph-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #fff;
}

.graph-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  border-bottom: 1px solid #e4e7ed;
  background: #fff;
  flex-shrink: 0;
}

.toolbar-tip {
  font-size: 12px;
  color: #909399;
}

.graph-body {
  flex: 1;
  display: flex;
  overflow: hidden;
  min-height: 0;
}

.graph-canvas {
  position: relative;
  flex: 1;
  background: radial-gradient(ellipse at center, #16233b 0%, #0b1424 100%);
  overflow: hidden;
}

.gl-canvas {
  display: block;
  width: 100%;
  height: 100%;
}

.graph-tooltip {
  position: absolute;
  z-index: 10;
  pointer-events: none;
  background: rgba(13, 21, 38, 0.92);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 13px;
  max-width: 260px;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4);
}

.tooltip-name {
  font-weight: 600;
  margin-bottom: 4px;
  word-break: break-all;
}

.tooltip-meta {
  color: rgba(255, 255, 255, 0.7);
  font-size: 12px;
}

.graph-hint {
  position: absolute;
  left: 12px;
  bottom: 12px;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.55);
  pointer-events: none;
}

.graph-side {
  width: 280px;
  flex-shrink: 0;
  background: #fff;
  border-left: 1px solid #e4e7ed;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.side-title {
  padding: 14px 16px;
  font-size: 14px;
  font-weight: 600;
  border-bottom: 1px solid #f0f2f5;
  color: #303133;
}

.node-list {
  flex: 1;
  overflow-y: auto;
  list-style: none;
  margin: 0;
  padding: 8px;
}

.node-list::-webkit-scrollbar {
  width: 6px;
}

.node-list::-webkit-scrollbar-thumb {
  background: #e0e0e0;
  border-radius: 3px;
}

.node-list::-webkit-scrollbar-thumb:hover {
  background: #c0c4cc;
}

.node-list::-webkit-scrollbar-track {
  background: transparent;
}

.node-list li {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.2s;
}

.node-list li:hover {
  background: #f5f7fa;
}

.node-list li.active {
  background: #ecf5ff;
}

.node-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.node-name {
  flex: 1;
  font-size: 13px;
  color: #303133;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.node-count {
  font-size: 12px;
  color: #909399;
  flex-shrink: 0;
}

.side-empty {
  padding: 24px;
  text-align: center;
  color: #909399;
  font-size: 13px;
}

.graph-empty-panel {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
