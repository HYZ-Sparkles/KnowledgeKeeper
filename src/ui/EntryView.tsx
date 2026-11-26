import { useEffect, useState } from 'react';
import type { Core } from '../core';
import type { GroupSummary, QuestionInput } from '../core/types';
import Breadcrumb from './Breadcrumb';
import Dialog from './Dialog';
import { defaultGroupId } from './entryGroups';
import { readEntryGroupId, writeEntryGroupId } from './deviceState';
import QuestionForm from './QuestionForm';

export default function EntryView({
  core, groups, showToast, refreshGroups,
}: {
  core: Core;
  groups: GroupSummary[];
  showToast: (message: string) => void;
  refreshGroups: () => Promise<void>;
}) {
  const [groupId, setGroupId] = useState('');
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    if (groups.length === 0) return;
    const valid = (id: string | null) =>
      id && groups.some((g) => g.group.id === id) ? id : null;
    setGroupId((current) =>
      valid(current) ?? valid(readEntryGroupId()) ?? defaultGroupId(groups));
  }, [groups]);

  function changeGroup(id: string) {
    setGroupId(id);
    writeEntryGroupId(id);
  }

  async function createGroup() {
    const group = await core.createGroup(newName);
    await refreshGroups();
    changeGroup(group.id);
    setCreating(false);
  }

  async function save(input: QuestionInput) {
    const group = groups.find((g) => g.group.id === groupId);
    await core.createQuestion(input, groupId);
    // The shell's counts come from the group list, so refresh before the toast.
    await refreshGroups();
    showToast(`已保存到「${group?.group.name ?? ''}」`);
  }

  return (
    <>
      <Breadcrumb trail={['我的题库', '录入']} />
      <h1 className="text-t40 font-bold text-ink-2 mb-3 tracking-[-.3px]">录入一道题</h1>
      <p className="text-t15 text-mute mb-[18px] max-w-[62ch]">
        文件里没有的题，用这个表单补进来。录入不改动任何已有题目的排期。
      </p>
      <hr className="hairline" />
      {groupId && (
        <QuestionForm
          mode="create"
          groups={groups}
          groupId={groupId}
          onGroupChange={changeGroup}
          onRequestCreateGroup={() => { setNewName(''); setCreating(true); }}
          onSubmit={save}
        />
      )}
      {creating && (
        <Dialog
          title="新建分组"
          message="起个名字，之后录入和导入时都能选中它。"
          confirmLabel="创建"
          confirmDisabled={!newName.trim()}
          onConfirm={() => void createGroup()}
          onCancel={() => setCreating(false)}
        >
          <label className="field">
            <span>分组名</span>
            <input
              className="field-input w-full"
              autoFocus
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
            />
          </label>
        </Dialog>
      )}
    </>
  );
}
