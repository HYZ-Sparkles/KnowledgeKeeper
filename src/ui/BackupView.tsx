import { useRef, useState, type ChangeEvent } from 'react';
import type { Core } from '../core';
import type {
  BackupInfo, LibraryCounts, LibraryMeta,
} from '../core/types';
import Breadcrumb from './Breadcrumb';
import { backupBadge } from './backupCopy';
import Dialog from './Dialog';

export default function BackupView({
  core, meta, counts, refreshMeta, onRestored, showToast,
}: {
  core: Core;
  meta: LibraryMeta | null;
  counts: LibraryCounts | null;
  refreshMeta: () => Promise<void>;
  onRestored: () => Promise<void>;
  showToast: (message: string) => void;
}) {
  const badge = backupBadge(meta);
  const fileInput = useRef<HTMLInputElement>(null);
  const [exporting, setExporting] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [pending, setPending] = useState<{
    fileName: string;
    json: string;
    info: BackupInfo;
  } | null>(null);
  const [restoring, setRestoring] = useState(false);

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

  async function pickFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Let the same file be picked again after a cancel or a failed inspection.
    event.target.value = '';
    if (!file) return;
    const json = await file.text();
    let info: BackupInfo;
    try {
      info = core.inspectBackup(json);
    } catch (error) {
      setWarning(error instanceof Error ? error.message : '这个文件不能用。');
      return;
    }
    setWarning(null);
    setPending({ fileName: file.name, json, info });
  }

  async function confirmRestore() {
    if (!pending) return;
    setRestoring(true);
    try {
      const result = await core.restore(pending.json);
      setPending(null);
      showToast(`已恢复 ${result.groups} 个分组、${result.questions} 道题`);
      await onRestored();
    } finally {
      setRestoring(false);
    }
  }

  return (
    <>
      <Breadcrumb trail={['我的题库', '备份与恢复']} />
      <h1 className="text-t40 font-bold text-ink-2 mb-3 tracking-[-.3px]">
        备份与恢复
      </h1>
      <p className="text-t15 text-mute mb-[18px] max-w-[62ch]">
        {'题库只存在这台设备的浏览器里。浏览器清理存储、换设备、误删分组，都靠这个 JSON 文件兜底。'}
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
            {'一个 JSON 文件，包含分组、题目、作答记录、排期状态和收藏。导出的同时会更新「上次备份」的时间。'}
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
        <section className="panel">
          <h2>从备份恢复</h2>
          <p>
            {'用一个备份文件整库替换当前题库。当前的分组、题目和作答记录都会消失，不能撤销。'}
          </p>
          <button
            className="btn"
            type="button"
            onClick={() => fileInput.current?.click()}
          >
            选择备份文件
          </button>
          <input
            ref={fileInput}
            className="hidden"
            type="file"
            accept="application/json,.json"
            onChange={(event) => void pickFile(event)}
          />
          {warning && (
            <div className="warn" role="alert">
              <span>{warning}</span>
            </div>
          )}
        </section>
        {/* 工单 21 预留槽位：在此加入「装到 iPad 主屏幕」说明块；本工单不实现。 */}
        <section data-slot="ipad-home-screen" />
      </div>
      {pending && (
        <Dialog
          title="从备份恢复"
          message={`用「${pending.fileName}」替换当前题库？文件里有 ${pending.info.groups} 个分组、${pending.info.questions} 道题；当前的分组、题目和作答记录都会消失，不能撤销。`}
          confirmLabel="恢复"
          confirmDisabled={restoring}
          destructive
          onConfirm={() => void confirmRestore()}
          onCancel={() => setPending(null)}
        />
      )}
    </>
  );
}
