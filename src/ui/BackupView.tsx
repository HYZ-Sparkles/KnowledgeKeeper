import { useState } from 'react';
import type { Core } from '../core';
import type { LibraryCounts, LibraryMeta } from '../core/types';
import Breadcrumb from './Breadcrumb';
import { backupBadge } from './backupCopy';

export default function BackupView({
  core, meta, counts, refreshMeta, showToast,
}: {
  core: Core;
  meta: LibraryMeta | null;
  counts: LibraryCounts | null;
  refreshMeta: () => Promise<void>;
  showToast: (message: string) => void;
}) {
  const badge = backupBadge(meta);
  const [exporting, setExporting] = useState(false);

  async function exportBackup() {
    setExporting(true);
    try {
      const json = await core.backup();
      const url = URL.createObjectURL(
        new Blob([json], { type: 'application/json' }),
      );
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = core.backupFileName();
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      await refreshMeta();
      showToast('已导出');
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <Breadcrumb trail={['我的题库', '备份与恢复']} />
      <h1 className="text-t40 font-bold text-ink-2 mb-3 tracking-[-.3px]">
        备份与恢复
      </h1>
      <p className="text-t15 text-mute mb-[18px] max-w-[62ch]">
        题库只存在这台设备的浏览器里。浏览器清理存储、换设备、误删分组，
        都靠这个 JSON 文件兜底。
      </p>
      <div className="pills">
        <span className={`pill ${badge.stale
          ? 'bg-orange-wash text-[#9C5620]'
          : 'bg-blue-wash text-blue-ink'}`}>
          {badge.text}
        </span>
        <span className="pill bg-paper-2 text-mute num">
          <b className="font-semibold">{counts?.questions ?? 0}</b> 道题 ·{' '}
          <b className="font-semibold">{counts?.attempts ?? 0}</b> 条作答
        </span>
      </div>
      <hr className="hairline" />
      <div className="stack">
        <section className="panel">
          <h2>导出备份</h2>
          <p>
            一个 JSON 文件，包含分组、题目、作答记录、排期状态和收藏。
            导出的同时会更新「上次备份」的时间。
          </p>
          <button
            className="btn btn-primary"
            type="button"
            disabled={exporting}
            onClick={() => void exportBackup()}
          >
            {exporting ? '正在导出…' : '导出备份文件'}
          </button>
        </section>
        {/* 工单 21 预留槽位：在此加入「装到 iPad 主屏幕」说明块；本工单不实现。 */}
        <section data-slot="ipad-home-screen" />
      </div>
    </>
  );
}
