import { useEffect, useRef } from 'react';

// Cinta 3D (WebGL) de paisajes para la pantalla de bienvenida. Es decorativa: si el navegador
// no tiene WebGL, simplemente no se muestra. Basada en una galería "conveyor" adaptada sin marcas
// ni recursos externos; todas las imágenes salen de /public.
const PAISAJES = ['/cascada.jpg', '/montanas.png', '/Informes.png', '/matriz_riesgos.png'];
// Ocho caras en la cinta: cada paisaje aparece dos veces para que el lazo se vea lleno.
const CARAS = [...PAISAJES, ...PAISAJES];

const wrap = (value, period) => ((value % period) + period) % period;

function advanceMotion(state, frames, count, reduced) {
  const decay = Math.pow(0.94, frames);
  // Deriva lenta cuando nadie interactúa, para que la cinta se mueva sola.
  const drift = reduced ? 0 : 0.0016 * frames;
  state.offset = wrap(state.offset + drift + (reduced ? 0 : state.velocity * 0.94 * (1 - decay) / 0.06), count);
  state.velocity = reduced ? 0 : state.velocity * decay;
  state.present += (state.targetPresent - state.present) * (reduced ? 1 : 1 - Math.pow(0.93, frames));
  const smoothing = 1 - Math.pow(0.968, frames);
  state.parallaxX = reduced ? 0 : state.parallaxX + (state.pointerX - state.parallaxX) * smoothing;
  state.parallaxY = reduced ? 0 : state.parallaxY + (state.pointerY - state.parallaxY) * smoothing;
}

function conveyorPoint(t) {
  const half = 2.9, radius = 1.02, straight = half * 2, arc = Math.PI * radius;
  let distance = wrap(t, 1) * (straight * 2 + arc * 2);
  if (distance < straight) return { y: -half + distance, z: radius, ny: 0, nz: 1 };
  distance -= straight;
  if (distance < arc) {
    const angle = Math.PI / 2 - distance / radius;
    return { y: half + Math.cos(angle) * radius, z: Math.sin(angle) * radius, ny: Math.cos(angle), nz: Math.sin(angle) };
  }
  distance -= arc;
  if (distance < straight) return { y: half - distance, z: -radius, ny: 0, nz: -1 };
  distance -= straight;
  const angle = -Math.PI / 2 - distance / radius;
  return { y: -half + Math.cos(angle) * radius, z: Math.sin(angle) * radius, ny: Math.cos(angle), nz: Math.sin(angle) };
}

function buildConveyorGeometry(count, segments = 256) {
  // Ancho de cada cara con proporción 4:3.
  const width = (11.6 + Math.PI * 2.04) / count * 4 / 3;
  const vertices = new Float32Array((segments + 1) * 2 * 7);
  const indices = new Uint16Array(segments * 6);
  for (let i = 0; i <= segments; i++) {
    const point = conveyorPoint(i / segments);
    for (let side = 0; side < 2; side++) {
      vertices.set([(side - 0.5) * width, point.y, point.z, side, i / segments, point.ny, point.nz], (i * 2 + side) * 7);
    }
    if (i < segments) {
      const a = i * 2;
      indices.set([a, a + 2, a + 1, a + 1, a + 2, a + 3], i * 6);
    }
  }
  return { vertices, indices };
}

const VERTEX_SOURCE = `
  attribute vec3 position;
  attribute vec2 uv;
  attribute vec2 normalYZ;
  uniform vec3 rotation, rig, camera, target;
  uniform vec3 translation;
  uniform float aspect;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vPosition, vView, vLight;
  vec3 rotate(vec3 p, vec3 r) {
    vec3 c = cos(r), s = sin(r);
    p.xy = mat2(c.z, s.z, -s.z, c.z) * p.xy;
    p.xz = mat2(c.y, -s.y, s.y, c.y) * p.xz;
    p.yz = mat2(c.x, s.x, -s.x, c.x) * p.yz;
    return p;
  }
  vec3 unrotate(vec3 p, vec3 r) {
    vec3 c = cos(r), s = sin(r);
    p.yz = mat2(c.x, -s.x, s.x, c.x) * p.yz;
    p.xz = mat2(c.y, s.y, -s.y, c.y) * p.xz;
    p.xy = mat2(c.z, -s.z, s.z, c.z) * p.xy;
    return p;
  }
  void main() {
    vUv = uv;
    vNormal = rotate(rotate(vec3(0.0, normalYZ), rotation), rig);
    vPosition = position;
    vLight = unrotate(unrotate(normalize(vec3(-0.45, 1.1, 0.8)), rig), rotation);
    vec3 world = rotate(rotate(position * 0.79, rotation), rig) + translation;
    vView = camera - world;
    vec3 forward = normalize(target - camera);
    vec3 right = normalize(cross(forward, vec3(0.0, 1.0, 0.0)));
    vec3 up = cross(right, forward);
    vec3 delta = world - camera;
    vec3 view = vec3(dot(delta, right), dot(delta, up), -dot(delta, forward));
    view.xy *= 1.122;
    gl_Position = vec4(view.x * 3.2708526 / aspect, view.y * 3.2708526, -1.002002 * view.z - 0.2002002, -view.z);
  }`;

const FRAGMENT_SOURCE = `
  precision highp float;
  uniform sampler2D atlas;
  uniform float offset, count;
  uniform vec2 grid, atlasSize;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vPosition, vView, vLight;
  float edgeShadow(vec3 origin, vec3 ray, float distance) {
    if (distance < 0.025) return 0.0;
    float halfWidth = (11.6 + 6.408849) / count * 0.666667;
    float edge = halfWidth - abs(origin.x + ray.x * distance);
    return smoothstep(-0.06, 0.06 + distance * 0.12, edge);
  }
  float rayShadow(vec3 origin, vec3 ray) {
    float shadow = 0.0;
    if (abs(ray.z) > 0.0001) {
      for (int side = 0; side < 2; side++) {
        float z = side == 0 ? -1.02 : 1.02;
        float distance = (z - origin.z) / ray.z;
        if (abs(origin.y + ray.y * distance) <= 2.9)
          shadow = max(shadow, edgeShadow(origin, ray, distance));
      }
    }
    float a = dot(ray.yz, ray.yz);
    for (int end = 0; end < 2; end++) {
      float signY = end == 0 ? -1.0 : 1.0;
      vec2 delta = origin.yz - vec2(signY * 2.9, 0.0);
      float b = dot(delta, ray.yz);
      float discriminant = b * b - a * (dot(delta, delta) - 1.0404);
      if (discriminant >= 0.0 && a > 0.0001) {
        for (int root = 0; root < 2; root++) {
          float distance = (-b + (root == 0 ? -1.0 : 1.0) * sqrt(discriminant)) / a;
          if (signY * (origin.y + ray.y * distance) >= 2.9)
            shadow = max(shadow, edgeShadow(origin, ray, distance));
        }
      }
    }
    return shadow;
  }
  float visibility(vec3 normal) {
    vec3 light = normalize(vLight);
    vec3 tangent = normalize(cross(light, vec3(0.0, 1.0, 0.0)));
    vec3 bitangent = cross(light, tangent);
    vec3 origin = vPosition + normal * 0.018;
    float shadow = rayShadow(origin, light) * 2.0;
    shadow += rayShadow(origin, normalize(light + tangent * 0.12));
    shadow += rayShadow(origin, normalize(light - tangent * 0.12));
    shadow += rayShadow(origin, normalize(light + bitangent * 0.12));
    shadow += rayShadow(origin, normalize(light - bitangent * 0.12));
    return 1.0 - shadow / 6.0;
  }
  void main() {
    float phase = mod(vUv.y * count + offset, count);
    float tile = floor(phase);
    vec2 cell = vec2(mod(tile, grid.x), floor(tile / grid.x));
    vec2 local = vec2(vUv.x, 1.0 - fract(phase));
    vec2 inset = 0.5 * grid / atlasSize;
    vec2 sampleUv = (cell + mix(inset, 1.0 - inset, local)) / grid;
    vec3 color = texture2D(atlas, sampleUv).rgb;
    vec3 normal = normalize(vNormal);
    float side = dot(normal, vView) >= 0.0 ? 1.0 : -1.0;
    normal *= side;
    vec3 localNormal = vec3(0.0, normalize(vec2(vPosition.y - clamp(vPosition.y, -2.9, 2.9), vPosition.z))) * side;
    float visible = visibility(localNormal);
    vec3 light = normalize(vec3(-0.45, 1.1, 0.8));
    float diffuse = max(0.0, dot(normal, light)) * visible;
    float ambient = side > 0.0 ? 0.36 : 0.14;
    float fold = smoothstep(2.35, 3.92, abs(vPosition.y));
    ambient *= 1.0 - (side < 0.0 ? 0.35 : 0.12) * fold;
    float highlight = pow(max(0.0, dot(normal, normalize(light + normalize(vView)))), 28.0) * visible * 0.035;
    float luma = dot(color, vec3(0.299, 0.587, 0.114));
    color = max(vec3(0.0), mix(vec3(luma), color, 1.04));
    vec3 lit = pow(color, vec3(2.2)) * (ambient * vec3(0.94, 0.97, 1.0) + diffuse * 0.9 + highlight);
    gl_FragColor = vec4(pow(clamp(lit, 0.0, 1.0), vec3(1.0 / 2.2)), 1.0);
  }`;

function createConveyor(canvas, images, count) {
  const gl = canvas.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: false });
  if (!gl) throw new Error('WebGL no disponible.');
  const program = gl.createProgram();
  const shaders = [];
  try {
    for (const [type, source] of [[gl.VERTEX_SHADER, VERTEX_SOURCE], [gl.FRAGMENT_SHADER, FRAGMENT_SOURCE]]) {
      const shader = gl.createShader(type);
      shaders.push(shader);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
      gl.attachShader(program, shader);
    }
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  } catch (error) {
    gl.deleteProgram(program);
    throw error;
  } finally {
    shaders.forEach(shader => gl.deleteShader(shader));
  }
  gl.useProgram(program);

  const geometry = buildConveyorGeometry(count);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, geometry.vertices, gl.STATIC_DRAW);
  for (const [name, size, start] of [['position', 3, 0], ['uv', 2, 3], ['normalYZ', 2, 5]]) {
    const attribute = gl.getAttribLocation(program, name);
    gl.enableVertexAttribArray(attribute);
    gl.vertexAttribPointer(attribute, size, gl.FLOAT, false, 28, start * 4);
  }
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, geometry.indices, gl.STATIC_DRAW);

  // Atlas 4:3 con todas las caras; los paisajes panorámicos se recortan al centro (cover).
  const columns = Math.ceil(Math.sqrt(count * 0.75));
  const rows = Math.ceil(count / columns);
  const maxSize = Math.min(4096, gl.getParameter(gl.MAX_TEXTURE_SIZE));
  const tileWidth = Math.floor(Math.min(1200, maxSize / columns, maxSize / rows * 4 / 3) / 4) * 4;
  const tileHeight = tileWidth * 0.75;
  const atlas = document.createElement('canvas');
  atlas.width = columns * tileWidth;
  atlas.height = rows * tileHeight;
  const ctx = atlas.getContext('2d');
  ctx.fillStyle = '#0a3b32';
  ctx.fillRect(0, 0, atlas.width, atlas.height);
  images.forEach((image, index) => {
    if (!image) return;
    const x = index % columns * tileWidth;
    const y = Math.floor(index / columns) * tileHeight;
    const scale = Math.max(tileWidth / image.naturalWidth, tileHeight / image.naturalHeight);
    const sw = tileWidth / scale, sh = tileHeight / scale;
    // Las caras repetidas toman otro encuadre del mismo panorama para no verse idénticas.
    const encuadre = index >= PAISAJES.length ? 0.15 : 0.6;
    const sx = Math.max(0, (image.naturalWidth - sw) * encuadre);
    const sy = (image.naturalHeight - sh) / 2;
    ctx.drawImage(image, sx, sy, sw, sh, x, y, tileWidth, tileHeight);
  });
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas);
  const anisotropy = gl.getExtension('EXT_texture_filter_anisotropic');
  if (anisotropy) {
    gl.texParameterf(gl.TEXTURE_2D, anisotropy.TEXTURE_MAX_ANISOTROPY_EXT,
      Math.min(8, gl.getParameter(anisotropy.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
  }
  const loc = Object.fromEntries(['rotation', 'rig', 'translation', 'camera', 'target', 'aspect', 'offset', 'count', 'grid', 'atlasSize']
    .map(name => [name, gl.getUniformLocation(program, name)]));
  gl.uniform1f(loc.count, count);
  gl.uniform2f(loc.grid, columns, rows);
  gl.uniform2f(loc.atlasSize, atlas.width, atlas.height);
  gl.enable(gl.DEPTH_TEST);
  gl.clearColor(0, 0, 0, 0);
  let viewportWidth = 1, viewportHeight = 1;

  return {
    gl,
    draw(state) {
      const ease = state.present * state.present * (3 - 2 * state.present);
      const fade = 1 - ease;
      const x = state.parallaxX * fade, y = state.parallaxY * fade;
      const zoom = Math.max(1, 0.9 * viewportHeight / viewportWidth);
      gl.uniform3f(loc.camera, (-2 * fade + x * 0.12) * zoom, (-9.35 * fade - y * 0.08) * zoom, (10.99 - ease * 4.79) * zoom);
      gl.uniform3f(loc.target, 0, -0.2 * fade, 0.1 * fade);
      gl.uniform3f(loc.rotation, 0.07 * fade, (-0.594 + Math.sin(state.offset * Math.PI * 2 / count) * 0.081) * fade, -0.28 * fade);
      gl.uniform3f(loc.rig, -y * 0.075, x * 0.1, 0);
      gl.uniform3f(loc.translation, x * 0.075, y * 0.03 + Math.sin(state.offset * Math.PI * 4 / count) * 0.02 - 0.04 - ease * 0.06, 0);
      gl.uniform1f(loc.offset, state.offset);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.drawElements(gl.TRIANGLES, geometry.indices.length, gl.UNSIGNED_SHORT, 0);
    },
    resize(width, height) {
      viewportWidth = Math.max(1, width);
      viewportHeight = Math.max(1, height);
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(viewportWidth * ratio);
      canvas.height = Math.round(viewportHeight * ratio);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform1f(loc.aspect, viewportWidth / viewportHeight);
    },
  };
}

export default function CintaPaisajes({ className = '' }) {
  const contenedorRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    const contenedor = contenedorRef.current;
    const canvas = canvasRef.current;
    if (!contenedor || !canvas) return undefined;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const motion = { offset: 0, velocity: 0, present: 0, targetPresent: 0, pointerX: 0, pointerY: 0, parallaxX: 0, parallaxY: 0 };
    let conveyor = null;
    let frame = 0;
    let previousTime = 0;
    let touch = null;
    let activo = true;

    const resize = () => {
      const { width, height } = contenedor.getBoundingClientRect();
      conveyor?.resize(width, height);
    };
    const render = time => {
      const frames = previousTime ? Math.min((time - previousTime) / (1000 / 60), 3) : 1;
      previousTime = time;
      advanceMotion(motion, frames, CARAS.length, reducedMotion.matches);
      conveyor?.draw(motion);
      frame = requestAnimationFrame(render);
    };
    const input = (delta, touchInput = false) => {
      const sensitivity = touchInput ? 0.00155 : 0.00019;
      if (reducedMotion.matches) motion.offset = wrap(motion.offset + delta * sensitivity * 0.94 / 0.06, CARAS.length);
      else motion.velocity += delta * sensitivity;
      motion.targetPresent = Math.max(0, Math.min(1, motion.targetPresent + delta * (touchInput ? 0.0024 : 0.00033)));
    };
    const onWheel = event => {
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? contenedor.clientHeight : 1;
      input(event.deltaY * unit);
    };
    const onPointerDown = event => {
      if (event.pointerType === 'mouse') return;
      touch = { id: event.pointerId, y: event.clientY };
      contenedor.setPointerCapture(event.pointerId);
    };
    const onPointerMove = event => {
      if (touch?.id === event.pointerId) {
        input(touch.y - event.clientY, true);
        touch.y = event.clientY;
      } else if (event.pointerType === 'mouse') {
        const rect = contenedor.getBoundingClientRect();
        motion.pointerX = (event.clientX - rect.left) / rect.width * 2 - 1;
        motion.pointerY = (event.clientY - rect.top) / rect.height * 2 - 1;
      }
    };
    const onPointerEnd = () => { touch = null; };
    const onPointerLeave = () => { motion.pointerX = 0; motion.pointerY = 0; };
    const onVisibility = () => {
      cancelAnimationFrame(frame);
      previousTime = 0;
      if (!document.hidden && conveyor) frame = requestAnimationFrame(render);
    };
    const onContextLost = event => {
      event.preventDefault();
      conveyor = null;
      contenedor.style.display = 'none';
    };

    const observer = new ResizeObserver(resize);
    observer.observe(contenedor);
    contenedor.addEventListener('wheel', onWheel, { passive: true });
    contenedor.addEventListener('pointerdown', onPointerDown);
    contenedor.addEventListener('pointermove', onPointerMove);
    contenedor.addEventListener('pointerup', onPointerEnd);
    contenedor.addEventListener('pointercancel', onPointerEnd);
    contenedor.addEventListener('pointerleave', onPointerLeave);
    document.addEventListener('visibilitychange', onVisibility);
    canvas.addEventListener('webglcontextlost', onContextLost);

    Promise.all(CARAS.map(src => new Promise(resolve => {
      const image = new Image();
      image.decoding = 'async';
      image.onload = () => resolve(image);
      image.onerror = () => resolve(null);
      image.src = src;
    }))).then(images => {
      if (!activo) return;
      try {
        conveyor = createConveyor(canvas, images, CARAS.length);
        resize();
        contenedor.dataset.listo = 'true';
        frame = requestAnimationFrame(render);
      } catch (error) {
        console.warn('Cinta de paisajes no disponible:', error?.message || error);
        contenedor.style.display = 'none';
      }
    });

    return () => {
      activo = false;
      cancelAnimationFrame(frame);
      observer.disconnect();
      contenedor.removeEventListener('wheel', onWheel);
      contenedor.removeEventListener('pointerdown', onPointerDown);
      contenedor.removeEventListener('pointermove', onPointerMove);
      contenedor.removeEventListener('pointerup', onPointerEnd);
      contenedor.removeEventListener('pointercancel', onPointerEnd);
      contenedor.removeEventListener('pointerleave', onPointerLeave);
      document.removeEventListener('visibilitychange', onVisibility);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      conveyor?.gl.getExtension('WEBGL_lose_context')?.loseContext();
      conveyor = null;
    };
  }, []);

  return (
    <div
      ref={contenedorRef}
      aria-hidden="true"
      className={`cinta-paisajes touch-none ${className}`}
    >
      <canvas ref={canvasRef} className="block h-full w-full" style={{ filter: 'drop-shadow(20px 32px 28px rgb(10 59 50 / 0.35))' }} />
    </div>
  );
}
