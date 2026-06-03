import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const CANVAS_WIDTH = 300;
const CANVAS_HEIGHT = 450;

function disposeObject(object: THREE.Object3D): void {
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;

    child.geometry.dispose();

    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((material) => {
      const maybeMapped = material as THREE.Material & { map?: THREE.Texture | null };
      maybeMapped.map?.dispose();
      material.dispose();
    });
  });
}

export default function BoosterPack3D() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const currentCanvas = canvas;

    let frameId = 0;
    let disposed = false;

    const mouse = { x: 0, y: 0, active: false };
    const tilt = { x: 0, y: 0 };

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, CANVAS_WIDTH / CANVAS_HEIGHT, 0.1, 100);
    camera.position.set(0, 0.05, 5.2);

    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
    });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(CANVAS_WIDTH, CANVAS_HEIGHT, false);

    scene.add(new THREE.AmbientLight(0xffffff, 3.0));

    const frontLight = new THREE.DirectionalLight(0xffffff, 3.0);
    frontLight.position.set(0, 5, 10);
    scene.add(frontLight);

    const sideLight = new THREE.DirectionalLight(0xffffff, 1.5);
    sideLight.position.set(5, 5, 5);
    scene.add(sideLight);

    const packGroup = new THREE.Group();
    scene.add(packGroup);

    const textureLoader = new THREE.TextureLoader();
    const texture = textureLoader.load('/booster-gen-4.png', (loadedTexture) => {
      loadedTexture.flipY = true;
      loadedTexture.colorSpace = THREE.SRGBColorSpace;
      loadedTexture.needsUpdate = true;
    });
    texture.flipY = true;

    const gltfLoader = new GLTFLoader();
    gltfLoader.load('/booster_pack_tcg_pack.glb', (gltf) => {
      if (disposed) {
        disposeObject(gltf.scene);
        return;
      }

      const root = gltf.scene;

      root.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return;

        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach((material) => {
          if (!(material instanceof THREE.MeshStandardMaterial)) return;
          if (material.name === 'Material.003') {
            material.color.set(0xffffff);
            material.metalness = 0.9;
            material.map = texture;
          } else {
            material.color.set(0x2a2a2a);
            material.map = null;
          }
          material.needsUpdate = true;
        });

        const hasMat003 = (Array.isArray(child.material) ? child.material : [child.material])
          .some(m => m.name === 'Material.003');
        if (!hasMat003) return;

        child.scale.set(1.15, 1.1, 1.0);

        const uv = child.geometry.attributes.uv;
        if (!uv) return;
        let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
        for (let i = 0; i < uv.count; i++) {
          minU = Math.min(minU, uv.getX(i));
          maxU = Math.max(maxU, uv.getX(i));
          minV = Math.min(minV, uv.getY(i));
          maxV = Math.max(maxV, uv.getY(i));
        }
        for (let i = 0; i < uv.count; i++) {
          uv.setXY(i,
            (uv.getX(i) - minU) / (maxU - minU),
            (uv.getY(i) - minV) / (maxV - minV),
          );
        }
        uv.needsUpdate = true;
      });

      root.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(root);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);

      if (maxDim > 0) {
        root.scale.setScalar(3.2 / maxDim);
      }

      root.position.sub(center);
      root.rotation.set(0, 0, 0);
      packGroup.add(root);
    });

    function handleMouseMove(event: MouseEvent): void {
      const rect = currentCanvas.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
      mouse.y = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
      mouse.active = true;
    }

    function handleMouseLeave(): void {
      mouse.active = false;
    }

    currentCanvas.addEventListener('mousemove', handleMouseMove);
    currentCanvas.addEventListener('mouseleave', handleMouseLeave);

    function animate(timestamp: number): void {
      frameId = requestAnimationFrame(animate);

      const t = timestamp / 1000;
      const targetRotationX = mouse.active ? -mouse.y * 0.15 : 0;
      const targetRotationY = mouse.active ? -mouse.x * 0.15 : 0;

      tilt.x += (targetRotationX - tilt.x) * 0.08;
      tilt.y += (targetRotationY - tilt.y) * 0.08;

      packGroup.position.y = Math.sin(t * 1.2) * 0.08;
      packGroup.rotation.x = tilt.x;
      packGroup.rotation.y = tilt.y;
      packGroup.rotation.z = Math.sin(t * 0.8) * 0.03;

      renderer.render(scene, camera);
    }

    frameId = requestAnimationFrame(animate);

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      currentCanvas.removeEventListener('mousemove', handleMouseMove);
      currentCanvas.removeEventListener('mouseleave', handleMouseLeave);
      disposeObject(packGroup);
      texture.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="booster-pack-3d"
      width={CANVAS_WIDTH}
      height={CANVAS_HEIGHT}
      aria-label="Booster pack 3D interactif"
    />
  );
}
