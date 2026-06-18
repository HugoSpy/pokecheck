import { useEffect, useRef } from 'react';
import * as THREE from 'three';

const CANVAS_WIDTH = 300;
const CANVAS_HEIGHT = 450;

type BoosterPack3DProps = {
  textureUrl?: string;
  textureFlipY?: boolean;
  textureMaterialName?: string | null;
  textureMeshName?: string;
  transparentMeshName?: string;
  /** Optional CSS *display* size in px (visual size only). When set, the canvas
   *  still renders at a high internal resolution and is downscaled via CSS, so
   *  small boosters stay crisp. When omitted (Shop.tsx / Battle.tsx), the canvas
   *  keeps its original 300x450 buffer and is sized by their own CSS. */
  width?: number;
  height?: number;
};

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

export default function BoosterPack3D({
  textureUrl = '/booster-gen-4.png',
  textureFlipY = true,
  width,
  height,
}: BoosterPack3DProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const currentCanvas = canvas;

    let frameId = 0;

    const mouse = { x: 0, y: 0, active: false };
    const tilt = { x: 0, y: 0 };

    // Decouple internal render resolution (kept high for crispness) from the CSS
    // display size. When a display size is given (e.g. the compact booster in
    // Profile), we still render ~CANVAS_HEIGHT px tall and let the browser
    // downscale via CSS, instead of shrinking the WebGL buffer (which looked
    // blurry/pixelated). Shop.tsx / Battle.tsx pass no size: original 300x450
    // buffer, display handled by their own CSS.
    const hasDisplaySize = width != null && height != null;
    const renderHeight = CANVAS_HEIGHT;
    const renderWidth = hasDisplaySize
      ? Math.round(CANVAS_HEIGHT * (width / height))
      : CANVAS_WIDTH;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, renderWidth / renderHeight, 0.1, 100);
    camera.position.set(0, 0.05, 5.2);

    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
    });
    renderer.setClearColor(0x000000, 0);
    // Use the device pixel ratio (capped) so high-density screens stay sharp.
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 3));
    renderer.setSize(renderWidth, renderHeight, false);
    if (hasDisplaySize) {
      // Visual size only - the high-res buffer is downscaled into this box.
      currentCanvas.style.width = `${width}px`;
      currentCanvas.style.height = `${height}px`;
    }

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
    // Anisotropic filtering keeps the texture sharp at oblique angles / small sizes.
    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
    const texture = textureLoader.load(textureUrl, (loadedTexture) => {
      loadedTexture.flipY = textureFlipY;
      loadedTexture.colorSpace = THREE.SRGBColorSpace;
      loadedTexture.anisotropy = maxAnisotropy;
      loadedTexture.needsUpdate = true;
    });
    texture.flipY = textureFlipY;
    texture.anisotropy = maxAnisotropy;

    const geometry = new THREE.PlaneGeometry(1.8, 2.8);
    const material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: texture,
      metalness: 0.15,
      roughness: 0.45,
      side: THREE.DoubleSide,
    });
    const plane = new THREE.Mesh(geometry, material);
    plane.rotation.y = 0.05;
    packGroup.add(plane);

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
      cancelAnimationFrame(frameId);
      currentCanvas.removeEventListener('mousemove', handleMouseMove);
      currentCanvas.removeEventListener('mouseleave', handleMouseLeave);
      disposeObject(packGroup);
      texture.dispose();
      renderer.dispose();
    };
  }, [textureFlipY, textureUrl, width, height]);

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
