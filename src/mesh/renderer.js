const VERTEX_SHADER = `
attribute vec2 a_position;
attribute vec2 a_uv;
uniform vec2 u_scale;
uniform vec2 u_offset;
uniform float u_rotation;
varying vec2 v_uv;
void main() {
  float c = cos(u_rotation);
  float s = sin(u_rotation);
  vec2 rotated = vec2(
    a_position.x * c - a_position.y * s,
    a_position.x * s + a_position.y * c
  );
  vec2 p = rotated * u_scale + u_offset;
  // Mesh coordinates are image-space (top=-1, bottom=+1). Clip-space is bottom=-1, top=+1.
  gl_Position = vec4(p.x, -p.y, 0.0, 1.0);
  v_uv = a_uv;
}`;

const FRAGMENT_SHADER = `
precision mediump float;
uniform sampler2D u_texture;
uniform sampler2D u_texture_b;
uniform float u_mix;
uniform float u_opacity;
varying vec2 v_uv;
void main() {
  vec4 a = texture2D(u_texture, v_uv);
  vec4 b = texture2D(u_texture_b, v_uv);
  vec4 color = mix(a, b, clamp(u_mix, 0.0, 1.0));
  gl_FragColor = vec4(color.rgb * u_opacity, color.a * u_opacity);
}`;

const LINE_VERTEX_SHADER = `
attribute vec2 a_position;
uniform vec2 u_scale;
uniform vec2 u_offset;
uniform float u_rotation;
void main() {
  float c = cos(u_rotation);
  float s = sin(u_rotation);
  vec2 rotated = vec2(
    a_position.x * c - a_position.y * s,
    a_position.x * s + a_position.y * c
  );
  vec2 p = rotated * u_scale + u_offset;
  gl_Position = vec4(p.x, -p.y, 0.0, 1.0);
}`;

const LINE_FRAGMENT_SHADER = `
precision mediump float;
uniform vec4 u_color;
void main() { gl_FragColor = u_color; }
`;

function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) || "shader compile failed";
    gl.deleteShader(shader);
    throw new Error(message);
  }
  return shader;
}

function createProgram(gl, vertexSource, fragmentSource) {
  const program = gl.createProgram();
  const vertex = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(program) || "program link failed";
    gl.deleteProgram(program);
    throw new Error(message);
  }
  return program;
}

function makeLocations(gl, program, textured) {
  return {
    position: gl.getAttribLocation(program, "a_position"),
    uv: textured ? gl.getAttribLocation(program, "a_uv") : -1,
    scale: gl.getUniformLocation(program, "u_scale"),
    offset: gl.getUniformLocation(program, "u_offset"),
    rotation: gl.getUniformLocation(program, "u_rotation"),
    texture: textured ? gl.getUniformLocation(program, "u_texture") : null,
    textureB: textured ? gl.getUniformLocation(program, "u_texture_b") : null,
    mix: textured ? gl.getUniformLocation(program, "u_mix") : null,
    opacity: textured ? gl.getUniformLocation(program, "u_opacity") : null,
    color: textured ? null : gl.getUniformLocation(program, "u_color"),
  };
}

export class WebGLMeshRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = canvas.getContext("webgl2", { alpha: true, antialias: true, premultipliedAlpha: true })
      || canvas.getContext("webgl", { alpha: true, antialias: true, premultipliedAlpha: true });
    if (!this.gl) throw new Error("WebGL을 사용할 수 없습니다.");
    const gl = this.gl;
    this.program = createProgram(gl, VERTEX_SHADER, FRAGMENT_SHADER);
    this.lineProgram = createProgram(gl, LINE_VERTEX_SHADER, LINE_FRAGMENT_SHADER);
    this.locations = makeLocations(gl, this.program, true);
    this.lineLocations = makeLocations(gl, this.lineProgram, false);
    this.positionBuffer = gl.createBuffer();
    this.uvBuffer = gl.createBuffer();
    this.indexBuffer = gl.createBuffer();
    this.lineIndexBuffer = gl.createBuffer();
    this.textureCache = new Map();
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    // UVs intentionally use DOM/image top-origin. Flipping here inverts the entire character.
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.clearColor(0, 0, 0, 0);
  }

  resize(width, height, dpr = 1) {
    const pixelWidth = Math.max(1, Math.round(width * dpr));
    const pixelHeight = Math.max(1, Math.round(height * dpr));
    if (this.canvas.width !== pixelWidth || this.canvas.height !== pixelHeight) {
      this.canvas.width = pixelWidth;
      this.canvas.height = pixelHeight;
    }
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.width = width;
    this.height = height;
    this.gl.viewport(0, 0, pixelWidth, pixelHeight);
  }

  clear() { this.gl.clear(this.gl.COLOR_BUFFER_BIT); }

  fitScale(image, occupancy = 0.84) {
    const canvasAspect = Math.max(1e-6, (this.width || 1) / (this.height || 1));
    const imageAspect = Math.max(1e-6, (image.naturalWidth || image.width || 1) / (image.naturalHeight || image.height || 1));
    let sy = occupancy;
    let sx = sy * imageAspect / canvasAspect;
    if (sx > occupancy) {
      sx = occupancy;
      sy = sx * canvasAspect / imageAspect;
    }
    return [sx, sy];
  }

  getTexture(image) {
    if (this.textureCache.has(image)) return this.textureCache.get(image);
    const gl = this.gl;
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    this.textureCache.set(image, texture);
    return texture;
  }

  drawMesh(image, positions, uvs, indices, options = {}) {
    return this.drawMeshBlend(image, image, positions, uvs, indices, 0, options);
  }

  drawMeshBlend(imageA, imageB, positions, uvs, indices, mixAmount = 0, options = {}) {
    const gl = this.gl;
    const locations = this.locations;
    gl.useProgram(this.program);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(locations.position);
    gl.vertexAttribPointer(locations.position, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.uvBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, uvs, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(locations.uv);
    gl.vertexAttribPointer(locations.uv, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.DYNAMIC_DRAW);

    const scale = options.scale || [1, 1];
    const offset = options.offset || [0, 0];
    gl.uniform2f(locations.scale, scale[0], scale[1]);
    gl.uniform2f(locations.offset, offset[0], offset[1]);
    gl.uniform1f(locations.rotation, Number(options.rotation) || 0);
    gl.uniform1f(locations.opacity, Math.max(0, Math.min(1, Number(options.opacity ?? 1))));
    gl.uniform1f(locations.mix, Math.max(0, Math.min(1, Number(mixAmount) || 0)));

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.getTexture(imageA));
    gl.uniform1i(locations.texture, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.getTexture(imageB || imageA));
    gl.uniform1i(locations.textureB, 1);
    gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);
  }

  drawWireframe(positions, lineIndices, options = {}) {
    const gl = this.gl;
    const locations = this.lineLocations;
    gl.useProgram(this.lineProgram);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(locations.position);
    gl.vertexAttribPointer(locations.position, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.lineIndexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, lineIndices, gl.DYNAMIC_DRAW);
    const scale = options.scale || [1, 1];
    const offset = options.offset || [0, 0];
    gl.uniform2f(locations.scale, scale[0], scale[1]);
    gl.uniform2f(locations.offset, offset[0], offset[1]);
    gl.uniform1f(locations.rotation, Number(options.rotation) || 0);
    const color = options.color || [1, 0.47, 0.73, 0.32];
    gl.uniform4f(locations.color, color[0], color[1], color[2], color[3]);
    gl.drawElements(gl.LINES, lineIndices.length, gl.UNSIGNED_SHORT, 0);
  }

  destroy() {
    const gl = this.gl;
    for (const texture of this.textureCache.values()) gl.deleteTexture(texture);
    this.textureCache.clear();
    gl.deleteBuffer(this.positionBuffer);
    gl.deleteBuffer(this.uvBuffer);
    gl.deleteBuffer(this.indexBuffer);
    gl.deleteBuffer(this.lineIndexBuffer);
    gl.deleteProgram(this.program);
    gl.deleteProgram(this.lineProgram);
  }
}
