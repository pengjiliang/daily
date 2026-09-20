<!--
  知识图谱页：基于 three.js 的 3D 文档关系可视化（炫酷增强版）。
  - 力导向聚类布局：内容相关的文档自动聚成簇，一眼看出主题归类；
  - 连线分级：颜色/粗细映射相关度（蓝→紫→品红→橙），支持“关联度下限”筛选；
  - 交互：悬停节点高亮其关联边、悬停连线显示相关度、点击节点聚焦所在簇、点空白恢复全景；
  - 特效：节点辉光光晕 + 倾斜自转光环 + 上下浮动、连线流动光点、UnrealBloom 泛光、星云雾背景、
    开场扩散动画、idle 自动环绕。
-->
<template>
  <div class="graph-page">
    <div class="graph-header">
      <span class="toolbar-tip">
        {{
          mode === 'doc'
            ? `共 ${nodes.length} 个文档节点 · 关联 ${visibleEdgeCount} 条`
            : `共 ${nodes.length} 个实体 · 关系 ${visibleEdgeCount} 条`
        }}
      </span>
      <div class="header-tools">
        <el-radio-group v-model="mode" size="small" class="graph-mode-toggle">
          <el-radio-button value="doc">文档图谱</el-radio-button>
          <el-radio-button value="entity">实体图谱</el-radio-button>
        </el-radio-group>
        <label class="hd-toggle">
          <el-switch v-model="autoRotate" size="small" />
          <span>自动旋转</span>
        </label>
        <label class="hd-toggle">
          <el-switch v-model="showLabels" size="small" />
          <span>标签</span>
        </label>
        <el-button size="small" @click="resetView">重置视角</el-button>
        <el-button size="small" :loading="loading" @click="loadGraph(true)">
          <el-icon><Refresh /></el-icon> 刷新
        </el-button>
      </div>
    </div>

    <div class="graph-body" v-loading="loading">
      <div v-if="empty" class="graph-empty-panel">
        <el-empty
          :description="
            mode === 'doc'
              ? '暂无文档，先去上传资料建立知识库吧'
              : '暂无实体数据：上传文档并完成索引后会自动提取实体关系'
          "
        />
      </div>
      <template v-else>
        <div class="graph-canvas">
          <canvas ref="canvasRef" class="gl-canvas"></canvas>

          <!-- 关联度筛选（仅文档图谱） -->
          <div v-if="mode === 'doc'" class="graph-controls">
            <div class="control-title">关联度筛选</div>
            <div class="control-row">
              <span class="control-label">下限</span>
              <el-slider
                v-model="minWeight"
                :min="0.5"
                :max="0.95"
                :step="0.05"
                :show-tooltip="false"
                size="small"
                class="weight-slider"
                @change="onWeightChange"
              />
            </div>
            <div class="control-hint">拖高只显示强关联</div>
          </div>

          <!-- 图例 -->
          <div class="graph-legend">
            <template v-if="mode === 'doc'">
              <div class="legend-title">相关度</div>
              <div class="legend-bar"></div>
              <div class="legend-labels"><span>低</span><span>高</span></div>
              <div class="legend-note">连线颜色 / 粗细代表两文档内容相关度</div>
            </template>
            <template v-else>
              <div class="legend-title">实体类型</div>
              <div class="type-legend">
                <span v-for="type in entityTypesInUse" :key="type" class="type-legend-item">
                  <span class="type-dot" :style="{ background: typeColorCss(type) }"></span>{{ type }}
                </span>
              </div>
              <div class="legend-note">节点颜色代表实体类型，连线代表实体间的关系</div>
            </template>
          </div>

          <!-- 悬停提示 -->
          <div
            v-show="tooltip.visible"
            class="graph-tooltip"
            :style="{ left: tooltip.x + 'px', top: tooltip.y + 'px' }"
          >
            <div class="tooltip-name">{{ tooltip.name }}</div>
            <div class="tooltip-meta">{{ tooltip.meta }}</div>
          </div>

          <div class="graph-hint">
            <el-icon><Mouse /></el-icon> 拖拽旋转 · 滚轮缩放 · 悬停连线看{{ mode === 'doc' ? '相关度' : '关系' }} ·
            点击节点聚焦
          </div>
        </div>

        <aside class="graph-side">
          <div class="side-title">
            {{ mode === 'doc' ? `文档节点（${nodes.length}）` : `实体节点（${nodes.length}）` }}
          </div>
          <ul v-if="nodes.length > 0" class="node-list">
            <li
              v-for="(node, index) in nodes"
              :key="node.id"
              :class="{ active: selectedIndex === index }"
              @click="focusNode(index)"
            >
              <span class="node-dot" :style="{ background: nodeColor(index) }"></span>
              <span class="node-name" :title="node.name">{{ node.name }}</span>
              <span class="node-count">{{ mode === 'doc' ? node.chunkCount : (node.entityType ?? '其他') }}</span>
            </li>
          </ul>
          <div v-else class="side-empty">{{ mode === 'doc' ? '暂无文档' : '暂无实体' }}</div>
        </aside>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { Refresh, Mouse } from '@element-plus/icons-vue';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import type { EntityGraphData, GraphEdge, GraphNode } from '@ai-knowledge-base/shared';
import { statsApi } from '@/api/stats';

/** 渲染用节点：文档节点直接使用，实体节点附加 entityType / fileName */
interface RenderNode extends GraphNode {
  entityType?: string;
  fileName?: string | null;
}

/** 渲染用连线：文档连线直接用 weight，实体连线附加关系文本 label */
interface RenderEdge {
  source: number;
  target: number;
  weight: number;
  label?: string;
}

/** 单条关联边（Line2 管线，支持线宽与逐边透明度） */
interface EdgeObj {
  line: Line2;
  geo: LineGeometry;
  material: LineMaterial;
  a: number;
  b: number;
  weight: number;
  /** 实体模式下：关系描述（悬停连线时展示） */
  label?: string;
  color: THREE.Color;
  active: boolean;
}

// ---------- 响应式状态 ----------
const loading = ref(false);
const canvasRef = ref<HTMLCanvasElement | null>(null);
const nodes = ref<RenderNode[]>([]);
const edges = ref<RenderEdge[]>([]);
const empty = computed(() => !loading.value && nodes.value.length === 0);
const selectedIndex = ref(-1);
const autoRotate = ref(false);
const showLabels = ref(true);
const minWeight = ref(0.5);

/** 图谱模式：doc=文档图谱（默认）/ entity=实体级知识图谱 */
const mode = ref<'doc' | 'entity'>('doc');
const isEntityMode = computed(() => mode.value === 'entity');
/** 文档图谱原始数据（切换模式后仍保留，避免重复请求） */
const docNodes = ref<GraphNode[]>([]);
const docEdges = ref<GraphEdge[]>([]);
/** 实体图谱原始数据 */
const entityData = ref<EntityGraphData>({ entities: [], relations: [] });
/** 当前节点中出现的实体类型（图例展示用） */
const entityTypesInUse = computed(() => {
  const types = new Set<string>();
  for (const node of nodes.value) {
    if (node.entityType) {
      types.add(node.entityType);
    }
  }
  return Array.from(types);
});

const visibleEdgeCount = computed(
  () => edges.value.filter((e) => e.weight >= minWeight.value).length,
);

const tooltip = ref({ visible: false, x: 0, y: 0, name: '', meta: '' });

// ---------- three.js 运行时 ----------
let renderer: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene | null = null;
let camera: THREE.PerspectiveCamera | null = null;
let controls: OrbitControls | null = null;
let composer: EffectComposer | null = null;
let bloomPass: UnrealBloomPass | null = null;
let nebula: THREE.Points | null = null;
let animationId = 0;
let resizeObserver: ResizeObserver | null = null;
let glowTexture: THREE.Texture | null = null;

const meshes: THREE.Mesh[] = [];
const baseColors: THREE.Color[] = [];
const positions: THREE.Vector3[] = [];
const sizes: number[] = [];
const phases: number[] = [];
const degreeByIndex: number[] = [];
const hues: number[] = [];
const labels: THREE.Sprite[] = [];
const halos: THREE.Sprite[] = [];
const rings: THREE.Mesh[] = [];
const nodeOpacity: number[] = [];
const edgeObjs: EdgeObj[] = [];
const edgeOpacity: number[] = [];
const posById = new Map<number, number>();
const introFactor: number[] = [];

let particlePoints: THREE.Points | null = null;
let particlePosAttr: THREE.BufferAttribute | null = null;
let particleColAttr: THREE.BufferAttribute | null = null;
let particleT: Float32Array = new Float32Array(0);

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

// 悬停 / 聚焦状态（非响应式，动画循环内直接读取）
let hoverIndex = -1;
let edgeHoverObj: EdgeObj | null = null;

// 聚焦动画状态
const focusFrom = new THREE.Vector3();
const focusTo = new THREE.Vector3();
const cameraTargetFrom = new THREE.Vector3();
const cameraTargetTo = new THREE.Vector3();
let focusProgress = 1;
let hasFocusTarget = false;
const overviewPos = new THREE.Vector3();

// 开场动画状态
let introStart = 0;
let introDone = false;

// ---------- 配色 ----------
/** 依据关联度取色相：无关联为灰，关联越多越偏暖（蓝 → 橙） */
const colorForIndex = (index: number): THREE.Color => {
  const hue = hues[index];
  if (hue !== undefined && hue >= 0) {
    return new THREE.Color().setHSL(hue / 360, 0.85, 0.58);
  }
  return new THREE.Color('#64748b');
};

/** 右侧列表节点色点，与 3D 球体颜色保持一致 */
const nodeColor = (index: number) => {
  const hue = hues[index];
  return hue !== undefined && hue >= 0 ? `hsl(${hue}, 85%, 58%)` : 'hsl(220, 10%, 55%)';
};

// ---------- 实体图谱配色 ----------
/** 实体类型 → 色相：人物蓝 / 组织绿 / 地点橙 / 概念紫 / 项目粉 / 产品青 / 事件红 / 其他灰蓝 */
const ENTITY_TYPE_HUES: Record<string, number> = {
  人物: 210,
  组织: 130,
  地点: 32,
  概念: 278,
  项目: 335,
  产品: 190,
  事件: 0,
  其他: 220,
};

/** 实体类型 → 色相（未知类型按名称哈希取色，保证稳定） */
const entityHueFor = (type: string): number => {
  const hue = ENTITY_TYPE_HUES[type];
  if (hue !== undefined) {
    return hue;
  }
  let hash = 0;
  for (const ch of type) {
    hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  }
  return hash % 360;
};

/** 实体类型 → CSS 颜色（侧栏/图例小圆点） */
const typeColorCss = (type: string): string => {
  return `hsl(${entityHueFor(type)}, 80%, 58%)`;
};

/** 关系文本 → 连线颜色（按关系哈希取色，同一关系颜色一致） */
const relationColorFor = (label: string): THREE.Color => {
  let hash = 0;
  for (const ch of label) {
    hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  }
  return new THREE.Color().setHSL((hash % 360) / 360, 0.7, 0.62);
};

/** 连线相关度 → 颜色（低蓝 → 紫 → 品红 → 橙） */
const EDGE_STOPS: { w: number; color: THREE.Color }[] = [
  { w: 0.5, color: new THREE.Color('#22d3ee') },
  { w: 0.65, color: new THREE.Color('#818cf8') },
  { w: 0.8, color: new THREE.Color('#e879f9') },
  { w: 0.95, color: new THREE.Color('#fb923c') },
];

const edgeColorFor = (weight: number): THREE.Color => {
  const stops = EDGE_STOPS;
  if (weight <= stops[0].w) return stops[0].color.clone();
  if (weight >= stops[stops.length - 1].w) return stops[stops.length - 1].color.clone();
  for (let i = 0; i < stops.length - 1; i += 1) {
    const from = stops[i];
    const to = stops[i + 1];
    if (weight >= from.w && weight <= to.w) {
      const ratio = (weight - from.w) / (to.w - from.w);
      return new THREE.Color().lerpColors(from.color, to.color, ratio);
    }
  }
  return stops[0].color.clone();
};

/** 连线粗细分级 */
const lineWidthFor = (weight: number): number => {
  if (weight >= 0.8) return 3.4;
  if (weight >= 0.65) return 2.4;
  return 1.6;
};

// ---------- 工具 ----------
const easeOutBack = (p: number): number => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const x = p - 1;
  const v = 1 + c3 * x * x * x + c1 * x * x;
  return v < 0 ? 0 : v;
};

const distPointSeg = (px: number, py: number, ax: number, ay: number, bx: number, by: number): number => {
  const abx = bx - ax;
  const aby = by - ay;
  const len2 = abx * abx + aby * aby;
  let t = len2 === 0 ? 0 : ((px - ax) * abx + (py - ay) * aby) / len2;
  t = Math.max(0, Math.min(1, t));
  const dx = px - (ax + abx * t);
  const dy = py - (ay + aby * t);
  return Math.sqrt(dx * dx + dy * dy);
};

/** 按画布可用宽度把文本拆成多行（兼容中英文，按实际像素宽换行） */
const wrapLabelLines = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] => {
  const lines: string[] = [];
  let current = '';
  for (const ch of text) {
    const test = current + ch;
    if (current !== '' && ctx.measureText(test).width > maxWidth) {
      lines.push(current);
      current = ch;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
};

/** 生成文本标签精灵（canvas 纹理，支持中文；超长自动换行，最多 3 行） */
const createLabel = (text: string): THREE.Sprite => {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  const ctx = canvas.getContext('2d');
  const font = 'bold 26px "Microsoft YaHei", "PingFang SC", sans-serif';
  if (ctx) {
    ctx.font = font;
    const maxWidth = 232; // 画布内文字可用宽度（两侧预留阴影边距）
    const lineHeight = 32;
    const maxLines = 3;
    const lines = wrapLabelLines(ctx, text, maxWidth);
    const truncated = lines.length > maxLines;
    const drawn = lines.slice(0, maxLines);
    // 超过 3 行时末行补省略号，并保证末行不超宽
    if (truncated) {
      let last = drawn[maxLines - 1];
      while (last.length > 1 && ctx.measureText(`${last}…`).width > maxWidth) {
        last = last.slice(0, -1);
      }
      drawn[maxLines - 1] = `${last}…`;
    }
    const height = Math.max(64, drawn.length * lineHeight + 20);
    canvas.height = height;
    // canvas 尺寸变化会重置 2d 上下文状态，需重新设置
    ctx.font = font;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.75)';
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#ffffff';
    const startY = height / 2 - ((drawn.length - 1) * lineHeight) / 2;
    drawn.forEach((line, i) => {
      ctx.fillText(line, canvas.width / 2, startY + i * lineHeight);
    });
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  const worldWidth = 5;
  // 高度按行数随画布宽高比缩放，避免多行文字被压扁或拉伸
  sprite.scale.set(worldWidth, (worldWidth * canvas.height) / canvas.width, 1);
  // 标签单独放在 layer 1：泛光（layer 0）不作用于它，避免白色文字被糊亮
  sprite.layers.set(1);
  return sprite;
};

/** 径向渐变光晕纹理（供节点 halo 使用） */
const makeGlowTexture = (): THREE.Texture => {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.3, 'rgba(255,255,255,0.55)');
    gradient.addColorStop(0.7, 'rgba(255,255,255,0.15)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
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
  // 实体图谱：按实体类型取色（与关联度无关）；文档图谱：按度数取色
  if (isEntityMode.value) {
    for (let i = 0; i < nodes.value.length; i += 1) {
      hues.push(entityHueFor(nodes.value[i].entityType ?? '其他'));
    }
    return;
  }
  const maxDegree = Math.max(1, ...degreeByIndex);
  for (let i = 0; i < nodes.value.length; i += 1) {
    const degree = degreeByIndex[i];
    hues.push(degree > 0 ? 209 - (degree / maxDegree) * 200 : -1);
  }
};

/** 3D 力导向布局：相关度高的文档互相靠近，聚成内容簇 */
const runForceLayout = (seed: THREE.Vector3[]): THREE.Vector3[] => {
  const count = seed.length;
  const pos = seed.map((p) => p.clone());
  const vel = Array.from({ length: count }, () => new THREE.Vector3());
  const edgePairs: { a: number; b: number; w: number }[] = [];
  for (const edge of edges.value) {
    const s = posById.get(edge.source);
    const t = posById.get(edge.target);
    if (s === undefined || t === undefined) continue;
    edgePairs.push({ a: s, b: t, w: edge.weight });
  }

  const iterations = count <= 60 ? 220 : count <= 120 ? 160 : 110;
  const repulsion = 0.95;
  const springK = 0.032;
  const gravity = 0.02;
  const damping = 0.82;
  const maxStep = 1.1;
  const repulsionSample = count > 160 ? 48 : count;

  for (let iter = 0; iter < iterations; iter += 1) {
    // 斥力（节点过多时随机抽样，保证性能）
    for (let i = 0; i < count; i += 1) {
      for (let k = 0; k < repulsionSample; k += 1) {
        let j = Math.floor(Math.random() * count);
        if (j === i) j = (j + 1) % count;
        const dx = pos[i].x - pos[j].x;
        const dy = pos[i].y - pos[j].y;
        const dz = pos[i].z - pos[j].z;
        const dist2 = dx * dx + dy * dy + dz * dz + 0.01;
        const dist = Math.sqrt(dist2);
        const f = repulsion / dist2;
        const fx = (dx / dist) * f;
        const fy = (dy / dist) * f;
        const fz = (dz / dist) * f;
        vel[i].x += fx;
        vel[i].y += fy;
        vel[i].z += fz;
        vel[j].x -= fx;
        vel[j].y -= fy;
        vel[j].z -= fz;
      }
    }
    // 边引力（弹簧，把相关文档拉近）
    for (const { a, b, w } of edgePairs) {
      const dx = pos[b].x - pos[a].x;
      const dy = pos[b].y - pos[a].y;
      const dz = pos[b].z - pos[a].z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.01;
      const f = springK * w * dist;
      const fx = (dx / dist) * f;
      const fy = (dy / dist) * f;
      const fz = (dz / dist) * f;
      vel[a].x += fx;
      vel[a].y += fy;
      vel[a].z += fz;
      vel[b].x -= fx;
      vel[b].y -= fy;
      vel[b].z -= fz;
    }
    // 中心引力，保持整体居中
    for (let i = 0; i < count; i += 1) {
      vel[i].x -= pos[i].x * gravity;
      vel[i].y -= pos[i].y * gravity;
      vel[i].z -= pos[i].z * gravity;
    }
    // 积分 + 阻尼限速
    for (let i = 0; i < count; i += 1) {
      vel[i].multiplyScalar(damping);
      const speed = vel[i].length();
      if (speed > maxStep) vel[i].multiplyScalar(maxStep / speed);
      pos[i].add(vel[i]);
    }
  }

  // 归一到原点并按节点数缩放到目标半径
  let maxR = 0.0001;
  for (const p of pos) {
    const r = p.length();
    if (r > maxR) maxR = r;
  }
  const targetRadius = Math.max(7, Math.cbrt(count) * 6.2);
  const scale = targetRadius / maxR;
  for (const p of pos) p.multiplyScalar(scale);
  return pos;
};

// ---------- 高亮交互 ----------
const neighborsOf = (index: number): Set<number> => {
  const set = new Set<number>();
  for (const e of edgeObjs) {
    if (e.a === index) set.add(e.b);
    else if (e.b === index) set.add(e.a);
  }
  return set;
};

/** 依据当前悬停/选中状态，计算每个节点与连线的目标透明度 */
const updateHighlight = () => {
  const focus = selectedIndex.value >= 0 ? selectedIndex.value : hoverIndex;
  nodeOpacity.length = nodes.value.length;
  const neighbors = focus >= 0 ? neighborsOf(focus) : null;
  for (let i = 0; i < nodes.value.length; i += 1) {
    nodeOpacity[i] = focus >= 0 ? (i === focus || neighbors?.has(i) ? 1 : 0.22) : 1;
  }
  edgeOpacity.length = edgeObjs.length;
  for (let k = 0; k < edgeObjs.length; k += 1) {
    const e = edgeObjs[k];
    let op = e.weight < 0.65 ? 0.55 : 0.75;
    if (edgeHoverObj === e) {
      op = 1;
    } else if (focus >= 0) {
      op = e.a === focus || e.b === focus ? 1 : 0.05;
    }
    edgeOpacity[k] = op;
  }
  updateParticleColors();
};

/** 连线流动光点颜色随高亮同步变暗/变亮 */
const updateParticleColors = () => {
  if (!particleColAttr) return;
  const colors = particleColAttr.array as Float32Array;
  for (let k = 0; k < edgeObjs.length; k += 1) {
    const v = Math.max(edgeOpacity[k] ?? 0.05, 0.04);
    colors[k * 3] = v;
    colors[k * 3 + 1] = v;
    colors[k * 3 + 2] = v;
  }
  particleColAttr.needsUpdate = true;
};

// ---------- 场景构建 ----------
/** 重建关联连线（按 minWeight 过滤）与流动粒子 */
const rebuildEdges = () => {
  if (!scene || !renderer || !camera) return;
  // 清掉旧连线与粒子
  for (const e of edgeObjs) {
    scene.remove(e.line);
    e.geo.dispose();
    e.material.dispose();
  }
  edgeObjs.length = 0;
  if (particlePoints) {
    scene.remove(particlePoints);
    (particlePoints.geometry as THREE.BufferGeometry).dispose();
    (particlePoints.material as THREE.Material).dispose();
    particlePoints = null;
    particlePosAttr = null;
    particleColAttr = null;
  }

  const width = renderer.domElement.clientWidth || 1;
  const height = renderer.domElement.clientHeight || 1;
  const activeEdges: EdgeObj[] = [];

  for (const edge of edges.value) {
    // 文档图谱按关联度下限过滤；实体图谱显示全部关系
    if (!isEntityMode.value && edge.weight < minWeight.value) continue;
    const s = posById.get(edge.source);
    const t = posById.get(edge.target);
    if (s === undefined || t === undefined) continue;
    const a = positions[s];
    const b = positions[t];
    const color = isEntityMode.value ? relationColorFor(edge.label ?? '') : edgeColorFor(edge.weight);
    const geo = new LineGeometry();
    geo.setPositions([a.x, a.y, a.z, b.x, b.y, b.z]);
    const material = new LineMaterial({
      color,
      linewidth: isEntityMode.value ? 2.2 : lineWidthFor(edge.weight),
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
    });
    material.resolution.set(width, height);
    const line = new Line2(geo, material);
    scene.add(line);
    const obj: EdgeObj = {
      line,
      geo,
      material,
      a: s,
      b: t,
      weight: edge.weight,
      label: edge.label,
      color,
      active: true,
    };
    activeEdges.push(obj);
    edgeObjs.push(obj);
  }

  // 连线流动光点（沿边运动的粒子流）
  if (activeEdges.length > 0) {
    const count = activeEdges.length;
    particleT = new Float32Array(count);
    const posArr = new Float32Array(count * 3);
    const colArr = new Float32Array(count * 3);
    for (let k = 0; k < count; k += 1) {
      particleT[k] = Math.random();
      colArr[k * 3] = 1;
      colArr[k * 3 + 1] = 1;
      colArr[k * 3 + 2] = 1;
    }
    const geometry = new THREE.BufferGeometry();
    particlePosAttr = new THREE.BufferAttribute(posArr, 3);
    particleColAttr = new THREE.BufferAttribute(colArr, 3);
    geometry.setAttribute('position', particlePosAttr);
    geometry.setAttribute('color', particleColAttr);
    const material = new THREE.PointsMaterial({
      size: 0.42,
      vertexColors: true,
      transparent: true,
      opacity: 1,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    particlePoints = new THREE.Points(geometry, material);
    scene.add(particlePoints);
  }

  updateHighlight();
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

  // 泛光后处理
  composer = new EffectComposer(renderer);
  composer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  composer.addPass(new RenderPass(scene, camera));
  bloomPass = new UnrealBloomPass(new THREE.Vector2(width, height), 0.7, 0.6, 0.2);
  composer.addPass(bloomPass);
  composer.addPass(new OutputPass());

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.autoRotate = autoRotate.value;
  controls.autoRotateSpeed = 0.7;

  scene.add(new THREE.AmbientLight(0xffffff, 0.85));
  const keyLight = new THREE.PointLight(0xffffff, 0.7);
  keyLight.position.set(20, 30, 20);
  scene.add(keyLight);
  const fillLight = new THREE.PointLight(0x4a8cff, 0.6);
  fillLight.position.set(-25, -15, -30);
  scene.add(fillLight);

  // 背景星点
  const starCount = 420;
  const starPositions = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i += 1) {
    starPositions[i * 3] = (Math.random() - 0.5) * 240;
    starPositions[i * 3 + 1] = (Math.random() - 0.5) * 240;
    starPositions[i * 3 + 2] = (Math.random() - 0.5) * 240;
  }
  const starGeometry = new THREE.BufferGeometry();
  starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  scene.add(
    new THREE.Points(
      starGeometry,
      new THREE.PointsMaterial({ color: 0xffffff, size: 0.16, transparent: true, opacity: 0.55 }),
    ),
  );

  // 星云雾（缓慢旋转的彩色尘埃）
  const dustCount = 300;
  const dustPositions = new Float32Array(dustCount * 3);
  const dustColors = new Float32Array(dustCount * 3);
  const dustColor = new THREE.Color();
  for (let i = 0; i < dustCount; i += 1) {
    const r = 90 + Math.random() * 60;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    dustPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    dustPositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    dustPositions[i * 3 + 2] = r * Math.cos(phi);
    dustColor.setHSL(0.6 + Math.random() * 0.15, 0.7, 0.55);
    dustColors[i * 3] = dustColor.r;
    dustColors[i * 3 + 1] = dustColor.g;
    dustColors[i * 3 + 2] = dustColor.b;
  }
  const dustGeometry = new THREE.BufferGeometry();
  dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
  dustGeometry.setAttribute('color', new THREE.BufferAttribute(dustColors, 3));
  nebula = new THREE.Points(
    dustGeometry,
    new THREE.PointsMaterial({
      size: 1.6,
      vertexColors: true,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  scene.add(nebula);

  // 初始球面种子 → 力导向聚类
  const count = nodes.value.length;
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  positions.length = 0;
  posById.clear();
  for (let i = 0; i < count; i += 1) {
    const y = 1 - (i / Math.max(1, count - 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = goldenAngle * i;
    positions.push(
      new THREE.Vector3(Math.cos(theta) * r, y * 0.85, Math.sin(theta) * r).multiplyScalar(12),
    );
    posById.set(nodes.value[i].id, i);
  }
  const laidOut = runForceLayout(positions);
  positions.length = 0;
  positions.push(...laidOut);

  computeHues();

  // 节点球体 + 光晕 + 光环 + 标签
  if (!glowTexture) glowTexture = makeGlowTexture();
  meshes.length = 0;
  baseColors.length = 0;
  sizes.length = 0;
  phases.length = 0;
  labels.length = 0;
  halos.length = 0;
  rings.length = 0;
  introFactor.length = 0;
  for (let i = 0; i < count; i += 1) {
    const node = nodes.value[i];
    const size = isEntityMode.value
      ? 0.8
      : Math.min(1.6, 0.55 + Math.cbrt(node.chunkCount) * 0.16);
    sizes.push(size);
    phases.push(Math.random() * Math.PI * 2);
    introFactor.push(0);
    const color = colorForIndex(i);
    baseColors.push(color.clone());

    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(size, 32, 32),
      new THREE.MeshPhongMaterial({
        color,
        emissive: color.clone().multiplyScalar(0.4),
        shininess: 60,
        transparent: true,
      }),
    );
    mesh.position.copy(positions[i]);
    mesh.userData.index = i;
    mesh.scale.setScalar(0);
    scene.add(mesh);
    meshes.push(mesh);

    const halo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTexture,
        color,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    halo.position.copy(positions[i]);
    scene.add(halo);
    halos.push(halo);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(size * 1.7, 0.045, 8, 64),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    ring.position.copy(positions[i]);
    ring.rotation.x = Math.PI / 2 - 0.5;
    scene.add(ring);
    rings.push(ring);

    const label = createLabel(node.name);
    label.position.copy(positions[i]);
    label.position.y = positions[i].y + size + 0.475 + label.scale.y / 2;
    scene.add(label);
    labels.push(label);
  }

  rebuildEdges();

  // 相机初始位置（全景取景）
  const radius = Math.max(9, Math.cbrt(count) * 6.2);
  const camX = radius * 1.55;
  const camY = radius * 0.75;
  const camZ = radius * 1.85;
  introStart = performance.now();
  introDone = false;
  camera.position.set(camX * 1.5, camY * 1.4, camZ * 1.6);
  overviewPos.set(camX, camY, camZ);
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

/** 屏幕空间最近连线拾取（用于悬停连线看相关度） */
const pickEdge = (event: PointerEvent): EdgeObj | null => {
  if (!camera || !renderer) return null;
  if (edgeObjs.length > 600) return null;
  const rect = renderer.domElement.getBoundingClientRect();
  const px = event.clientX - rect.left;
  const py = event.clientY - rect.top;
  const w = rect.width;
  const h = rect.height;
  const v = new THREE.Vector3();
  let best: EdgeObj | null = null;
  let bestD = 10;
  for (const e of edgeObjs) {
    if (!e.active) continue;
    v.copy(positions[e.a]).project(camera);
    const ax = (v.x * 0.5 + 0.5) * w;
    const ay = (-v.y * 0.5 + 0.5) * h;
    v.copy(positions[e.b]).project(camera);
    const bx = (v.x * 0.5 + 0.5) * w;
    const by = (-v.y * 0.5 + 0.5) * h;
    const d = distPointSeg(px, py, ax, ay, bx, by);
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  return best;
};

const onPointerMove = (event: PointerEvent) => {
  if (!renderer || !camera || !getPointerNDC(event)) return;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(meshes, false);
  const rect = renderer.domElement.getBoundingClientRect();
  if (hits.length > 0) {
    const index = hits[0].object.userData.index as number;
    const node = nodes.value[index];
    tooltip.value = {
      visible: true,
      x: event.clientX - rect.left + 14,
      y: event.clientY - rect.top + 14,
      name: node.name,
      meta: isEntityMode.value
        ? `${node.entityType ?? '其他'} · 来自 ${node.fileName ?? '未知文档'}`
        : `分块 ${node.chunkCount} · 关联 ${degreeByIndex[index] ?? 0} 个文档`,
    };
    hoverIndex = index;
    edgeHoverObj = null;
    renderer.domElement.style.cursor = 'pointer';
    updateHighlight();
    return;
  }
  // 命中连线 → 显示相关度
  const edge = pickEdge(event);
  if (edge) {
    tooltip.value = {
      visible: true,
      x: event.clientX - rect.left + 14,
      y: event.clientY - rect.top + 14,
      name: `${nodes.value[edge.a].name} ↔ ${nodes.value[edge.b].name}`,
      meta: isEntityMode.value
        ? `关系：${edge.label ?? '未知关系'}`
        : `内容相关度 ${Math.round(edge.weight * 100)}%`,
    };
    hoverIndex = -1;
    edgeHoverObj = edge;
    renderer.domElement.style.cursor = 'pointer';
  } else {
    tooltip.value.visible = false;
    hoverIndex = -1;
    edgeHoverObj = null;
    renderer.domElement.style.cursor = 'grab';
  }
  updateHighlight();
};

const onPointerLeave = () => {
  tooltip.value.visible = false;
  hoverIndex = -1;
  edgeHoverObj = null;
  updateHighlight();
};

const onCanvasClick = (event: PointerEvent) => {
  if (!renderer || !camera || !getPointerNDC(event)) return;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(meshes, false);
  if (hits.length > 0) {
    focusNode(hits[0].object.userData.index as number);
  } else {
    selectedIndex.value = -1;
    hoverIndex = -1;
    edgeHoverObj = null;
    updateHighlight();
  }
};

/** 聚焦某节点：相机平滑移动到该节点附近，并高亮其所在簇 */
const focusNode = (index: number) => {
  if (!camera || !controls) return;
  const target = positions[index];
  if (!target) return;
  selectedIndex.value = index;
  introDone = true;
  introFactor.fill(1);
  focusFrom.copy(camera.position);
  cameraTargetFrom.copy(controls.target);
  focusTo.copy(target).add(new THREE.Vector3(5.5, 4, 5.5));
  cameraTargetTo.copy(target);
  focusProgress = 0;
  hasFocusTarget = true;
  updateHighlight();
};

/** 重置视角：清空选中并平滑回到全景 */
const resetView = () => {
  selectedIndex.value = -1;
  hoverIndex = -1;
  edgeHoverObj = null;
  updateHighlight();
  if (!camera || !controls) return;
  introDone = true;
  introFactor.fill(1);
  focusFrom.copy(camera.position);
  cameraTargetFrom.copy(controls.target);
  focusTo.copy(overviewPos);
  cameraTargetTo.set(0, 0, 0);
  focusProgress = 0;
  hasFocusTarget = true;
};

const onWeightChange = (value: number) => {
  minWeight.value = value;
  rebuildEdges();
};

// ---------- 动画循环 ----------
const updateIntro = (now: number) => {
  if (introDone) return;
  const p = Math.min(1, (now - introStart) / 1800);
  const eased = 1 - Math.pow(1 - p, 3);
  if (camera) {
    camera.position.lerpVectors(camera.position.clone(), overviewPos, Math.min(1, eased * 1.2));
  }
  for (let i = 0; i < introFactor.length; i += 1) {
    const delay = (i % 60) * 0.02;
    const local = delay >= 1 ? 1 : Math.max(0, Math.min(1, (p - delay) / (1 - delay * 0.4)));
    introFactor[i] = easeOutBack(local);
  }
  if (p >= 1) {
    introDone = true;
    introFactor.fill(1);
  }
};

const animate = () => {
  animationId = requestAnimationFrame(animate);
  const now = performance.now();
  const t = now * 0.001;

  updateIntro(now);

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

  // 节点：浮动 + 光环旋转 + 辉光呼吸 + 选中/高亮透明度
  for (let i = 0; i < meshes.length; i += 1) {
    const mesh = meshes[i];
    const size = sizes[i];
    const floatY = positions[i].y + Math.sin(t * 0.9 + phases[i]) * 0.22;
    mesh.position.y = floatY;

    const intro = introFactor[i] ?? 0;
    let scale = size * intro;
    if (selectedIndex.value === i) {
      scale *= 1.0;
    } else if (hoverIndex === i) {
      scale *= 1.12;
    }
    mesh.scale.setScalar(Math.max(0.0001, scale));

    const mat = mesh.material as THREE.MeshPhongMaterial;
    if (selectedIndex.value === i) {
      mat.color.set('#ffd166');
      mat.emissive.set('#ffd166').multiplyScalar(0.85);
    } else {
      mat.color.copy(baseColors[i]);
      const breathe = 0.4 + 0.12 * Math.sin(t * 1.6 + phases[i]);
      mat.emissive.copy(baseColors[i]).multiplyScalar(breathe);
    }
    const op = nodeOpacity[i] ?? 1;
    mat.opacity = op;
    mat.transparent = op < 1 || scale < size;

    const halo = halos[i];
    halo.position.y = floatY;
    (halo.material as THREE.SpriteMaterial).opacity = 0.5 * op * Math.min(1, intro * 1.4);
    halo.scale.setScalar(size * 4.6 * Math.max(0.2, scale / size));

    const ring = rings[i];
    ring.position.y = floatY;
    ring.rotation.y = t * 0.35 + phases[i];
    (ring.material as THREE.MeshBasicMaterial).opacity = 0.45 * op;
    ring.scale.setScalar(Math.max(0.0001, intro));

    const label = labels[i];
    label.position.y = floatY + size + 0.475 + label.scale.y / 2;
    label.visible = showLabels.value && op > 0.05;
    (label.material as THREE.SpriteMaterial).opacity = 0.95 * op;
  }

  // 连线透明度与显隐
  for (let k = 0; k < edgeObjs.length; k += 1) {
    const e = edgeObjs[k];
    const op = (edgeOpacity[k] ?? 0.7) * Math.min(1, introDone ? 1 : 0.0001);
    e.material.opacity = op;
    e.material.transparent = true;
    e.line.visible = op > 0.02;
  }

  // 连线流动光点
  if (particlePoints && particlePosAttr) {
    const posArr = particlePosAttr.array as Float32Array;
    for (let k = 0; k < edgeObjs.length; k += 1) {
      const e = edgeObjs[k];
      let pt = particleT[k] + 0.004 + e.weight * 0.009;
      if (pt > 1) pt -= 1;
      particleT[k] = pt;
      const a = positions[e.a];
      const b = positions[e.b];
      const o = k * 3;
      posArr[o] = a.x + (b.x - a.x) * pt;
      posArr[o + 1] = a.y + (b.y - a.y) * pt;
      posArr[o + 2] = a.z + (b.z - a.z) * pt;
    }
    particlePosAttr.needsUpdate = true;
  }

  // 星云雾缓慢旋转
  if (nebula) {
    nebula.rotation.y = t * 0.02;
  }

  if (composer && renderer && scene && camera) {
    // 泛光只作用于节点/连线/粒子等（layer 0）；文字标签（layer 1）在泛光之后单独叠加渲染
    camera.layers.set(0);
    composer.render();
    // 叠加标签时临时去掉 scene.background，否则背景会整屏覆盖已渲染的泛光画面
    const bg = scene.background;
    scene.background = null;
    camera.layers.set(1);
    renderer.autoClear = false;
    renderer.clearDepth();
    renderer.render(scene, camera);
    camera.layers.set(0);
    renderer.autoClear = true;
    scene.background = bg;
  } else if (renderer && scene && camera) {
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
  composer?.setSize(width, height);
  for (const e of edgeObjs) {
    e.material.resolution.set(width, height);
  }
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
  }
  for (const e of edgeObjs) {
    scene?.remove(e.line);
    e.geo.dispose();
    e.material.dispose();
  }
  edgeObjs.length = 0;
  for (const mesh of meshes) {
    scene?.remove(mesh);
    (mesh.geometry as THREE.BufferGeometry).dispose();
    (mesh.material as THREE.Material).dispose();
  }
  meshes.length = 0;
  for (const halo of halos) {
    scene?.remove(halo);
    (halo.material as THREE.Material).dispose();
  }
  halos.length = 0;
  for (const ring of rings) {
    scene?.remove(ring);
    (ring.geometry as THREE.BufferGeometry).dispose();
    (ring.material as THREE.Material).dispose();
  }
  rings.length = 0;
  for (const label of labels) {
    scene?.remove(label);
    (label.material as THREE.Material).dispose();
  }
  labels.length = 0;
  if (particlePoints) {
    scene?.remove(particlePoints);
    (particlePoints.geometry as THREE.BufferGeometry).dispose();
    (particlePoints.material as THREE.Material).dispose();
    particlePoints = null;
  }
  particlePosAttr = null;
  particleColAttr = null;
  if (composer) {
    composer.dispose();
    composer = null;
  }
  bloomPass = null;
  nebula = null;
  if (renderer) {
    renderer.dispose();
    renderer = null;
  }
  scene = null;
  camera = null;
  controls = null;
  baseColors.length = 0;
  positions.length = 0;
  sizes.length = 0;
  phases.length = 0;
  degreeByIndex.length = 0;
  hues.length = 0;
  nodeOpacity.length = 0;
  edgeOpacity.length = 0;
  introFactor.length = 0;
  posById.clear();
  selectedIndex.value = -1;
  tooltip.value.visible = false;
  hoverIndex = -1;
  edgeHoverObj = null;
  hasFocusTarget = false;
  focusProgress = 1;
};

const loadGraph = async (force = false) => {
  loading.value = true;
  try {
    if (mode.value === 'entity') {
      if (force || entityData.value.entities.length === 0) {
        entityData.value = await statsApi.getEntityGraph();
      }
      nodes.value = entityData.value.entities.map((e) => ({
        id: e.id,
        name: e.name,
        chunkCount: 0,
        createdAt: '',
        entityType: e.entityType,
        fileName: e.fileName ?? null,
      }));
      edges.value = entityData.value.relations.map((r) => ({
        source: r.source,
        target: r.target,
        weight: 1,
        label: r.relation,
      }));
    } else {
      if (force || docNodes.value.length === 0) {
        const docData = await statsApi.getGraph();
        docNodes.value = docData.nodes;
        docEdges.value = docData.edges;
      }
      nodes.value = docNodes.value;
      edges.value = docEdges.value.map((e) => ({ ...e }));
    }
    disposeScene();
    if (nodes.value.length > 0) {
      await nextTick();
      buildScene();
    }
  } catch (error) {
    console.error(error);
  } finally {
    loading.value = false;
  }
};

watch(autoRotate, (value) => {
  if (controls) {
    controls.autoRotate = value;
    controls.autoRotateSpeed = 0.7;
  }
});

watch(mode, () => {
  loadGraph();
});

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
  background: var(--kb-bg-card);
}

.graph-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  border-bottom: 1px solid var(--kb-border);
  background: var(--kb-bg-card);
  flex-shrink: 0;
}

.toolbar-tip {
  font-size: 12px;
  color: var(--kb-text-secondary);
}

.header-tools {
  display: flex;
  align-items: center;
  gap: 16px;
}

.hd-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--kb-text-regular);
  cursor: pointer;
  user-select: none;
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

.graph-canvas::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: radial-gradient(ellipse at center, rgba(0, 0, 0, 0) 42%, rgba(2, 6, 16, 0.62) 100%);
  z-index: 2;
}

.gl-canvas {
  display: block;
  width: 100%;
  height: 100%;
  touch-action: none;
}

.graph-controls {
  position: absolute;
  top: 14px;
  left: 14px;
  z-index: 8;
  width: 200px;
  background: rgba(10, 18, 34, 0.72);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  padding: 10px 12px;
  color: #e5e7eb;
  backdrop-filter: blur(6px);
}

.control-title {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.75);
  margin-bottom: 6px;
}

.control-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.control-label {
  font-size: 12px;
  flex-shrink: 0;
}

.weight-slider {
  flex: 1;
}

.control-hint {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
  margin-top: 2px;
}

.graph-legend {
  position: absolute;
  right: 14px;
  bottom: 14px;
  z-index: 8;
  background: rgba(10, 18, 34, 0.72);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  padding: 10px 12px;
  color: #e5e7eb;
  backdrop-filter: blur(6px);
}

.legend-title {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.75);
  margin-bottom: 6px;
}

.legend-bar {
  width: 150px;
  height: 10px;
  border-radius: 5px;
  background: linear-gradient(to right, #22d3ee, #818cf8, #e879f9, #fb923c);
}

.legend-labels {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.55);
  margin-top: 2px;
}

.legend-note {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
  margin-top: 6px;
  max-width: 160px;
}

.type-legend {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 2px;
}

.type-legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.85);
}

.type-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
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
  z-index: 4;
}

.graph-side {
  width: 280px;
  flex-shrink: 0;
  background: var(--kb-bg-card);
  border-left: 1px solid var(--kb-border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.side-title {
  padding: 14px 16px;
  font-size: 14px;
  font-weight: 600;
  border-bottom: 1px solid var(--kb-border-lightest);
  color: var(--kb-text-primary);
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
  background: var(--kb-scrollbar);
  border-radius: 3px;
}

.node-list::-webkit-scrollbar-thumb:hover {
  background: var(--kb-scrollbar-hover);
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
  background: var(--kb-bg-item-hover);
}

.node-list li.active {
  background: var(--kb-sub-active);
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
  color: var(--kb-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.node-count {
  font-size: 12px;
  color: var(--kb-text-secondary);
  flex-shrink: 0;
}

.side-empty {
  padding: 24px;
  text-align: center;
  color: var(--kb-text-secondary);
  font-size: 13px;
}

.graph-empty-panel {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
