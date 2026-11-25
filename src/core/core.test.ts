import { describe, it, expect } from 'vitest';
import { createCore } from './index';
import { fixedClock, fixedRandom, memoryAdapter } from './helpers';

describe('应用核心 · 首次启动', () => {
  it('创建默认分组「错题集」，题数为 0', async () => {
    const core = createCore({
      storage: memoryAdapter(),
      clock: fixedClock('2026-01-01T08:00:00Z'),
      random: fixedRandom(),
    });

    const groups = await core.listGroups();

    expect(groups).toHaveLength(1);
    expect(groups[0].group.name).toBe('错题集');
    expect(groups[0].questionCount).toBe(0);
  });
});
