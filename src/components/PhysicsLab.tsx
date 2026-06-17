import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { useGameStore, LabObjectData, LabConstraintData, generateId, LabObjectType } from '@/store/gameStore';

interface PhysicsLabProps {
  addPhysicsBody: (id: string, body: CANNON.Body) => void;
  removePhysicsBody: (id: string) => void;
  getPhysicsBody: (id: string) => CANNON.Body | undefined;
  addConstraint: (constraint: CANNON.Constraint) => boolean;
  removeConstraint: (constraint: CANNON.Constraint) => void;
}

const OBJECT_COLORS: Record<LabObjectType, string> = {
  box: '#4a90d9',
  sphere: '#e74c3c',
  cylinder: '#2ecc71',
  groundAnchor: '#95a5a6',
  weight: '#34495e',
};

function createPhysicsBody(obj: LabObjectData): CANNON.Body {
  const body = new CANNON.Body({
    mass: obj.isStatic ? 0 : obj.mass,
    position: new CANNON.Vec3(obj.position[0], obj.position[1], obj.position[2]),
    type: obj.isStatic ? CANNON.Body.STATIC : CANNON.Body.DYNAMIC,
  });

  switch (obj.type) {
    case 'box':
      const size = obj.size || [1, 1, 1];
      body.addShape(new CANNON.Box(new CANNON.Vec3(size[0] / 2, size[1] / 2, size[2] / 2)));
      break;
    case 'sphere':
      const radius = obj.radius || 0.5;
      body.addShape(new CANNON.Sphere(radius));
      break;
    case 'cylinder':
      const cylRadius = obj.radius || 0.5;
      const cylHeight = obj.height || 1;
      body.addShape(new CANNON.Cylinder(cylRadius, cylRadius, cylHeight, 16));
      break;
    case 'groundAnchor':
      body.addShape(new CANNON.Sphere(0.3));
      break;
    case 'weight':
      const weightSize = obj.size || [0.8, 0.8, 0.8];
      body.addShape(new CANNON.Box(new CANNON.Vec3(weightSize[0] / 2, weightSize[1] / 2, weightSize[2] / 2)));
      break;
  }

  if (obj.rotation) {
    const euler = new CANNON.Vec3(obj.rotation[0], obj.rotation[1], obj.rotation[2]);
    body.quaternion.setFromEuler(euler.x, euler.y, euler.z);
  }

  return body;
}

function LabObjectMesh({ obj, isSelected, onClick }: { 
  obj: LabObjectData; 
  isSelected: boolean;
  onClick: (e: any) => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  
  useFrame(() => {
    if (!meshRef.current) return;
    const physicsBody = useGameStore.getState().world?.bodies.find(b => {
      const id = (b as any).userData?.id;
      return id === obj.id;
    });
    
    if (physicsBody) {
      meshRef.current.position.copy(physicsBody.position as any);
      meshRef.current.quaternion.copy(physicsBody.quaternion as any);
    }
  });

  const color = OBJECT_COLORS[obj.type];

  const renderGeometry = () => {
    switch (obj.type) {
      case 'box':
      case 'weight':
        const size = obj.size || [1, 1, 1];
        return <boxGeometry args={size} />;
      case 'sphere':
        const radius = obj.radius || 0.5;
        return <sphereGeometry args={[radius, 32, 32]} />;
      case 'cylinder':
        const cylRadius = obj.radius || 0.5;
        const cylHeight = obj.height || 1;
        return <cylinderGeometry args={[cylRadius, cylRadius, cylHeight, 32]} />;
      case 'groundAnchor':
        return (
          <>
            <sphereGeometry args={[0.3, 32, 32]} />
          </>
        );
      default:
        return <boxGeometry args={[1, 1, 1]} />;
    }
  };

  return (
    <group>
      <mesh
        ref={meshRef}
        position={obj.position}
        castShadow
        receiveShadow
        onClick={onClick}
      >
        {renderGeometry()}
        <meshStandardMaterial
          color={color}
          metalness={obj.type === 'weight' ? 0.8 : 0.3}
          roughness={obj.type === 'weight' ? 0.2 : 0.6}
          emissive={isSelected ? '#ffffff' : '#000000'}
          emissiveIntensity={isSelected ? 0.3 : 0}
        />
      </mesh>
      {isSelected && (
        <mesh position={obj.position}>
          {obj.type === 'sphere' ? (
            <sphereGeometry args={[(obj.radius || 0.5) + 0.05, 32, 32]} />
          ) : (
            <boxGeometry args={[
              (obj.size?.[0] || 1) + 0.1,
              (obj.size?.[1] || 1) + 0.1,
              (obj.size?.[2] || 1) + 0.1
            ]} />
          )}
          <meshBasicMaterial color="#ffff00" wireframe transparent opacity={0.5} />
        </mesh>
      )}
      {obj.type === 'groundAnchor' && (
        <mesh position={[obj.position[0], obj.position[1] - 0.5, obj.position[2]]}>
          <cylinderGeometry args={[0.6, 0.8, 0.2, 32]} />
          <meshStandardMaterial color="#7f8c8d" metalness={0.8} roughness={0.3} />
        </mesh>
      )}
    </group>
  );
}

function ConstraintVisualization({ constraint, bodyA, bodyB }: {
  constraint: LabConstraintData;
  bodyA: CANNON.Body | undefined;
  bodyB: CANNON.Body | undefined;
}) {
  const lineRef = useRef<THREE.Line>(null);
  const pointsRef = useRef<THREE.Vector3[]>([new THREE.Vector3(), new THREE.Vector3()]);
  
  useFrame(() => {
    if (!lineRef.current || !bodyA || !bodyB) return;
    
    pointsRef.current[0].set(bodyA.position.x, bodyA.position.y, bodyA.position.z);
    pointsRef.current[1].set(bodyB.position.x, bodyB.position.y, bodyB.position.z);
    
    const geometry = lineRef.current.geometry as THREE.BufferGeometry;
    geometry.setFromPoints(pointsRef.current);
    geometry.attributes.position.needsUpdate = true;
  });

  const getColor = () => {
    switch (constraint.type) {
      case 'spring': return '#ff6b6b';
      case 'rope': return '#feca57';
      case 'hinge': return '#48dbfb';
      case 'pulley': return '#ff9ff3';
      case 'distance': return '#54a0ff';
      default: return '#ffffff';
    }
  };

  if (!bodyA || !bodyB) return null;

  return (
    <group>
      <line ref={lineRef as any}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={2}
            array={new Float32Array(6)}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial color={getColor()} linewidth={2} />
      </line>
      {constraint.type === 'spring' && (
        <SpringCoil bodyA={bodyA} bodyB={bodyB} color={getColor()} />
      )}
    </group>
  );
}

function SpringCoil({ bodyA, bodyB, color }: { bodyA: CANNON.Body; bodyB: CANNON.Body; color: string }) {
  const groupRef = useRef<THREE.Group>(null);
  
  useFrame(() => {
    if (!groupRef.current) return;
    
    const start = new THREE.Vector3(bodyA.position.x, bodyA.position.y, bodyA.position.z);
    const end = new THREE.Vector3(bodyB.position.x, bodyB.position.y, bodyB.position.z);
    const midPoint = start.clone().add(end).multiplyScalar(0.5);
    const length = start.distanceTo(end);
    
    groupRef.current.position.copy(midPoint);
    groupRef.current.lookAt(end);
    groupRef.current.scale.y = length;
  });

  const coils = useMemo(() => {
    const result = [];
    const numCoils = 8;
    for (let i = 0; i < numCoils; i++) {
      result.push(
        <mesh key={i} position={[0, (i / numCoils) - 0.5, 0]}>
          <torusGeometry args={[0.15, 0.03, 8, 16]} />
          <meshStandardMaterial color={color} metalness={0.6} roughness={0.3} emissive={color} emissiveIntensity={0.2} />
        </mesh>
      );
    }
    return result;
  }, [color]);

  return (
    <group ref={groupRef}>
      {coils}
    </group>
  );
}

export function PhysicsLab({
  addPhysicsBody,
  removePhysicsBody,
  getPhysicsBody,
  addConstraint,
  removeConstraint,
}: PhysicsLabProps) {
  const { scene, camera } = useThree();
  const labObjects = useGameStore((s) => s.labObjects);
  const labConstraints = useGameStore((s) => s.labConstraints);
  const labTool = useGameStore((s) => s.labTool);
  const selectedLabObjectId = useGameStore((s) => s.selectedLabObjectId);
  const selectedConstraintType = useGameStore((s) => s.selectedConstraintType);
  const selectedLabObjectType = useGameStore((s) => s.selectedLabObjectType);
  const constraintStartObjectId = useGameStore((s) => s.constraintStartObjectId);
  const springStiffness = useGameStore((s) => s.springStiffness);
  const springDamping = useGameStore((s) => s.springDamping);
  const ropeLength = useGameStore((s) => s.ropeLength);
  
  const addLabObject = useGameStore((s) => s.addLabObject);
  const removeLabObject = useGameStore((s) => s.removeLabObject);
  const addLabConstraint = useGameStore((s) => s.addLabConstraint);
  const setSelectedLabObjectId = useGameStore((s) => s.setSelectedLabObjectId);
  const setConstraintStartObjectId = useGameStore((s) => s.setConstraintStartObjectId);
  const world = useGameStore((s) => s.world);
  const gravityDirection = useGameStore((s) => s.gravityDirection);

  const constraintsRef = useRef<Map<string, CANNON.Constraint>>(new Map());
  const bodiesMapRef = useRef<Map<string, CANNON.Body>>(new Map());
  const [hoverPoint, setHoverPoint] = useState<[number, number, number] | null>(null);
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseRef = useRef(new THREE.Vector2());

  const getGroundY = useCallback(() => {
    switch (gravityDirection) {
      case 'down': return 0;
      case 'up': return 50;
      case 'left': return -50;
      case 'right': return 50;
      case 'forward': return 50;
      case 'backward': return -50;
      default: return 0;
    }
  }, [gravityDirection]);

  const spawnDefaultScene = useCallback(() => {
    if (!world) return;
    
    const anchor1: LabObjectData = {
      id: generateId(),
      type: 'groundAnchor',
      position: [-3, 6, 0],
      mass: 0,
      color: OBJECT_COLORS.groundAnchor,
      isStatic: true,
    };
    
    const weight1: LabObjectData = {
      id: generateId(),
      type: 'weight',
      position: [-3, 3, 0],
      size: [1, 1.5, 1],
      mass: 10,
      color: OBJECT_COLORS.weight,
      isStatic: false,
    };
    
    const box1: LabObjectData = {
      id: generateId(),
      type: 'box',
      position: [2, 3, 0],
      size: [1.2, 1.2, 1.2],
      mass: 5,
      color: OBJECT_COLORS.box,
      isStatic: false,
    };

    const anchor2: LabObjectData = {
      id: generateId(),
      type: 'groundAnchor',
      position: [2, 6, 0],
      mass: 0,
      color: OBJECT_COLORS.groundAnchor,
      isStatic: true,
    };
    
    const sphere1: LabObjectData = {
      id: generateId(),
      type: 'sphere',
      position: [0, 2, 2],
      radius: 0.6,
      mass: 3,
      color: OBJECT_COLORS.sphere,
      isStatic: false,
    };

    [anchor1, weight1, box1, anchor2, sphere1].forEach((obj) => {
      const body = createPhysicsBody(obj);
      (body as any).userData = { id: obj.id };
      addPhysicsBody(obj.id, body);
      bodiesMapRef.current.set(obj.id, body);
      addLabObject(obj);
    });

    setTimeout(() => {
      const springConstraint: LabConstraintData = {
        id: generateId(),
        type: 'spring',
        bodyAId: anchor1.id,
        bodyBId: weight1.id,
        stiffness: 100,
        damping: 10,
        restLength: 2,
      };

      const bodyA = bodiesMapRef.current.get(anchor1.id);
      const bodyB = bodiesMapRef.current.get(weight1.id);
      
      if (bodyA && bodyB) {
        const spring = new CANNON.Spring(bodyA, bodyB, {
          restLength: 2,
          stiffness: 100,
          damping: 10,
        });
        
        if (world) {
          (world as any).springs = (world as any).springs || [];
          (world as any).springs.push(spring);
        }
        
        constraintsRef.current.set(springConstraint.id, spring as any);
        addLabConstraint(springConstraint);
      }

      const distanceConstraint: LabConstraintData = {
        id: generateId(),
        type: 'distance',
        bodyAId: anchor2.id,
        bodyBId: box1.id,
        maxForce: 1e6,
      };

      const bodyA2 = bodiesMapRef.current.get(anchor2.id);
      const bodyB2 = bodiesMapRef.current.get(box1.id);
      
      if (bodyA2 && bodyB2) {
        const distConstraint = new CANNON.DistanceConstraint(bodyA2, bodyB2, 3);
        addConstraint(distConstraint);
        constraintsRef.current.set(distanceConstraint.id, distConstraint);
        addLabConstraint(distanceConstraint);
      }
    }, 100);
  }, [world, addPhysicsBody, addLabObject, addConstraint, addLabConstraint]);

  useEffect(() => {
    if (world && labObjects.size === 0) {
      spawnDefaultScene();
    }
  }, [world, labObjects.size, spawnDefaultScene]);

  useFrame(() => {
    const state = useGameStore.getState();
    const world = state.world;
    
    if (!world) return;

    const springs = (world as any).springs || [];
    springs.forEach((spring: CANNON.Spring) => {
      spring.applyForce();
    });

    state.labObjects.forEach((obj, id) => {
      const body = bodiesMapRef.current.get(id);
      if (body && !obj.isStatic) {
        state.updateLabObjectPosition(id, [body.position.x, body.position.y, body.position.z]);
      }
    });
  });

  const handleObjectClick = useCallback((obj: LabObjectData) => {
    if (labTool === 'placeConstraint') {
      if (!constraintStartObjectId) {
        setConstraintStartObjectId(obj.id);
      } else if (constraintStartObjectId !== obj.id) {
        createConstraint(constraintStartObjectId, obj.id);
        setConstraintStartObjectId(null);
      }
    } else if (labTool === 'select' || labTool === 'move') {
      setSelectedLabObjectId(obj.id);
    } else if (labTool === 'delete') {
      deleteObject(obj.id);
    }
  }, [labTool, constraintStartObjectId, setConstraintStartObjectId, setSelectedLabObjectId]);

  const createConstraint = useCallback((bodyAId: string, bodyBId: string) => {
    const bodyA = bodiesMapRef.current.get(bodyAId);
    const bodyB = bodiesMapRef.current.get(bodyBId);
    
    if (!bodyA || !bodyB || !world) return;

    const constraintData: LabConstraintData = {
      id: generateId(),
      type: selectedConstraintType,
      bodyAId,
      bodyBId,
    };

    let constraint: CANNON.Constraint | null = null;

    switch (selectedConstraintType) {
      case 'spring':
        const restLength = bodyA.position.distanceTo(bodyB.position);
        constraintData.restLength = restLength;
        constraintData.stiffness = springStiffness;
        constraintData.damping = springDamping;
        
        const spring = new CANNON.Spring(bodyA, bodyB, {
          restLength,
          stiffness: springStiffness,
          damping: springDamping,
        });
        
        (world as any).springs = (world as any).springs || [];
        (world as any).springs.push(spring);
        constraintsRef.current.set(constraintData.id, spring as any);
        break;
      
      case 'distance':
      case 'rope':
        const dist = bodyA.position.distanceTo(bodyB.position);
        constraintData.restLength = selectedConstraintType === 'rope' ? ropeLength : dist;
        constraintData.maxForce = 1e6;
        
        const distConstraint = new CANNON.DistanceConstraint(
          bodyA, bodyB, 
          selectedConstraintType === 'rope' ? ropeLength : dist
        );
        addConstraint(distConstraint);
        constraint = distConstraint;
        break;
      
      case 'hinge':
        const hinge = new CANNON.HingeConstraint(bodyA, bodyB, {
          pivotA: new CANNON.Vec3(0, 0, 0),
          axisA: new CANNON.Vec3(0, 0, 1),
          pivotB: new CANNON.Vec3(0, 0, 0),
          axisB: new CANNON.Vec3(0, 0, 1),
        });
        addConstraint(hinge);
        constraint = hinge;
        break;
      
      case 'pulley':
        const pulleyDist = bodyA.position.distanceTo(bodyB.position);
        constraintData.restLength = pulleyDist;
        const pulleyConstraint = new CANNON.DistanceConstraint(bodyA, bodyB, pulleyDist);
        addConstraint(pulleyConstraint);
        constraint = pulleyConstraint;
        break;
    }

    if (constraint) {
      constraintsRef.current.set(constraintData.id, constraint);
    }
    
    addLabConstraint(constraintData);
  }, [selectedConstraintType, springStiffness, springDamping, ropeLength, world, addConstraint, addLabConstraint]);

  const deleteObject = useCallback((id: string) => {
    const body = bodiesMapRef.current.get(id);
    if (body && world) {
      world.removeBody(body);
      bodiesMapRef.current.delete(id);
    }
    
    labConstraints.forEach((constraint, cid) => {
      if (constraint.bodyAId === id || constraint.bodyBId === id) {
        const c = constraintsRef.current.get(cid);
        if (c && world) {
          if (c instanceof CANNON.Constraint) {
            removeConstraint(c);
          } else {
            const springs = (world as any).springs || [];
            (world as any).springs = springs.filter((s: any) => s !== c);
          }
          constraintsRef.current.delete(cid);
        }
      }
    });
    
    removeLabObject(id);
    removePhysicsBody(id);
  }, [world, labConstraints, removeConstraint, removeLabObject, removePhysicsBody]);

  const handleCanvasClick = useCallback((event: any) => {
    if (labTool !== 'placeObject') return;
    
    const { clientX, clientY } = event;
    const rect = (event.target as HTMLElement).getBoundingClientRect();
    
    mouseRef.current.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    mouseRef.current.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    
    raycasterRef.current.setFromCamera(mouseRef.current, camera);
    
    const groundY = getGroundY();
    const planeNormal = new THREE.Vector3(0, 1, 0);
    const planePoint = new THREE.Vector3(0, groundY + 1, 0);
    
    switch (gravityDirection) {
      case 'up':
        planeNormal.set(0, -1, 0);
        planePoint.set(0, groundY - 1, 0);
        break;
      case 'left':
        planeNormal.set(1, 0, 0);
        planePoint.set(groundY + 1, 3, 0);
        break;
      case 'right':
        planeNormal.set(-1, 0, 0);
        planePoint.set(groundY - 1, 3, 0);
        break;
      case 'forward':
        planeNormal.set(0, 0, -1);
        planePoint.set(0, 3, groundY - 1);
        break;
      case 'backward':
        planeNormal.set(0, 0, 1);
        planePoint.set(0, 3, groundY + 1);
        break;
    }
    
    const plane = new THREE.Plane(planeNormal, -planeNormal.dot(planePoint));
    const intersectPoint = new THREE.Vector3();
    raycasterRef.current.ray.intersectPlane(plane, intersectPoint);
    
    if (intersectPoint) {
      const newObj: LabObjectData = {
        id: generateId(),
        type: selectedLabObjectType,
        position: [intersectPoint.x, intersectPoint.y, intersectPoint.z],
        mass: selectedLabObjectType === 'groundAnchor' ? 0 : selectedLabObjectType === 'weight' ? 10 : 5,
        color: OBJECT_COLORS[selectedLabObjectType],
        isStatic: selectedLabObjectType === 'groundAnchor',
        size: selectedLabObjectType === 'box' || selectedLabObjectType === 'weight' ? [1, 1, 1] : undefined,
        radius: selectedLabObjectType === 'sphere' || selectedLabObjectType === 'cylinder' ? 0.5 : undefined,
        height: selectedLabObjectType === 'cylinder' ? 1 : undefined,
      };
      
      const body = createPhysicsBody(newObj);
      (body as any).userData = { id: newObj.id };
      addPhysicsBody(newObj.id, body);
      bodiesMapRef.current.set(newObj.id, body);
      addLabObject(newObj);
    }
  }, [labTool, selectedLabObjectType, camera, getGroundY, gravityDirection, addPhysicsBody, addLabObject]);

  useEffect(() => {
    const canvas = document.querySelector('canvas');
    if (canvas) {
      canvas.addEventListener('click', handleCanvasClick);
      return () => canvas.removeEventListener('click', handleCanvasClick);
    }
  }, [handleCanvasClick]);

  const labObjectArray = Array.from(labObjects.values());
  const labConstraintArray = Array.from(labConstraints.values());

  return (
    <group>
      {labObjectArray.map((obj) => (
        <LabObjectMesh
          key={obj.id}
          obj={obj}
          isSelected={selectedLabObjectId === obj.id || constraintStartObjectId === obj.id}
          onClick={(e) => {
            e.stopPropagation();
            handleObjectClick(obj);
          }}
        />
      ))}
      
      {labConstraintArray.map((constraint) => (
        <ConstraintVisualization
          key={constraint.id}
          constraint={constraint}
          bodyA={bodiesMapRef.current.get(constraint.bodyAId)}
          bodyB={bodiesMapRef.current.get(constraint.bodyBId)}
        />
      ))}
      
      {constraintStartObjectId && (
        <mesh position={labObjects.get(constraintStartObjectId)?.position || [0, 0, 0]}>
          <ringGeometry args={[0.8, 1, 32]} />
          <meshBasicMaterial color="#00ff00" side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
}

export default PhysicsLab;
