// Chinatown Wars tarzı çizgi-roman konturu (derinlik kenar tespiti) + yumuşak renk düzenleme + vinyet
import * as THREE from 'three';

export class Post {
  constructor(renderer) {
    this.r = renderer; const s = renderer.getDrawingBufferSize(new THREE.Vector2());
    const depthTexture = new THREE.DepthTexture(s.x, s.y); depthTexture.type = THREE.UnsignedIntType;
    this.rt = new THREE.WebGLRenderTarget(s.x, s.y, { samples: 4, depthTexture, type: THREE.HalfFloatType });
    this.mat = new THREE.ShaderMaterial({
      uniforms: { tColor: { value: this.rt.texture }, tDepth: { value: depthTexture }, res: { value: new THREE.Vector2(s.x, s.y) }, cameraNear: { value: 2 }, cameraFar: { value: 700 }, strength: { value: 0.92 }, px: { value: 1.4 }, warm: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: `
        #include <packing>
        uniform sampler2D tColor; uniform sampler2D tDepth; uniform vec2 res; uniform float cameraNear, cameraFar, strength, px, warm; varying vec2 vUv;
        float vz(vec2 uv){ return -perspectiveDepthToViewZ(texture2D(tDepth, uv).x, cameraNear, cameraFar); }
        void main(){
          vec4 c = texture2D(tColor, vUv);
          vec2 o = px / res; float d = vz(vUv);
          float e = 0.0;
          e += abs(vz(vUv + vec2(o.x, 0.0)) - d); e += abs(vz(vUv - vec2(o.x, 0.0)) - d);
          e += abs(vz(vUv + vec2(0.0, o.y)) - d); e += abs(vz(vUv - vec2(0.0, o.y)) - d);
          e /= max(d, 1.0);
          float edge = smoothstep(0.012, 0.04, e) * step(d, cameraFar * 0.6);
          vec3 col = c.rgb * (1.0 - edge * strength);
          // vinyet + sıcak tonlama
          vec2 q = vUv - 0.5; float vig = 1.0 - dot(q, q) * 0.55; col *= vig;
          col = mix(col, col * vec3(1.06, 1.0, 0.92), warm);
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
      depthTest: false, depthWrite: false,
    });
    this.mat.toneMapped = true;
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat); this.quad.frustumCulled = false;
    this.qs = new THREE.Scene(); this.qs.add(this.quad); this.qc = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.enabled = true;
  }
  resize() { const s = this.r.getDrawingBufferSize(new THREE.Vector2()); this.rt.setSize(s.x, s.y); this.mat.uniforms.res.value.set(s.x, s.y); this.mat.uniforms.px.value = Math.max(1, this.r.getPixelRatio() * 1.1); }
  render(scene, camera) {
    if (!this.enabled) { this.r.setRenderTarget(null); this.r.render(scene, camera); return; }
    this.mat.uniforms.cameraNear.value = camera.near; this.mat.uniforms.cameraFar.value = camera.far;
    this.r.setRenderTarget(this.rt); this.r.render(scene, camera);
    this.r.setRenderTarget(null); this.r.render(this.qs, this.qc);
  }
}
