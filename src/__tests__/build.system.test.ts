import { describe, it, expect } from 'vitest';
import { pushUndoAction } from '@/ecs/systems/build';
import { MAX_UNDO_STEPS, type BuildAction } from '@/store/gameStore';

describe('build system - pushUndoAction', () => {
  const createAddAction = (id: string): BuildAction => ({
    type: 'add',
    block: {
      id,
      position: [0, 0, 0],
      size: [1, 1, 1],
      material: 'wood',
      health: 50,
      maxHealth: 50,
    },
  });

  it('应该将操作添加到撤销栈', () => {
    const action = createAddAction('block-1');
    const result = pushUndoAction([], action);

    expect(result.undoStack).toHaveLength(1);
    expect(result.undoStack[0]).toBe(action);
  });

  it('应该清空重做栈', () => {
    const action1 = createAddAction('block-1');
    const action2 = createAddAction('block-2');

    const result1 = pushUndoAction([], action1);
    const result2 = pushUndoAction(result1.undoStack, action2);

    expect(result2.redoStack).toHaveLength(0);
  });

  it('不应该修改原始的撤销栈', () => {
    const originalStack: BuildAction[] = [createAddAction('block-1')];
    const action = createAddAction('block-2');

    const result = pushUndoAction(originalStack, action);

    expect(originalStack).toHaveLength(1);
    expect(result.undoStack).not.toBe(originalStack);
  });

  it('不应该超过最大撤销步数', () => {
    let undoStack: BuildAction[] = [];
    let redoStack: BuildAction[] = [];

    for (let i = 0; i < MAX_UNDO_STEPS + 10; i++) {
      const result = pushUndoAction(undoStack, createAddAction(`block-${i}`));
      undoStack = result.undoStack;
      redoStack = result.redoStack;
    }

    expect(undoStack.length).toBe(MAX_UNDO_STEPS);
  });

  it('超过最大步数时应该移除最早的操作', () => {
    let undoStack: BuildAction[] = [];

    for (let i = 0; i < MAX_UNDO_STEPS + 5; i++) {
      const result = pushUndoAction(undoStack, createAddAction(`block-${i}`));
      undoStack = result.undoStack;
    }

    const firstAction = undoStack[0] as { type: string; block: { id: string } };
    expect(firstAction.block.id).toBe('block-5');
  });

  it('应该在最大步数内正常添加操作', () => {
    let undoStack: BuildAction[] = [];

    for (let i = 0; i < MAX_UNDO_STEPS; i++) {
      const result = pushUndoAction(undoStack, createAddAction(`block-${i}`));
      undoStack = result.undoStack;
    }

    expect(undoStack.length).toBe(MAX_UNDO_STEPS);
    const firstAction = undoStack[0] as { type: string; block: { id: string } };
    expect(firstAction.block.id).toBe('block-0');
  });

  it('空撤销栈也应该正确处理', () => {
    const action = createAddAction('block-1');
    const result = pushUndoAction([], action);

    expect(result.undoStack).toHaveLength(1);
    expect(result.redoStack).toHaveLength(0);
  });
});
