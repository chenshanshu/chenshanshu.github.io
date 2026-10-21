/**
 * 中央舞台：
 * - Mk.85：钢铁侠青蓝线框（轨道旋转）
 * - MECHA：FORGE 多机甲 · 线条 HUD 自发光（非扫描光带）
 *
 * 机甲资源：RamonLinares/atlas-09（CC0）
 * 默认第二档为 ATLAS-09，其余型号可切换。
 */
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'

const canvas = document.getElementById('mechaCanvas')
const loadTip = document.getElementById('loadTip')
const stage = canvas.parentElement
const frameMode = document.getElementById('frameMode')
const frameHint = document.getElementById('frameHint')
const mechaSub = document.getElementById('mechaSub')
const hudLayer = document.getElementById('hudLayer')
const frameSwitch = document.getElementById('frameSwitch')
const modeBtns = document.querySelectorAll('[data-mecha-mode]')

/** FORGE 机甲目录：ATLAS 保留为默认第二机甲，其余按需懒加载 */
const MECHA_CATALOG = [
  { id: 'atlas-09', file: './assets/atlas-09.glb', label: 'ATLAS', title: 'ATLAS-09', edge: 18 },
  { id: 'ronin-04', file: './assets/ronin-04.glb', label: 'RONIN', title: 'RONIN-04', edge: 15 },
  { id: 'vanguard-07', file: './assets/vanguard-07.glb', label: 'VANGUARD', title: 'VANGUARD-07', edge: 12 },
  { id: 'titan-06', file: './assets/titan-06.glb', label: 'TITAN', title: 'TITAN-06', edge: 14 },
  { id: 'aether-02', file: './assets/aether-02.glb', label: 'AETHER', title: 'AETHER-02', edge: 14 },
  { id: 'seraph-03', file: './assets/seraph-03.glb', label: 'SERAPH', title: 'SERAPH-03', edge: 14 },
  { id: 'scorpio-05', file: './assets/scorpio-05.glb', label: 'SCORPIO', title: 'SCORPIO-05', edge: 12 },
  // 非 FORGE：Pixor CC0（已下）；Quaternius / Grab3D 超时或失败已跳过
  { id: 'pixor-mech', file: './assets/pixor-mech.glb', label: 'PIXOR', title: 'PIXOR MECH', edge: 20 }
]

const scene = new THREE.Scene()

const orbitCam = new THREE.PerspectiveCamera(28, 1, 0.1, 100)
orbitCam.position.set(1.2, 1.4, 9.5)

/** MECHA 更正面、略远 */
const mechaCam = new THREE.PerspectiveCamera(26, 1, 0.1, 100)
mechaCam.position.set(0.2, 0.9, 11)

let activeCam = orbitCam

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
renderer.setClearColor(0x000000, 0)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

const controls = new OrbitControls(orbitCam, canvas)
controls.enableDamping = true
controls.enablePan = false
controls.minPolarAngle = Math.PI / 5
controls.maxPolarAngle = Math.PI / 1.85
controls.minDistance = 5
controls.maxDistance = 16
controls.autoRotate = true
controls.autoRotateSpeed = 0.45

/** 钢铁侠模型里要隐藏的部件名 */
const HIDE = ['missile', 'arc reactor', 'arc reactor v2']

/** @type {'mk85'|'mecha'} */
let mode = 'mk85'
/** @type {THREE.Group|null} */
let suitRoot = null
/** 当前展示的机甲根节点 */
let mechaRoot = null
/** @type {string} */
let activeFrameId = MECHA_CATALOG[0].id
/** @type {Map<string, { root: THREE.Group, wires: Array }>} */
const mechaCache = new Map()
/** @type {Set<string>} */
const mechaLoading = new Set()
/** 用户点了 MECHA 但资源尚未就绪 */
let pendingMecha = false

/** Mk.85 线框段 */
const suitWires = []
/** 当前机甲发光线材质（脉冲动画） */
let activeMechaWires = []

function shouldHide(obj) {
  let p = obj
  while (p) {
    const n = (p.name || '').trim().toLowerCase()
    if (HIDE.includes(n)) return true
    p = p.parent
  }
  return false
}

/**
 * 提取可用边几何；边太少时放宽阈值重试
 * @param {THREE.BufferGeometry} geometry
 * @param {number} threshold
 */
function buildEdgeGeo(geometry, threshold) {
  let edgeGeo = new THREE.EdgesGeometry(geometry, threshold)
  const pos = edgeGeo.getAttribute('position')
  if (!pos || pos.count < 16) {
    edgeGeo.dispose()
    edgeGeo = new THREE.EdgesGeometry(geometry, Math.max(8, threshold - 10))
  }
  return edgeGeo
}

/**
 * Mk.85：普通 LineSegments 轮廓
 * @param {THREE.Mesh} mesh
 * @param {number} threshold
 * @param {Array} wireBucket
 * @param {{ ghost: number, line: number }} colors
 */
function toOutline(mesh, threshold, wireBucket, colors) {
  if (!mesh.geometry) return
  if (!mesh.geometry.attributes.normal) mesh.geometry.computeVertexNormals()

  const ghost = new THREE.MeshBasicMaterial({
    color: colors.ghost,
    transparent: true,
    opacity: 0.1,
    depthWrite: false,
    side: THREE.FrontSide
  })
  mesh.material = ghost
  mesh.visible = true
  mesh.frustumCulled = false

  const edgeGeo = buildEdgeGeo(mesh.geometry, threshold)
  const lineMat = new THREE.LineBasicMaterial({
    color: colors.line,
    transparent: true,
    opacity: 0.92,
    depthWrite: false
  })
  const lines = new THREE.LineSegments(edgeGeo, lineMat)
  lines.frustumCulled = false
  mesh.add(lines)
  wireBucket.push({ ghost, lineMat })
}

/**
 * MECHA：核心亮线 + 加性外晕线 = HUD 线条自发光
 * （不用 Line2，避免部分网格 fromEdgesGeometry 抛错导致整模 LOAD FAILED）
 * @param {THREE.Mesh} mesh
 * @param {number} threshold
 * @param {Array} wireBucket
 * @param {{ ghost: number, line: number }} colors
 */
function toHudGlow(mesh, threshold, wireBucket, colors) {
  if (!mesh.geometry) return
  try {
    if (!mesh.geometry.attributes.normal) mesh.geometry.computeVertexNormals()

    const ghost = new THREE.MeshBasicMaterial({
      color: colors.ghost,
      transparent: true,
      opacity: 0.05,
      depthWrite: false,
      side: THREE.FrontSide
    })
    mesh.material = ghost
    mesh.visible = true
    mesh.frustumCulled = false

    const edgeGeo = buildEdgeGeo(mesh.geometry, threshold)
    const pos = edgeGeo.getAttribute('position')
    if (!pos || pos.count < 2) {
      edgeGeo.dispose()
      return
    }

    // 外晕：同几何、加性混合、略低不透明度 → 霓虹光晕
    const glowMat = new THREE.LineBasicMaterial({
      color: colors.line,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
    // 核心：更亮的实线
    const coreMat = new THREE.LineBasicMaterial({
      color: 0xd8f0ff,
      transparent: true,
      opacity: 0.98,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })

    const glowLines = new THREE.LineSegments(edgeGeo, glowMat)
    // 核心复用同一边数据（克隆几何，避免 dispose 互相影响）
    const coreLines = new THREE.LineSegments(edgeGeo.clone(), coreMat)
    glowLines.frustumCulled = false
    coreLines.frustumCulled = false
    mesh.add(glowLines)
    mesh.add(coreLines)

    wireBucket.push({ ghost, coreMat, glowMat, glow: true })
  } catch (err) {
    // 单网格失败不拖垮整模
    console.warn('toHudGlow skip mesh', mesh.name, err)
  }
}

function preciseBox(root) {
  root.updateMatrixWorld(true)
  return new THREE.Box3().setFromObject(root, true)
}

function fitRootByHeight(object3d, targetHeight, yOffset) {
  const box = preciseBox(object3d)
  if (box.isEmpty()) return null
  const size = box.getSize(new THREE.Vector3())
  const center = box.getCenter(new THREE.Vector3())
  const h = Math.max(size.y, 0.001)
  object3d.position.sub(center)
  const root = new THREE.Group()
  root.add(object3d)
  root.scale.setScalar(targetHeight / h)
  root.position.y = yOffset
  scene.add(root)
  return root
}

function frameCameraTo(root, cam, pad) {
  if (!root) return
  root.updateMatrixWorld(true)
  const box = preciseBox(root)
  if (box.isEmpty()) return
  const size = box.getSize(new THREE.Vector3())
  const center = box.getCenter(new THREE.Vector3())
  const maxDim = Math.max(size.x, size.y, size.z, 0.01)
  const fov = (cam.fov * Math.PI) / 180
  const dist = Math.abs(maxDim / (2 * Math.tan(fov / 2))) * (pad || 1.4)
  cam.position.set(center.x + dist * 0.12, center.y + dist * 0.06, center.z + dist)
  controls.target.copy(center)
  controls.minDistance = dist * 0.5
  controls.maxDistance = dist * 2.2
  controls.update()
}

function catalogItem(id) {
  return MECHA_CATALOG.find((m) => m.id === id) || MECHA_CATALOG[0]
}

/** 构建机甲切换按钮 */
function buildFrameSwitch() {
  if (!frameSwitch) return
  frameSwitch.innerHTML = ''
  MECHA_CATALOG.forEach((item) => {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.setAttribute('role', 'tab')
    btn.setAttribute('data-mecha-frame', item.id)
    btn.textContent = item.label
    if (item.id === activeFrameId) btn.classList.add('on')
    btn.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      selectMechaFrame(item.id)
    })
    frameSwitch.appendChild(btn)
  })
}

function updateFrameSwitchUi() {
  if (!frameSwitch) return
  frameSwitch.querySelectorAll('[data-mecha-frame]').forEach((btn) => {
    btn.classList.toggle('on', btn.getAttribute('data-mecha-frame') === activeFrameId)
  })
}

/** 切换过程中先切 Tab 高亮，避免仍显示 Mk.85 文案 */
function markModeButtons(next) {
  modeBtns.forEach((btn) => {
    btn.classList.toggle('on', btn.getAttribute('data-mecha-mode') === next)
  })
}

function setUi(next) {
  const item = catalogItem(activeFrameId)
  const map = {
    mk85: {
      mode: 'Mk.85 · WIREFRAME',
      hint: 'DRAG TO ORBIT',
      sub: 'IRON MAN · FULL BODY'
    },
    mecha: {
      mode: `${item.title} · HUD GLOW`,
      hint: 'LINE BLOOM',
      sub: `FORGE · ${item.label}`
    }
  }
  const t = map[next] || map.mk85
  if (frameMode) frameMode.textContent = t.mode
  if (frameHint) frameHint.textContent = t.hint
  if (mechaSub) mechaSub.textContent = t.sub
  markModeButtons(next)
  updateFrameSwitchUi()
}

function bindControlsFor(next) {
  if (next === 'mecha') {
    controls.object = mechaCam
    controls.minPolarAngle = Math.PI / 3.2
    controls.maxPolarAngle = Math.PI / 1.8
    controls.autoRotateSpeed = 0.28
    controls.enabled = true
    controls.autoRotate = true
    activeCam = mechaCam
    frameCameraTo(mechaRoot, mechaCam, 1.5)
  } else {
    // Mk.85
    controls.object = orbitCam
    controls.minPolarAngle = Math.PI / 5
    controls.maxPolarAngle = Math.PI / 1.85
    controls.autoRotateSpeed = 0.45
    controls.enabled = true
    controls.autoRotate = true
    activeCam = orbitCam
    frameCameraTo(suitRoot, orbitCam, 1.35)
  }
  controls.update()
}

function setMode(next) {
  mode = next
  const showSuit = next === 'mk85'
  const showMecha = next === 'mecha'

  if (suitRoot) suitRoot.visible = showSuit
  mechaCache.forEach((entry, id) => {
    entry.root.visible = showMecha && id === activeFrameId
  })
  canvas.style.visibility = 'visible'
  canvas.style.pointerEvents = 'auto'
  canvas.classList.toggle('hud-glow', showMecha)

  bindControlsFor(next)

  if (hudLayer) {
    hudLayer.classList.toggle('show', showMecha)
    hudLayer.setAttribute('aria-hidden', showMecha ? 'false' : 'true')
  }
  if (frameSwitch) {
    frameSwitch.classList.toggle('show', showMecha)
    frameSwitch.setAttribute('aria-hidden', showMecha ? 'false' : 'true')
  }

  setUi(next)
  resize()
}

/** 进入 MECHA 加载中：藏钢铁侠，避免「坏了像还是 Mk.85」 */
function enterMechaPending(label) {
  pendingMecha = true
  mode = 'mecha'
  markModeButtons('mecha')
  if (suitRoot) suitRoot.visible = false
  mechaCache.forEach((entry) => {
    entry.root.visible = false
  })
  canvas.classList.add('hud-glow')
  canvas.style.visibility = 'visible'
  if (hudLayer) {
    hudLayer.classList.add('show')
    hudLayer.setAttribute('aria-hidden', 'false')
  }
  if (frameSwitch) {
    frameSwitch.classList.add('show')
    frameSwitch.setAttribute('aria-hidden', 'false')
  }
  if (frameMode) frameMode.textContent = `${catalogItem(activeFrameId).title} · HUD GLOW`
  if (frameHint) frameHint.textContent = 'LOADING…'
  if (mechaSub) mechaSub.textContent = `FORGE · ${label}`
  updateFrameSwitchUi()
  if (loadTip) {
    loadTip.classList.remove('hide')
    loadTip.textContent = `LOADING ${label}…`
  }
}

function requestMode(next) {
  if (next === 'mecha') {
    const cached = mechaCache.get(activeFrameId)
    if (!cached) {
      enterMechaPending(catalogItem(activeFrameId).label)
      loadMechaFrame(activeFrameId)
      return
    }
    pendingMecha = false
    mechaRoot = cached.root
    activeMechaWires = cached.wires
    setMode('mecha')
    return
  }
  pendingMecha = false
  if (!suitRoot) {
    if (loadTip) {
      loadTip.classList.remove('hide')
      loadTip.textContent = 'LOADING ARMOR…'
    }
    return
  }
  setMode('mk85')
}

/**
 * 切换机甲型号（懒加载）
 * @param {string} id
 */
function selectMechaFrame(id) {
  if (!MECHA_CATALOG.some((m) => m.id === id)) return
  if (id === activeFrameId && mechaCache.has(id) && mode === 'mecha') return

  activeFrameId = id
  updateFrameSwitchUi()

  const cached = mechaCache.get(id)
  if (cached) {
    mechaCache.forEach((entry, key) => {
      entry.root.visible = mode === 'mecha' && key === id
    })
    mechaRoot = cached.root
    activeMechaWires = cached.wires
    pendingMecha = false
    if (mode === 'mecha') setMode('mecha')
    else setUi(mode)
    return
  }
  enterMechaPending(catalogItem(id).label)
  loadMechaFrame(id)
}

/**
 * 懒加载指定机甲 GLB → 发光线框
 * @param {string} id
 */
function loadMechaFrame(id) {
  const item = catalogItem(id)
  if (mechaCache.has(id)) {
    if (activeFrameId === id) {
      mechaRoot = mechaCache.get(id).root
      activeMechaWires = mechaCache.get(id).wires
      pendingMecha = false
      loadTip.classList.add('hide')
      setMode('mecha')
    }
    return
  }
  if (mechaLoading.has(id)) {
    if (loadTip) {
      loadTip.classList.remove('hide')
      loadTip.textContent = `LOADING ${item.label}…`
    }
    return
  }

  mechaLoading.add(id)
  if (loadTip) {
    loadTip.classList.remove('hide')
    loadTip.textContent = `LOADING ${item.label}…`
  }

  gltfLoader.load(
    item.file,
    (gltf) => {
      mechaLoading.delete(id)
      try {
        const wires = []
        const model = gltf.scene
        model.traverse((child) => {
          if (!child.isMesh && !child.isSkinnedMesh) return
          toHudGlow(child, item.edge, wires, { ghost: 0x0e4a78, line: 0x6ecfff })
        })
        const root = fitRootByHeight(model, 4.5, -0.12)
        if (!root || wires.length === 0) {
          if (activeFrameId === id && loadTip) {
            loadTip.classList.remove('hide')
            loadTip.textContent = `${item.label} EMPTY`
          }
          return
        }
        root.visible = false
        mechaCache.set(id, { root, wires })

        if (activeFrameId === id) {
          mechaRoot = root
          activeMechaWires = wires
          loadTip.classList.add('hide')
          pendingMecha = false
          setMode('mecha')
        } else if (!mechaLoading.size && mode !== 'mecha') {
          loadTip.classList.add('hide')
        }
      } catch (err) {
        console.error('mecha build failed', item.id, err)
        if (activeFrameId === id && loadTip) {
          loadTip.classList.remove('hide')
          loadTip.textContent = `${item.label} BUILD FAILED`
        }
      }
    },
    undefined,
    (err) => {
      console.error('mecha load failed', item.id, err)
      mechaLoading.delete(id)
      if (activeFrameId === id && loadTip) {
        loadTip.classList.remove('hide')
        loadTip.textContent = `${item.label} LOAD FAILED`
      }
    }
  )
}

/**
 * Mk.85 线框根
 * @param {THREE.Object3D} model
 * @param {Array} wireBucket
 * @param {{ ghost: number, line: number }} colors
 * @param {number} edgeThreshold
 */
function buildSuitRoot(model, wireBucket, colors, edgeThreshold) {
  model.traverse((child) => {
    if (!child.isMesh && !child.isSkinnedMesh) return
    if (shouldHide(child)) {
      child.visible = false
      return
    }
    toOutline(child, edgeThreshold, wireBucket, colors)
  })
  return fitRootByHeight(model, 4.5, -0.12)
}

const dracoLoader = new DRACOLoader()
dracoLoader.setDecoderPath('./draco/')
const gltfLoader = new GLTFLoader()
gltfLoader.setDRACOLoader(dracoLoader)

buildFrameSwitch()

/** Mk.85：本地钢铁侠 */
gltfLoader.load(
  './ironman.glb',
  (gltf) => {
    const root = buildSuitRoot(
      gltf.scene,
      suitWires,
      { ghost: 0x0e4a78, line: 0x6ecfff },
      40
    )
    if (!root) {
      loadTip.textContent = 'MESH EMPTY'
      return
    }
    suitRoot = root
    suitRoot.visible = mode === 'mk85'
    if (mode === 'mk85') {
      loadTip.classList.add('hide')
      setMode('mk85')
    }
  },
  undefined,
  (err) => {
    console.error(err)
    loadTip.textContent = 'Mk.85 LOAD FAILED'
  }
)

/** 预热默认机甲 ATLAS-09 */
loadMechaFrame(activeFrameId)

modeBtns.forEach((btn) => {
  btn.addEventListener('click', (e) => {
    e.preventDefault()
    e.stopPropagation()
    const next = btn.getAttribute('data-mecha-mode')
    if (next) requestMode(next)
  })
})

function resize() {
  const w = stage.clientWidth
  const h = stage.clientHeight
  if (w < 1 || h < 1) return
  const aspect = w / h
  orbitCam.aspect = aspect
  orbitCam.updateProjectionMatrix()
  mechaCam.aspect = aspect
  mechaCam.updateProjectionMatrix()
  renderer.setSize(w, h, false)
}
resize()
window.addEventListener('resize', resize)
if (typeof ResizeObserver !== 'undefined') new ResizeObserver(resize).observe(stage)

const clock = new THREE.Clock()

;(function tick() {
  if (mode === 'mk85' || mode === 'mecha') controls.update()

  // HUD 发光脉冲
  if (mode === 'mecha' && activeMechaWires.length) {
    const t = clock.getElapsedTime()
    const glowOp = 0.32 + (Math.sin(t * 2.4) * 0.5 + 0.5) * 0.28
    const coreOp = 0.9 + (Math.sin(t * 1.6 + 1.2) * 0.5 + 0.5) * 0.1
    activeMechaWires.forEach((w) => {
      if (w.glowMat) w.glowMat.opacity = glowOp
      if (w.coreMat) w.coreMat.opacity = coreOp
    })
  }

  renderer.render(scene, activeCam)
  requestAnimationFrame(tick)
})()
