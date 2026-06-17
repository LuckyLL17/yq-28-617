import { useState, useEffect, useCallback, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, SoftShadows } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette, ChromaticAberration } from '@react-three/postprocessing';
import * as THREE from 'three';
import { useGameStore, MaterialType, generateId, materialProperties, GravityDirection, BlockData, BlueprintData } from '@/store/gameStore';
import { usePhysics } from '@/hooks/usePhysics';
import { Block } from './Block';
import { generateBuilding, generateCastle } from './BuildingGenerator';
import { Particles, ExplosionEffect, spawnParticles } from './Particles';
import { WeaponSystem, WeaponAimIndicator } from './WeaponSystem';
import { ControlPanel } from './ControlPanel';
import { DebrisSystem } from './DebrisSystem';
import { BuildMode } from './BuildMode';
import { AudioControlPanel } from './AudioControlPanel';
import { SprayTool } from './SprayTool';
import { RoboticArm } from './RoboticArm';
import { PhysicsLab } from './PhysicsLab';

interface ExplosionInstance {
  id: string;
  position: [number, number, number];
  radius: number;
}

function PhysicsStepper({ step }: { step: (delta: number) => void }) {
  useFrame((_, delta) => {
    step(Math.min(delta, 1 / 30));
  });
  return null;
}

function DebugExporter() {
  const { scene, camera } = useThree();
  useEffect(() => {
    const w = window as any;
    w.__SCENE__ = scene;
    w.__CAMERA__ = camera;
    w.__USE_STORE__ = useGameStore;
  }, [scene, camera]);
  return null;
}

function Ground({ gravityDirection }: { gravityDirection: GravityDirection }) {
  const getGroundTransform = () => {
    switch (gravityDirection) {
      case 'down':
      default:
        return { rotation: [-Math.PI / 2, 0, 0] as [number, number, number], position: [0, 0, 0] as [number, number, number], circlePos: [0, 0.01, 0] as [number, number, number], ringPos: [0, 0.02, 0] as [number, number, number] };
      case 'up':
        return { rotation: [Math.PI / 2, 0, 0] as [number, number, number], position: [0, 50, 0] as [number, number, number], circlePos: [0, 50 - 0.01, 0] as [number, number, number], ringPos: [0, 50 - 0.02, 0] as [number, number, number] };
      case 'left':
        return { rotation: [0, Math.PI / 2, 0] as [number, number, number], position: [-50, 0, 0] as [number, number, number], circlePos: [-50 + 0.01, 0, 0] as [number, number, number], ringPos: [-50 + 0.02, 0, 0] as [number, number, number] };
      case 'right':
        return { rotation: [0, -Math.PI / 2, 0] as [number, number, number], position: [50, 0, 0] as [number, number, number], circlePos: [50 - 0.01, 0, 0] as [number, number, number], ringPos: [50 - 0.02, 0, 0] as [number, number, number] };
      case 'forward':
        return { rotation: [0, 0, 0] as [number, number, number], position: [0, 0, 50] as [number, number, number], circlePos: [0, 0, 50 - 0.01] as [number, number, number], ringPos: [0, 0, 50 - 0.02] as [number, number, number] };
      case 'backward':
        return { rotation: [Math.PI, 0, 0] as [number, number, number], position: [0, 0, -50] as [number, number, number], circlePos: [0, 0, -50 + 0.01] as [number, number, number], ringPos: [0, 0, -50 + 0.02] as [number, number, number] };
    }
  };

  const { rotation, position, circlePos, ringPos } = getGroundTransform();

  return (
    <>
      <mesh rotation={rotation} position={position} receiveShadow>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial
          color="#2a2a35"
          roughness={0.9}
          metalness={0.1}
        />
      </mesh>
      <mesh rotation={rotation} position={circlePos} receiveShadow>
        <circleGeometry args={[30, 64]} />
        <meshStandardMaterial
          color="#3a3a4a"
          roughness={0.8}
          metalness={0.1}
        />
      </mesh>
      <mesh rotation={rotation} position={ringPos}>
        <ringGeometry args={[28, 30, 64]} />
        <meshStandardMaterial
          color="#4a4a5a"
          roughness={0.7}
          emissive="#222233"
          emissiveIntensity={0.3}
        />
      </mesh>
    </>
  );
}

function SceneLighting() {
  return (
    <>
      <ambientLight intensity={0.7} color="#ffffff" />
      <directionalLight
        position={[15, 30, 15]}
        intensity={2.2}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={100}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
        shadow-bias={-0.0001}
      >
        <orthographicCamera
          attach="shadow-camera"
          args={[-30, 30, 30, -30, 0.1, 100]}
        />
      </directionalLight>
      <pointLight position={[-10, 10, -10]} intensity={0.8} color="#ffaa88" distance={60} />
      <pointLight position={[10, 12, 10]} intensity={0.6} color="#88aaff" distance={60} />
      <hemisphereLight intensity={0.6} color="#aaccff" groundColor="#667788" />
    </>
  );
}

function BuildSceneLighting() {
  return (
    <>
      <ambientLight intensity={0.8} color="#ffffff" />
      <directionalLight
        position={[20, 40, 20]}
        intensity={2.5}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={100}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
        shadow-bias={-0.0001}
      >
        <orthographicCamera
          attach="shadow-camera"
          args={[-30, 30, 30, -30, 0.1, 100]}
        />
      </directionalLight>
      <hemisphereLight intensity={0.7} color="#ccddff" groundColor="#557755" />
    </>
  );
}

export function GameScene() {
  const gameMode = useGameStore((s) => s.gameMode);
  const gravityDirection = useGameStore((s) => s.gravityDirection);

  const blocks = useGameStore((s) => s.blocks);
  const addBlocks = useGameStore((s) => s.addBlocks);
  const resetGame = useGameStore((s) => s.resetGame);
  const setWreckingBallActive = useGameStore((s) => s.setWreckingBallActive);

  const {
    addBody,
    removeBody,
    getBody,
    addConstraint,
    removeConstraint,
    step,
    applyExplosion,
  } = usePhysics();

  const [explosions, setExplosions] = useState<ExplosionInstance[]>([]);
  const [buildingGenerated, setBuildingGenerated] = useState(false);
  const [rebuildCounter, setRebuildCounter] = useState(0);
  const initRef = useRef(false);
  const lastGravityRef = useRef<GravityDirection>(gravityDirection);
  const spawnDebrisRef = useRef<((position: [number, number, number], size: [number, number, number], material: MaterialType, sprayColors?: string[]) => void) | null>(null);

  const handleDestroyBlock = useCallback((position: [number, number, number], material: MaterialType) => {
    requestAnimationFrame(() => {
      spawnParticles(position, material, material === 'glass' ? 25 : 15);
    });
  }, []);

  const handleSpawnDebris = useCallback((position: [number, number, number], size: [number, number, number], material: MaterialType, sprayColors?: string[]) => {
    if (spawnDebrisRef.current) {
      spawnDebrisRef.current(position, size, material, sprayColors);
    }
  }, []);

  const registerSpawner = useCallback((spawner: (position: [number, number, number], size: [number, number, number], material: MaterialType, sprayColors?: string[]) => void) => {
    spawnDebrisRef.current = spawner;
  }, []);

  const handleExplosion = useCallback((position: [number, number, number], radius: number) => {
    const id = generateId();
    setExplosions((prev) => [...prev, { id, position, radius }]);

    requestAnimationFrame(() => {
      const state = useGameStore.getState();
      const blocks = state.blocks;
      const damageBlock = state.damageBlock;
      const addParticle = state.addParticle;

      const [px, py, pz] = position;
      const damageRadius = radius * 1.5;

      blocks.forEach((block, blockId) => {
        const [bx, by, bz] = block.position;
        const dx = bx - px;
        const dy = by - py;
        const dz = bz - pz;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (dist < damageRadius) {
          const falloff = 1 - dist / damageRadius;
          const baseDamage = materialProperties[block.material].health;
          const damage = baseDamage * falloff * 2.5 + 20;

          if (damageBlock(blockId, damage)) {
            requestAnimationFrame(() => {
              spawnParticles([bx, by, bz], block.material, block.material === 'glass' ? 30 : 20);
              if (spawnDebrisRef.current) {
                const sprayPoints = useGameStore.getState().getBlockSprayPoints(blockId);
                const sprayColors = sprayPoints.map((p) => p.color).filter((c, i, arr) => arr.indexOf(c) === i);
                spawnDebrisRef.current([bx, by, bz], block.size, block.material, sprayColors);
              }
            });
          }
        }
      });

      const colors = ['#ff6600', '#ffaa00', '#ff3300', '#ffff00', '#ff8844', '#ffcc00'];
      for (let i = 0; i < 100; i++) {
        const angle = Math.random() * Math.PI * 2;
        const upAngle = Math.random() * Math.PI;
        const speed = 10 + Math.random() * 25;
        const vx = Math.cos(angle) * Math.sin(upAngle) * speed;
        const vy = Math.cos(upAngle) * speed;
        const vz = Math.sin(angle) * Math.sin(upAngle) * speed;

        addParticle({
          id: generateId(),
          position: [
            position[0] + (Math.random() - 0.5) * 1.5,
            position[1] + (Math.random() - 0.5) * 1.5,
            position[2] + (Math.random() - 0.5) * 1.5,
          ],
          velocity: [vx, vy, vz],
          color: colors[Math.floor(Math.random() * colors.length)],
          size: 0.25 + Math.random() * 0.5,
          life: 2 + Math.random() * 2.5,
          maxLife: 4.5,
        });
      }

      spawnParticles(position, 'concrete', 40);
      spawnParticles(position, 'wood', 30);
    });
  }, []);

  const removeExplosion = useCallback((id: string) => {
    setExplosions((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const handleRegenerateBuilding = useCallback((type: 'building' | 'castle') => {
    initRef.current = false;
    setWreckingBallActive(false);
    setRebuildCounter((c) => c + 1);

    const currentGravity = useGameStore.getState().gravityDirection;
    lastGravityRef.current = currentGravity;
    const buildingBlocks = type === 'building'
      ? generateBuilding({ width: 7, height: 5, depth: 5, blockSize: [1.2, 0.6, 1.2], gravityDirection: currentGravity })
      : generateCastle({ width: 9, height: 4, depth: 7, blockSize: [1, 0.5, 1], gravityDirection: currentGravity });

    resetGame();
    addBlocks(buildingBlocks);
    setBuildingGenerated(true);
    initRef.current = true;
  }, [resetGame, addBlocks, setWreckingBallActive]);

  const handleReset = useCallback(() => {
    initRef.current = false;
    setExplosions([]);
    setWreckingBallActive(false);
    setRebuildCounter((c) => c + 1);

    const currentGravity = useGameStore.getState().gravityDirection;
    lastGravityRef.current = currentGravity;
    const buildingBlocks = generateBuilding({ width: 7, height: 5, depth: 5, blockSize: [1.2, 0.6, 1.2], gravityDirection: currentGravity });

    resetGame();
    addBlocks(buildingBlocks);
    setBuildingGenerated(true);
    initRef.current = true;
  }, [resetGame, addBlocks, setWreckingBallActive]);

  const handleClearBuild = useCallback(() => {
    useGameStore.getState().clearBuildState();
  }, []);

  const handleSpawnRoboticArmBlocks = useCallback(() => {
    const materials: MaterialType[] = ['wood', 'concrete', 'glass'];
    const newBlocks: BlockData[] = [];

    for (let i = 0; i < 5; i++) {
      const material = materials[i % materials.length];
      const props = materialProperties[material];
      newBlocks.push({
        id: generateId(),
        position: [-4 + i * 2, 0.6, 2],
        size: [1, 1.2, 1],
        material,
        health: props.health,
        maxHealth: props.health,
        rotation: [0, 0, 0],
      });
    }

    for (let i = 0; i < 3; i++) {
      const material = materials[(i + 1) % materials.length];
      const props = materialProperties[material];
      newBlocks.push({
        id: generateId(),
        position: [-2 + i * 2, 1.8, 4],
        size: [1.2, 1, 1.2],
        material,
        health: props.health,
        maxHealth: props.health,
        rotation: [0, 0, 0],
      });
    }

    addBlocks(newBlocks);
  }, [addBlocks]);

  const handleResetRoboticArm = useCallback(() => {
    initRef.current = false;
    resetGame();
    useGameStore.getState().resetRoboticArm();
    handleSpawnRoboticArmBlocks();
    initRef.current = true;
  }, [resetGame, handleSpawnRoboticArmBlocks]);

  const handleResetPhysicsLab = useCallback(() => {
    initRef.current = false;
    useGameStore.getState().resetPhysicsLab();
    initRef.current = true;
  }, []);

  const handleLoadBlueprint = useCallback((blueprint: BlueprintData) => {
    initRef.current = false;
    setWreckingBallActive(false);
    setRebuildCounter((c) => c + 1);

    useGameStore.getState().loadBlueprint(blueprint.id);

    lastGravityRef.current = blueprint.gravityDirection;
    setBuildingGenerated(true);
    initRef.current = true;
  }, [setWreckingBallActive]);

  useEffect(() => {
    if (gameMode === 'destroy' && !initRef.current) {
      initRef.current = true;
      const currentGravity = useGameStore.getState().gravityDirection;
      lastGravityRef.current = currentGravity;
      const buildingBlocks = generateBuilding({ width: 7, height: 5, depth: 5, blockSize: [1.2, 0.6, 1.2], gravityDirection: currentGravity });
      addBlocks(buildingBlocks);
      setBuildingGenerated(true);
    }
  }, [addBlocks, gameMode]);

  useEffect(() => {
    if (gameMode === 'roboticArm' && !initRef.current) {
      initRef.current = true;
      resetGame();
      handleSpawnRoboticArmBlocks();
    }
  }, [gameMode, resetGame, handleSpawnRoboticArmBlocks]);

  useEffect(() => {
    if (gameMode === 'destroy' && buildingGenerated && gravityDirection !== lastGravityRef.current) {
      lastGravityRef.current = gravityDirection;
      initRef.current = false;
      setWreckingBallActive(false);
      setRebuildCounter((c) => c + 1);

      const buildingBlocks = generateBuilding({ width: 7, height: 5, depth: 5, blockSize: [1.2, 0.6, 1.2], gravityDirection });

      resetGame();
      addBlocks(buildingBlocks);
      initRef.current = true;
    }
  }, [gravityDirection, gameMode, buildingGenerated, resetGame, addBlocks, setWreckingBallActive]);

  const blockArray = Array.from(blocks.values());

  return (
    <div className="w-full h-screen bg-black relative overflow-hidden">
      <Canvas
        shadows
        camera={{ position: [8, 8, 15], fov: 55, near: 0.1, far: 200 }}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        dpr={[1, 2]}
      >
        <color attach="background" args={[gameMode === 'build' ? '#1a2a1a' : gameMode === 'roboticArm' ? '#1a1a2e' : gameMode === 'physicsLab' ? '#0f172a' : '#2a2a4e']} />
        <fog attach="fog" args={[gameMode === 'build' ? '#1a2a1a' : gameMode === 'roboticArm' ? '#1a1a2e' : gameMode === 'physicsLab' ? '#0f172a' : '#2a2a4e', 60, 120]} />

        {gameMode === 'build' ? <BuildSceneLighting /> : <SceneLighting />}

        <SoftShadows size={15} samples={10} focus={0.5} />

        <DebugExporter />

        {gameMode === 'destroy' && <Ground gravityDirection={gravityDirection} />}

        {gameMode === 'destroy' && buildingGenerated && blockArray.map((block) => (
          <Block
            key={block.id}
            id={block.id}
            position={block.position}
            size={block.size}
            material={block.material}
            addPhysicsBody={addBody}
            removePhysicsBody={removeBody}
            getPhysicsBody={getBody}
            onDestroy={handleDestroyBlock}
            spawnDebris={handleSpawnDebris}
          />
        ))}

        {gameMode === 'destroy' && (
          <DebrisSystem
            addPhysicsBody={addBody}
            removePhysicsBody={removeBody}
            getPhysicsBody={getBody}
            registerSpawner={registerSpawner}
          />
        )}

        {gameMode === 'destroy' && <Particles maxParticles={1000} />}

        {gameMode === 'destroy' && explosions.map((explosion) => (
          <ExplosionEffect
            key={explosion.id}
            position={explosion.position}
            radius={explosion.radius}
            onComplete={() => removeExplosion(explosion.id)}
          />
        ))}

        {gameMode === 'destroy' && (
          <WeaponSystem
            addPhysicsBody={addBody}
            removePhysicsBody={removeBody}
            getPhysicsBody={getBody}
            addConstraint={addConstraint}
            removeConstraint={removeConstraint}
            applyExplosion={applyExplosion}
            onExplosion={handleExplosion}
            rebuildCounter={rebuildCounter}
          />
        )}

        {gameMode === 'destroy' && <WeaponAimIndicator />}

        {gameMode === 'build' && <BuildMode />}

        {gameMode === 'roboticArm' && <Ground gravityDirection={gravityDirection} />}

        {gameMode === 'roboticArm' && blockArray.map((block) => (
          <Block
            key={block.id}
            id={block.id}
            position={block.position}
            size={block.size}
            material={block.material}
            addPhysicsBody={addBody}
            removePhysicsBody={removeBody}
            getPhysicsBody={getBody}
            onDestroy={handleDestroyBlock}
            spawnDebris={handleSpawnDebris}
          />
        ))}

        {gameMode === 'roboticArm' && (
          <RoboticArm
            addPhysicsBody={addBody}
            removePhysicsBody={removeBody}
            getPhysicsBody={getBody}
          />
        )}

        {gameMode === 'roboticArm' && <Particles maxParticles={500} />}

        {gameMode === 'physicsLab' && <Ground gravityDirection={gravityDirection} />}

        {gameMode === 'physicsLab' && (
          <PhysicsLab
            addPhysicsBody={addBody}
            removePhysicsBody={removeBody}
            getPhysicsBody={getBody}
            addConstraint={addConstraint}
            removeConstraint={removeConstraint}
          />
        )}

        {gameMode === 'physicsLab' && <Particles maxParticles={300} />}

        <SprayTool />

        <OrbitControls
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          minDistance={5}
          maxDistance={60}
          maxPolarAngle={Math.PI / 2 - 0.05}
          minPolarAngle={0.1}
          makeDefault
          target={(() => {
            switch (gravityDirection) {
              case 'down': return [0, gameMode === 'build' ? 1 : gameMode === 'roboticArm' ? 3 : gameMode === 'physicsLab' ? 3 : 3, 0];
              case 'up': return [0, gameMode === 'build' ? 49 : 47, 0];
              case 'left': return [-49, gameMode === 'build' ? 1 : 3, 0];
              case 'right': return [49, gameMode === 'build' ? 1 : 3, 0];
              case 'forward': return [0, gameMode === 'build' ? 1 : 3, 49];
              case 'backward': return [0, gameMode === 'build' ? 1 : 3, -49];
              default: return [0, gameMode === 'build' ? 1 : 3, 0];
            }
          })()}
        />

        {(gameMode === 'destroy' || gameMode === 'roboticArm' || gameMode === 'physicsLab') && <PhysicsStepper step={step} />}

        <EffectComposer multisampling={8} enableNormalPass={false}>
          <Bloom
            intensity={gameMode === 'build' ? 0.3 : gameMode === 'roboticArm' ? 0.5 : gameMode === 'physicsLab' ? 0.7 : 0.6}
            luminanceThreshold={0.6}
            luminanceSmoothing={0.9}
            mipmapBlur
          />
          <ChromaticAberration
            offset={new THREE.Vector2(0.0008, 0.0008)}
            radialModulation={false}
            modulationOffset={0}
          />
          <Vignette eskil={false} offset={0.3} darkness={gameMode === 'build' ? 0.4 : gameMode === 'roboticArm' ? 0.5 : gameMode === 'physicsLab' ? 0.6 : 0.7} />
        </EffectComposer>
      </Canvas>

      <ControlPanel
        onReset={handleReset}
        onRegenerateBuilding={handleRegenerateBuilding}
        onClearBuild={handleClearBuild}
        onResetRoboticArm={handleResetRoboticArm}
        onResetPhysicsLab={handleResetPhysicsLab}
        onLoadBlueprint={handleLoadBlueprint}
      />

      {gameMode === 'destroy' && <AudioControlPanel />}
    </div>
  );
}

export default GameScene;
