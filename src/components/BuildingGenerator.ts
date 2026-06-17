import { BlockData, MaterialType, materialProperties, generateId, GravityDirection } from '@/store/gameStore';

interface BuildingConfig {
  width: number;
  height: number;
  depth: number;
  blockSize?: [number, number, number];
  gravityDirection?: GravityDirection;
}

const createBlock = (
  x: number,
  y: number,
  z: number,
  sizeX: number,
  sizeY: number,
  sizeZ: number,
  material: MaterialType
): BlockData => {
  const properties = materialProperties[material];
  return {
    id: generateId(),
    position: [x, y, z],
    size: [sizeX, sizeY, sizeZ],
    material,
    health: properties.health,
    maxHealth: properties.health,
  };
};

function transformPositionForGravity(
  x: number,
  y: number,
  z: number,
  gravity: GravityDirection,
  totalHeight: number,
  totalWidth: number,
  totalDepth: number
): [number, number, number] {
  switch (gravity) {
    case 'down':
    default:
      return [x, y, z];
    case 'up':
      return [x, -y + totalHeight, z];
    case 'left':
      return [y, x, z];
    case 'right':
      return [-y + totalHeight, x, z];
    case 'forward':
      return [x, z, y];
    case 'backward':
      return [x, -z + totalDepth, y];
  }
}

function transformSizeForGravity(
  w: number,
  h: number,
  d: number,
  gravity: GravityDirection
): [number, number, number] {
  switch (gravity) {
    case 'down':
    case 'up':
    default:
      return [w, h, d];
    case 'left':
    case 'right':
      return [h, w, d];
    case 'forward':
    case 'backward':
      return [w, d, h];
  }
}

export function generateBuilding(config: BuildingConfig): BlockData[] {
  const blocks: BlockData[] = [];
  const { width, height, depth, gravityDirection = 'down' } = config;
  const [blockW, blockH, blockD] = config.blockSize || [1, 0.5, 1];
  const layerHeight = blockH * 2;
  const totalHeight = height * layerHeight + blockH * 0.3;
  const totalWidth = width * blockW;
  const totalDepth = depth * blockD;

  for (let floor = 0; floor < height; floor++) {
    const y = floor * layerHeight + blockH / 2;

    const isTopFloor = floor === height - 1;
    const isBottomFloor = floor === 0;

    for (let w = 0; w < width; w++) {
      for (let d = 0; d < depth; d++) {
        const isWall = w === 0 || w === width - 1 || d === 0 || d === depth - 1;
        const isCorner = (w === 0 || w === width - 1) && (d === 0 || d === depth - 1);

        const x = (w - width / 2) * blockW + blockW / 2;
        const z = (d - depth / 2) * blockD + blockD / 2;

        if (isWall) {
          let material: MaterialType = 'concrete';

          if (isCorner) {
            material = 'concrete';
          } else if (isTopFloor) {
            material = Math.random() > 0.3 ? 'glass' : 'wood';
          } else if (isBottomFloor) {
            material = 'concrete';
          } else {
            const windowPattern = (w + d + floor) % 3;
            if (windowPattern === 0) {
              material = 'glass';
            } else if (windowPattern === 1) {
              material = 'wood';
            } else {
              material = 'concrete';
            }
          }

          const [tx, ty, tz] = transformPositionForGravity(x, y, z, gravityDirection, totalHeight, totalWidth, totalDepth);
          const [sw, sh, sd] = transformSizeForGravity(blockW * 0.95, blockH * 1.9, blockD * 0.95, gravityDirection);
          blocks.push(createBlock(tx, ty, tz, sw, sh, sd, material));
        }
      }
    }

    if (floor > 0) {
      const floorY = (floor - 0.5) * layerHeight + blockH;
      for (let w = 0; w < width; w++) {
        for (let d = 0; d < depth; d++) {
          const x = (w - width / 2) * blockW + blockW / 2;
          const z = (d - depth / 2) * blockD + blockD / 2;

          const isEdgeBeam = w === 0 || w === width - 1 || d === 0 || d === depth - 1;
          const isColumnLine = w % 3 === 0 || d % 3 === 0;

          if (isEdgeBeam || isColumnLine) {
            const [tx, ty, tz] = transformPositionForGravity(x, floorY, z, gravityDirection, totalHeight, totalWidth, totalDepth);
            const [sw, sh, sd] = transformSizeForGravity(blockW * 0.8, blockH * 0.4, blockD * 0.8, gravityDirection);
            blocks.push(createBlock(tx, ty, tz, sw, sh, sd, 'concrete'));
          } else {
            const [tx, ty, tz] = transformPositionForGravity(x, floorY, z, gravityDirection, totalHeight, totalWidth, totalDepth);
            const [sw, sh, sd] = transformSizeForGravity(blockW * 0.9, blockH * 0.2, blockD * 0.9, gravityDirection);
            blocks.push(createBlock(tx, ty, tz, sw, sh, sd, 'wood'));
          }
        }
      }
    }

    for (let cw = 0; cw < width; cw += 3) {
      for (let cd = 0; cd < depth; cd += 3) {
        const cwIsWall = cw === 0 || cw === width - 1;
        const cdIsWall = cd === 0 || cd === depth - 1;
        if (cwIsWall || cdIsWall) continue;

        const cx = (cw - width / 2) * blockW + blockW / 2;
        const cz = (cd - depth / 2) * blockD + blockD / 2;
        for (let subFloor = 0; subFloor < 2; subFloor++) {
          const cy = y + subFloor * blockH * 1.1 - blockH * 0.05;
          const [tx, ty, tz] = transformPositionForGravity(cx, cy, cz, gravityDirection, totalHeight, totalWidth, totalDepth);
          const [sw, sh, sd] = transformSizeForGravity(blockW * 0.65, blockH * 0.85, blockD * 0.65, gravityDirection);
          blocks.push(createBlock(tx, ty, tz, sw, sh, sd, 'concrete'));
        }
      }
    }
  }

  const roofY = height * layerHeight + blockH / 2;
  for (let w = 0; w < width; w++) {
    for (let d = 0; d < depth; d++) {
      const x = (w - width / 2) * blockW + blockW / 2;
      const z = (d - depth / 2) * blockD + blockD / 2;
      const [tx, ty, tz] = transformPositionForGravity(x, roofY, z, gravityDirection, totalHeight, totalWidth, totalDepth);
      const [sw, sh, sd] = transformSizeForGravity(blockW * 0.9, blockH * 0.3, blockD * 0.9, gravityDirection);
      blocks.push(createBlock(tx, ty, tz, sw, sh, sd, 'wood'));
    }
  }

  return blocks;
}

export function generateCastle(config: BuildingConfig): BlockData[] {
  const blocks: BlockData[] = [];
  const { width, height, depth, gravityDirection = 'down' } = config;
  const [blockW, blockH, blockD] = config.blockSize || [0.8, 0.4, 0.8];
  const layerHeight = blockH * 2;
  const totalHeight = (height + 2) * layerHeight;
  const totalWidth = width * blockW;
  const totalDepth = depth * blockD;

  const towers = [
    [0, 0],
    [width - 1, 0],
    [0, depth - 1],
    [width - 1, depth - 1],
  ];

  for (const [tw, td] of towers) {
    for (let floor = 0; floor < height + 2; floor++) {
      for (let subY = 0; subY < 2; subY++) {
        const y = floor * layerHeight + subY * blockH + blockH / 2;
        const x = (tw - width / 2) * blockW + blockW / 2;
        const z = (td - depth / 2) * blockD + blockD / 2;

        const [tx, ty, tz] = transformPositionForGravity(x, y, z, gravityDirection, totalHeight, totalWidth, totalDepth);
        const [sw, sh, sd] = transformSizeForGravity(blockW * 0.95, blockH * 0.95, blockD * 0.95, gravityDirection);
        blocks.push(createBlock(tx, ty, tz, sw, sh, sd, 'concrete'));

        if (subY === 0) {
          const mainHalfW = blockW * 0.95 / 2;
          const mainHalfD = blockD * 0.95 / 2;
          const smallHalfW = blockW * 0.3 / 2;
          const smallHalfD = blockD * 0.3 / 2;
          const gap = 0.02;

          const offsets = [
            { ox: mainHalfW + smallHalfW + gap, oy: 0, oz: 0, sw: blockW * 0.3, sh: blockH * 0.95, sd: blockD * 0.3 },
            { ox: -(mainHalfW + smallHalfW + gap), oy: 0, oz: 0, sw: blockW * 0.3, sh: blockH * 0.95, sd: blockD * 0.3 },
            { ox: 0, oy: 0, oz: mainHalfD + smallHalfD + gap, sw: blockW * 0.3, sh: blockH * 0.95, sd: blockD * 0.3 },
            { ox: 0, oy: 0, oz: -(mainHalfD + smallHalfD + gap), sw: blockW * 0.3, sh: blockH * 0.95, sd: blockD * 0.3 },
          ];

          for (const off of offsets) {
            const [sx, sy, sz] = transformPositionForGravity(x + off.ox, y + off.oy, z + off.oz, gravityDirection, totalHeight, totalWidth, totalDepth);
            const [ssw, ssh, ssd] = transformSizeForGravity(off.sw, off.sh, off.sd, gravityDirection);
            blocks.push(createBlock(sx, sy, sz, ssw, ssh, ssd, 'concrete'));
          }
        }
      }
    }
  }

  for (let floor = 0; floor < height; floor++) {
    for (let subY = 0; subY < 2; subY++) {
      const y = floor * layerHeight + subY * blockH + blockH / 2;

      for (let w = 1; w < width - 1; w++) {
        const x = (w - width / 2) * blockW + blockW / 2;
        const z1 = (0 - depth / 2) * blockD + blockD / 2;
        const z2 = (depth - 1 - depth / 2) * blockD + blockD / 2;

        const hasWindow = subY === 1 && w % 2 === 0 && floor > 0;
        const [tx1, ty1, tz1] = transformPositionForGravity(x, y, z1, gravityDirection, totalHeight, totalWidth, totalDepth);
        const [tx2, ty2, tz2] = transformPositionForGravity(x, y, z2, gravityDirection, totalHeight, totalWidth, totalDepth);
        if (hasWindow) {
          const [sw, sh, sd] = transformSizeForGravity(blockW * 0.8, blockH * 0.9, blockD * 0.2, gravityDirection);
          blocks.push(createBlock(tx1, ty1, tz1, sw, sh, sd, 'glass'));
          blocks.push(createBlock(tx2, ty2, tz2, sw, sh, sd, 'glass'));
        } else {
          const [sw, sh, sd] = transformSizeForGravity(blockW * 0.95, blockH * 0.95, blockD * 0.5, gravityDirection);
          blocks.push(createBlock(tx1, ty1, tz1, sw, sh, sd, 'concrete'));
          blocks.push(createBlock(tx2, ty2, tz2, sw, sh, sd, 'concrete'));
        }
      }

      for (let d = 1; d < depth - 1; d++) {
        const z = (d - depth / 2) * blockD + blockD / 2;
        const x1 = (0 - width / 2) * blockW + blockW / 2;
        const x2 = (width - 1 - width / 2) * blockW + blockW / 2;

        const hasWindow = subY === 1 && d % 2 === 0 && floor > 0;
        const [tx1, ty1, tz1] = transformPositionForGravity(x1, y, z, gravityDirection, totalHeight, totalWidth, totalDepth);
        const [tx2, ty2, tz2] = transformPositionForGravity(x2, y, z, gravityDirection, totalHeight, totalWidth, totalDepth);
        if (hasWindow) {
          const [sw, sh, sd] = transformSizeForGravity(blockW * 0.2, blockH * 0.9, blockD * 0.8, gravityDirection);
          blocks.push(createBlock(tx1, ty1, tz1, sw, sh, sd, 'glass'));
          blocks.push(createBlock(tx2, ty2, tz2, sw, sh, sd, 'glass'));
        } else {
          const [sw, sh, sd] = transformSizeForGravity(blockW * 0.5, blockH * 0.95, blockD * 0.95, gravityDirection);
          blocks.push(createBlock(tx1, ty1, tz1, sw, sh, sd, 'concrete'));
          blocks.push(createBlock(tx2, ty2, tz2, sw, sh, sd, 'concrete'));
        }
      }
    }

    if (floor > 0) {
      const floorY = (floor - 0.5) * layerHeight + blockH;
      for (let w = 1; w < width - 1; w++) {
        for (let d = 1; d < depth - 1; d++) {
          const x = (w - width / 2) * blockW + blockW / 2;
          const z = (d - depth / 2) * blockD + blockD / 2;
          const [tx, ty, tz] = transformPositionForGravity(x, floorY, z, gravityDirection, totalHeight, totalWidth, totalDepth);
          const [sw, sh, sd] = transformSizeForGravity(blockW * 0.85, blockH * 0.2, blockD * 0.85, gravityDirection);
          blocks.push(createBlock(tx, ty, tz, sw, sh, sd, 'wood'));
        }
      }
    }
  }

  return blocks;
}

export default generateBuilding;
