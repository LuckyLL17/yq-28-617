import type { World } from '../core';
import type {
  BuildAction,
  BlockData,
  MaterialType,
} from '../../store/gameStore';
import { materialProperties, MAX_UNDO_STEPS } from '../../store/gameStore';
import { addBlock, removeBlock, updateBlockPosition, updateBlockRotation, clearBlockSprayData } from './block';
import { ComponentType } from '../components';
import type { TransformComponent } from '../components';

export function pushUndoAction(
  undoStack: BuildAction[],
  action: BuildAction
): { undoStack: BuildAction[]; redoStack: BuildAction[] } {
  let newUndoStack = [...undoStack, action];
  if (newUndoStack.length > MAX_UNDO_STEPS) {
    newUndoStack = newUndoStack.slice(newUndoStack.length - MAX_UNDO_STEPS);
  }
  return { undoStack: newUndoStack, redoStack: [] };
}

export function applyUndo(
  world: World,
  undoStack: BuildAction[],
  redoStack: BuildAction[]
): { undoStack: BuildAction[]; redoStack: BuildAction[]; blocksChanged: boolean } | null {
  if (undoStack.length === 0) return null;
  const action = undoStack[undoStack.length - 1];
  const newUndoStack = undoStack.slice(0, -1);
  const newRedoStack = [...redoStack, action];

  switch (action.type) {
    case 'add':
      removeBlock(world, action.block.id);
      break;
    case 'remove':
      addBlock(world, action.block);
      break;
    case 'move': {
      const transform = world.getComponent<TransformComponent>(action.blockId, ComponentType.Transform);
      if (transform) {
        world.addComponent(action.blockId, {
          ...transform,
          position: [...action.fromPosition] as [number, number, number],
        });
      }
      break;
    }
    case 'rotate': {
      const transform = world.getComponent<TransformComponent>(action.blockId, ComponentType.Transform);
      if (transform) {
        world.addComponent(action.blockId, {
          ...transform,
          rotation: [...action.fromRotation] as [number, number, number],
        });
      }
      break;
    }
  }

  return { undoStack: newUndoStack, redoStack: newRedoStack, blocksChanged: true };
}

export function applyRedo(
  world: World,
  undoStack: BuildAction[],
  redoStack: BuildAction[]
): { undoStack: BuildAction[]; redoStack: BuildAction[]; blocksChanged: boolean } | null {
  if (redoStack.length === 0) return null;
  const action = redoStack[redoStack.length - 1];
  const newRedoStack = redoStack.slice(0, -1);
  let newUndoStack = [...undoStack, action];
  if (newUndoStack.length > MAX_UNDO_STEPS) {
    newUndoStack = newUndoStack.slice(newUndoStack.length - MAX_UNDO_STEPS);
  }

  switch (action.type) {
    case 'add':
      addBlock(world, action.block);
      break;
    case 'remove':
      removeBlock(world, action.block.id);
      break;
    case 'move': {
      const transform = world.getComponent<TransformComponent>(action.blockId, ComponentType.Transform);
      if (transform) {
        world.addComponent(action.blockId, {
          ...transform,
          position: [...action.toPosition] as [number, number, number],
        });
      }
      break;
    }
    case 'rotate': {
      const transform = world.getComponent<TransformComponent>(action.blockId, ComponentType.Transform);
      if (transform) {
        world.addComponent(action.blockId, {
          ...transform,
          rotation: [...action.toRotation] as [number, number, number],
        });
      }
      break;
    }
  }

  return { undoStack: newUndoStack, redoStack: newRedoStack, blocksChanged: true };
}

export function clearBuildState(world: World): void {
  clearBlockSprayData();
  const blockIds = world.query(ComponentType.BlockTag);
  blockIds.forEach((id) => world.destroyEntity(id));
}
