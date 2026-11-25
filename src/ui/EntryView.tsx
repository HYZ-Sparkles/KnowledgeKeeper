import { useEffect, useState } from 'react';
import type { Core } from '../core';
import type { GroupSummary, QuestionInput } from '../core/types';
import Breadcrumb from './Breadcrumb';
import { defaultGroupId } from './entryGroups';
import { readEntryGroupId, writeEntryGroupId } from './deviceState';
import QuestionForm from './QuestionForm';

export default function EntryView({
  core, groups, showToast,
}: {
  core: Core;
  groups: GroupSummary[];
  showToast: (message: string) => void;
}) {
  const [groupId, setGroupId] = useState('');

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

  async function save(input: QuestionInput) {
    const group = groups.find((g) => g.group.id === groupId);
    await core.createQuestion(input, groupId);
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
          onSubmit={save}
        />
      )}
    </>
  );
}
