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
  /** Canvas render size in px. Defaults preserve the original 300x450 used by
   *  Shop.tsx / Battle.tsx. Keep a ~2:3 ratio to match the booster plane. */
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
  width = CANVAS_WIDTH,
  height = CANVAS_HEIGHT,
}: BoosterPack3DProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const currentCanvas = canvas;

    let frameId = 0;

    const mouse = { x: 0, y: 0, active: false };
    const tilt = { x: 0, y: 0 };

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 100);
    camera.position.set(0, 0.05, 5.2);

    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
    });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height, false);

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
    const texture = textureLoader.load(textureUrl, (loadedTexture) => {
      loadedTexture.flipY = textureFlipY;
      loadedTexture.colorSpace = THREE.SRGBColorSpace;
      loadedTexture.needsUpdate = true;
    });
    texture.flipY = textureFlipY;

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
      width={width}
      height={height}
      aria-label="Booster pack 3D interactif"
    />
  );
}
