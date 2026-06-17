import { useEffect, useRef, useCallback } from 'react';
import * as CANNON from 'cannon-es';
import { useGameStore, GRAVITY_VECTORS, GravityDirection } from '@/store/gameStore';
import { calculateExplosionImpulse, clampDeltaTime } from '@/lib/physicsUtils';

export const usePhysics = () => {
  const worldRef = useRef<CANNON.World | null>(null);
  const bodiesMapRef = useRef<Map<string, CANNON.Body>>(new Map());
  const groundBodiesRef = useRef<CANNON.Body[]>([]);
  const setWorld = useGameStore((s) => s.setWorld);

  const setupGroundPlanes = useCallback((world: CANNON.World, direction: GravityDirection) => {
    groundBodiesRef.current.forEach((body) => world.removeBody(body));
    groundBodiesRef.current = [];

    const planeSize = 100;
    const boundaryOffset = 50;

    const addPlane = (
      position: CANNON.Vec3,
      rotationAxis: CANNON.Vec3,
      rotationAngle: number
    ) => {
      const groundBody = new CANNON.Body({
        mass: 0,
        shape: new CANNON.Plane(),
        position,
      });
      groundBody.quaternion.setFromAxisAngle(rotationAxis, rotationAngle);
      world.addBody(groundBody);
      groundBodiesRef.current.push(groundBody);
      return groundBody;
    };

    switch (direction) {
      case 'down':
        addPlane(new CANNON.Vec3(0, 0, 0), new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
        break;
      case 'up':
        addPlane(new CANNON.Vec3(0, boundaryOffset, 0), new CANNON.Vec3(1, 0, 0), Math.PI / 2);
        break;
      case 'left':
        addPlane(new CANNON.Vec3(-boundaryOffset, 0, 0), new CANNON.Vec3(0, 1, 0), Math.PI / 2);
        break;
      case 'right':
        addPlane(new CANNON.Vec3(boundaryOffset, 0, 0), new CANNON.Vec3(0, 1, 0), -Math.PI / 2);
        break;
      case 'forward':
        addPlane(new CANNON.Vec3(0, 0, boundaryOffset), new CANNON.Vec3(1, 0, 0), 0);
        break;
      case 'backward':
        addPlane(new CANNON.Vec3(0, 0, -boundaryOffset), new CANNON.Vec3(1, 0, 0), Math.PI);
        break;
    }

    const boundaryPlanes: { pos: CANNON.Vec3; axis: CANNON.Vec3; angle: number }[] = [];

    switch (direction) {
      case 'down':
      case 'up':
        boundaryPlanes.push(
          { pos: new CANNON.Vec3(-planeSize, 0, 0), axis: new CANNON.Vec3(0, 1, 0), angle: Math.PI / 2 },
          { pos: new CANNON.Vec3(planeSize, 0, 0), axis: new CANNON.Vec3(0, 1, 0), angle: -Math.PI / 2 },
          { pos: new CANNON.Vec3(0, 0, -planeSize), axis: new CANNON.Vec3(1, 0, 0), angle: Math.PI },
          { pos: new CANNON.Vec3(0, 0, planeSize), axis: new CANNON.Vec3(1, 0, 0), angle: 0 }
        );
        break;
      case 'left':
      case 'right':
        boundaryPlanes.push(
          { pos: new CANNON.Vec3(0, -planeSize, 0), axis: new CANNON.Vec3(1, 0, 0), angle: -Math.PI / 2 },
          { pos: new CANNON.Vec3(0, planeSize, 0), axis: new CANNON.Vec3(1, 0, 0), angle: Math.PI / 2 },
          { pos: new CANNON.Vec3(0, 0, -planeSize), axis: new CANNON.Vec3(1, 0, 0), angle: Math.PI },
          { pos: new CANNON.Vec3(0, 0, planeSize), axis: new CANNON.Vec3(1, 0, 0), angle: 0 }
        );
        break;
      case 'forward':
      case 'backward':
        boundaryPlanes.push(
          { pos: new CANNON.Vec3(-planeSize, 0, 0), axis: new CANNON.Vec3(0, 1, 0), angle: Math.PI / 2 },
          { pos: new CANNON.Vec3(planeSize, 0, 0), axis: new CANNON.Vec3(0, 1, 0), angle: -Math.PI / 2 },
          { pos: new CANNON.Vec3(0, -planeSize, 0), axis: new CANNON.Vec3(1, 0, 0), angle: -Math.PI / 2 },
          { pos: new CANNON.Vec3(0, planeSize, 0), axis: new CANNON.Vec3(1, 0, 0), angle: Math.PI / 2 }
        );
        break;
    }

    boundaryPlanes.forEach(({ pos, axis, angle }) => {
      const body = new CANNON.Body({
        mass: 0,
        shape: new CANNON.Plane(),
        position: pos,
      });
      body.quaternion.setFromAxisAngle(axis, angle);
      world.addBody(body);
      groundBodiesRef.current.push(body);
    });
  }, []);

  useEffect(() => {
    const gravityDir = useGameStore.getState().gravityDirection;
    const gravityVec = GRAVITY_VECTORS[gravityDir];

    const world = new CANNON.World({
      gravity: new CANNON.Vec3(gravityVec[0], gravityVec[1], gravityVec[2]),
    });
    world.broadphase = new CANNON.SAPBroadphase(world);
    world.allowSleep = true;
    if ('iterations' in world.solver) {
      (world.solver as any).iterations = 20;
    }
    world.defaultContactMaterial.contactEquationStiffness = 1e6;
    world.defaultContactMaterial.contactEquationRelaxation = 3;

    setupGroundPlanes(world, gravityDir);

    worldRef.current = world;
    setWorld(world);

    const unsubscribe = useGameStore.subscribe((state, prevState) => {
      if (state.gravityDirection !== prevState.gravityDirection && worldRef.current) {
        const newGravity = GRAVITY_VECTORS[state.gravityDirection];
        worldRef.current.gravity.set(newGravity[0], newGravity[1], newGravity[2]);
        setupGroundPlanes(worldRef.current, state.gravityDirection);

        bodiesMapRef.current.forEach((body) => {
          if (body.mass > 0) {
            body.wakeUp();
          }
        });
      }
    });

    return () => {
      unsubscribe();
      bodiesMapRef.current.forEach((body) => {
        world.removeBody(body);
      });
      bodiesMapRef.current.clear();
    };
  }, [setWorld, setupGroundPlanes]);

  const addBody = useCallback((id: string, body: CANNON.Body) => {
    if (worldRef.current) {
      worldRef.current.addBody(body);
      bodiesMapRef.current.set(id, body);
    }
  }, []);

  const removeBody = useCallback((id: string) => {
    if (worldRef.current) {
      const body = bodiesMapRef.current.get(id);
      if (body) {
        worldRef.current.removeBody(body);
        bodiesMapRef.current.delete(id);
      }
    }
  }, []);

  const getBody = useCallback((id: string) => {
    return bodiesMapRef.current.get(id);
  }, []);

  const step = useCallback((delta: number) => {
    if (worldRef.current) {
      worldRef.current.step(clampDeltaTime(delta));
    }
  }, []);

  const addConstraint = useCallback((constraint: CANNON.Constraint) => {
    if (worldRef.current) {
      worldRef.current.addConstraint(constraint);
      return true;
    }
    return false;
  }, []);

  const removeConstraint = useCallback((constraint: CANNON.Constraint) => {
    if (worldRef.current) {
      worldRef.current.removeConstraint(constraint);
    }
  }, []);

  const applyExplosion = useCallback((position: [number, number, number], radius: number, force: number) => {
    if (!worldRef.current) return;
    bodiesMapRef.current.forEach((body) => {
      if (body.mass === 0) return;
      const result = calculateExplosionImpulse(
        [body.position.x, body.position.y, body.position.z],
        position,
        radius,
        force
      );
      if (result.shouldApply) {
        body.applyImpulse(
          new CANNON.Vec3(result.impulseX, result.impulseY, result.impulseZ),
          new CANNON.Vec3(body.position.x, body.position.y, body.position.z)
        );
        body.wakeUp();
      }
    });
  }, []);

  return {
    world: worldRef,
    addBody,
    removeBody,
    getBody,
    addConstraint,
    removeConstraint,
    step,
    applyExplosion,
  };
};

export default usePhysics;
