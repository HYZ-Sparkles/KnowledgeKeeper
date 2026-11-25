import { useCallback, useEffect, useState } from 'react';
import type { Core } from './core';
import type {
  GroupSummary, LibraryCounts, LibraryMeta, RoundItem,
} from './core/types';
import { currentRoute, navigate, type Route } from './router';
import BackupView from './ui/BackupView';
import { backupBadge, backupRailText } from './ui/backupCopy';
import Breadcrumb from './ui/Breadcrumb';
import {
  isStandaloneMode, readHomeBannerDismissed, writeHomeBannerDismissed,
} from './ui/deviceState';
import EntryView from './ui/EntryView';
import GroupView from './ui/GroupView';
import ImportView from './ui/ImportView';
import PracticeView from './ui/PracticeView';
import QuestionPage from './ui/QuestionPage';
import { rulerCells, rulerNote } from './ui/scheduleCopy';
import Toast from './ui/Toast';

export default function App({ core }: { core: Core }) {
  const [route, setRoute] = useState<Route>(currentRoute);
  const [groups, setGroups] = useState<GroupSummary[] | null>(null);
  const [meta, setMeta] = useState<LibraryMeta | null>(null);
  const [counts, setCounts] = useState<LibraryCounts | null>(null);
  const [practiceItem, setPracticeItem] = useState<RoundItem | null>(null);
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);

  const showToast = useCallback((text: string) => {
    setToast((prev) => ({ id: (prev?.id ?? 0) + 1, text }));
  }, []);
  const closeToast = useCallback(() => setToast(null), []);

  useEffect(() => {
    const onHash = () => setRoute(currentRoute());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const refresh = useCallback(async () => {
    const [list, libraryMeta, libraryCounts] = await Promise.all([
      core.listGroups(), core.getMeta(), core.getLibraryCounts(),
    ]);
    setGroups(list);
    setMeta(libraryMeta);
    setCounts(libraryCounts);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  // #group without an id lands on the first group (spec「总则」hash routes).
  const effectiveRoute: Route = route.name === 'group' && !route.groupId && groups?.length
    ? { name: 'group', groupId: groups[0].group.id }
    : route;
  const activeGroup: GroupSummary | null = effectiveRoute.name === 'group'
    ? (groups ?? []).find((g) => g.group.id === effectiveRoute.groupId) ?? null
    : null;

  const today = new Intl.DateTimeFormat('zh-CN', {
    month: 'long', day: 'numeric', weekday: 'short',
  }).format(new Date());
  const dueTotal = (groups ?? []).reduce((sum, g) => sum + g.dueCount, 0);

  return (
    <>
      <Topbar
        active={effectiveRoute.name === 'import'
          ? 'import' : effectiveRoute.name === 'entry' ? 'entry'
            : effectiveRoute.name === 'backup' ? 'backup' : 'library'}
        today={today}
        dueTotal={dueTotal}
      />
      <div className="shell">
        <LeftRail groups={groups ?? []} route={effectiveRoute} />
        <main className="content">
          {effectiveRoute.name === 'home' ? (
            <HomeView groups={groups ?? []} meta={meta} />
          ) : effectiveRoute.name === 'import' ? (
            <ImportView
              core={core}
              groups={groups ?? []}
              showToast={showToast}
              refreshGroups={refresh}
            />
          ) : effectiveRoute.name === 'entry' ? (
            <EntryView
              core={core}
              groups={groups ?? []}
              showToast={showToast}
              refreshGroups={refresh}
            />
          ) : effectiveRoute.name === 'question' ? (
            <QuestionPage
              core={core}
              questionId={effectiveRoute.questionId}
              groups={groups ?? []}
              refreshGroups={refresh}
              showToast={showToast}
            />
          ) : effectiveRoute.name === 'practice' ? (
            <PracticeView
              core={core}
              groupId={effectiveRoute.groupId}
              groups={groups ?? []}
              refreshGroups={refresh}
              onItemChange={setPracticeItem}
              showToast={showToast}
            />
          ) : effectiveRoute.name === 'backup' ? (
            <BackupView
              core={core}
              meta={meta}
              counts={counts}
              refreshMeta={refresh}
              onRestored={() => {
                navigate({ name: 'home' });
                return refresh();
              }}
              showToast={showToast}
            />
          ) : (
            <GroupView
              core={core}
              groupId={effectiveRoute.groupId}
              groups={groups ?? []}
              refreshGroups={refresh}
              showToast={showToast}
            />
          )}
        </main>
        <RightRail
          route={effectiveRoute}
          practiceItem={practiceItem}
          group={activeGroup}
          meta={meta}
        />
      </div>
      <Toast key={toast?.id ?? 0} message={toast?.text ?? null} onClose={closeToast} />
    </>
  );
}

function Topbar({
  active, today, dueTotal,
}: { active: string; today: string; dueTotal: number }) {
  const nav = [
    { key: 'library', label: '题库', hash: '#home' },
    { key: 'import', label: '导入', hash: '#import' },
    { key: 'entry', label: '录入', hash: '#entry' },
    { key: 'backup', label: '备份', hash: '#backup' },
  ];
  return (
    <header className="topbar">
      <button className="brand" onClick={() => navigate({ name: 'home' })}>
        <BrandIcon />
        <span>Knowledge Keeper</span>
      </button>
      <nav className="nav flex items-center gap-[2px]">
        {nav.map((item) => (
          <button
            key={item.key}
            className={`nav-btn ${active === item.key ? 'active' : ''}`}
            onClick={() => { window.location.hash = item.hash; }}
          >
            {item.label}
          </button>
        ))}
      </nav>
      <div className="topbar-right ml-auto flex items-center gap-[14px] text-t13_5 text-mute">
        <span className="num">{today}</span>
        <i className="inline-block h-[3px] w-[3px] rounded-full bg-faint" />
        <span>今天到期 <b className="num font-semibold text-orange">{dueTotal}</b> 道</span>
      </div>
    </header>
  );
}

function LeftRail({ groups, route }: { groups: GroupSummary[]; route: Route }) {
  return (
    <aside className="rail-left">
      <div className="px-[22px] pb-[18px] pt-[6px] text-t13_5 text-amber">
        我的题库
      </div>
      <ul className="tree list-none m-0 p-0">
        {groups.map(({ group, dueCount }) => {
          const active = route.name === 'group' && route.groupId === group.id;
          return (
            <li key={group.id}>
              <button
                className={`tg flex w-full items-center gap-[6px] px-5 py-[7px]
                            text-left text-t14 ${active ? 'font-semibold text-ink-2' : 'text-ink'}`}
                onClick={() => navigate({ name: 'group', groupId: group.id })}
              >
                <span className="truncate">{group.name}</span>
                <em className={`ml-auto not-italic text-[12px] num ${dueCount === 0 ? 'text-faint' : 'text-orange'}`}>
                  {dueCount}
                </em>
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}

function RightRail({
  route, practiceItem, group, meta,
}: {
  route: Route;
  practiceItem: RoundItem | null;
  group: GroupSummary | null;
  meta: LibraryMeta | null;
}) {
  if (route.name === 'practice') {
    const schedule = practiceItem?.schedule ?? { stage: 0, dueDate: null };
    return (
      <aside className="rail-right">
        <div className="mb-[26px]">
          <h2 className="text-[14.5px] font-semibold text-ink-2 mb-[10px]">
            这道题
          </h2>
          <div className="rr-scale">
            {rulerCells(schedule).map((on, index) => (
              <i key={index} className={on ? 'on' : ''} />
            ))}
          </div>
          <p className="text-t12_5 leading-[1.7] text-mute m-0 mt-[6px]">
            {rulerNote(schedule)}
          </p>
        </div>
      </aside>
    );
  }
  if (route.name === 'group') {
    const total = group?.questionCount ?? 0;
    const due = group?.dueCount ?? 0;
    return (
      <aside className="rail-right">
        <div className="mb-[26px]">
          <h2 className="mb-[10px] text-[14.5px] font-semibold text-ink-2">
            本轮
          </h2>
          <p className="m-0 text-t12_5 leading-[1.7] text-mute">
            {due > 0
              ? `到期 ${due} 道按到期日从早到晚排在前面，其余 ${total - due} 道打乱跟上。`
              : `这一组没有到期的题，${total} 道全部打乱。`}
          </p>
          <p className="m-0 mt-[6px] text-t12_5 leading-[1.7] text-mute">
            一轮 {total} 道，做完自动重新打乱，不记录中断位置。
          </p>
        </div>
      </aside>
    );
  }
  if (route.name === 'backup') {
    return (
      <aside className="rail-right">
        <StorageBlock meta={meta} />
      </aside>
    );
  }
  return (
    <aside className="rail-right">
      {route.name === 'import' ? (
        <div className="mb-[26px]">
          <h2 className="text-t14 font-semibold text-ink-2 mb-[10px]">校对</h2>
          <p className="text-t12_5 leading-[1.7] text-mute m-0">
            答案有两个以上字母推断为多选题；选项写「正确 / 错误」或答案是判断符号推断为判断题，其余是单选题。
          </p>
          <p className="text-t12_5 leading-[1.7] text-mute m-0 mt-[6px]">
            缺答案的题会一直标红并拦住写入，补齐后才能写进分组。
          </p>
        </div>
      ) : null}
      {route.name === 'entry' ? (
        <div className="mb-[26px]">
          <h2 className="text-t14 font-semibold text-ink-2 mb-[10px]">录入</h2>
          <p className="text-t12_5 leading-[1.7] text-mute m-0">
            一份表单反复用：题型决定要填什么，解析可以不填。
            匹配题用一组共用选项配多个子题，每个子题各自选答案。
            保存后留在表单，连续录入不用刷新。
          </p>
        </div>
      ) : null}
      <div className="mb-[26px]">
        <h2 className="text-t14 font-semibold text-ink-2 mb-[10px]">排期</h2>
        <p className="text-t12_5 leading-[1.7] text-mute m-0">
          做错的题按 <b className="text-ink-2 font-semibold">1、2、4、7、15、30</b> 天
          的间隔重新出现，直到通过最后一个间隔。
        </p>
        <div className="flex gap-[3px] my-[10px]">
          {Array.from({ length: 6 }, (_, i) => (
            <i key={i} className="flex-1 h-1 bg-rule rounded-[1px]" />
          ))}
        </div>
      </div>
      <StorageBlock meta={meta} />
    </aside>
  );
}

/** The storage explanation and plain-text last-backup line, shared by home and backup. */
function StorageBlock({ meta }: { meta: LibraryMeta | null }) {
  return (
    <div className="mb-[26px]">
      <h2 className="text-t14 font-semibold text-ink-2 mb-[10px]">存储</h2>
      <p className="text-t12_5 leading-[1.7] text-mute m-0">
        浏览器清理存储后题库会消失，定期导出一份 JSON 文件到「文件」app 里。
      </p>
      <p className="text-t12_5 leading-[1.7] text-ink-2 m-0 mt-[6px]">
        {backupRailText(meta)}
      </p>
    </div>
  );
}

function HomeView({ groups, meta }: { groups: GroupSummary[]; meta: LibraryMeta | null }) {
  const totalQuestions = groups.reduce((sum, g) => sum + g.questionCount, 0);
  const dueTotal = groups.reduce((sum, g) => sum + g.dueCount, 0);
  const inReview = groups.reduce((sum, g) => sum + g.inReviewCount, 0);
  const badge = backupBadge(meta);
  const [dismissed, setDismissed] = useState(readHomeBannerDismissed);
  const showBanner = !isStandaloneMode() && !dismissed;
  return (
    <>
      <Breadcrumb trail={['我的题库']} />
      <h1 className="text-t40 font-bold text-ink-2 mb-3 tracking-[-.3px]">我的题库</h1>
      <p className="text-t15 text-mute mb-[18px] max-w-[62ch]">
        {groups.length} 个分组，{totalQuestions} 道题。做错的题会按
        1、2、4、7、15、30 天重新出现，直到通过最后一个间隔。
      </p>
      {showBanner && (
        <div className="warn install-banner" role="status">
          <span>
            {'在 Safari 点「分享 → 添加到主屏幕」，全屏使用，存储也不会被 Safari 清理。'}
          </span>
          <button
            className="btn"
            type="button"
            onClick={() => {
              writeHomeBannerDismissed();
              setDismissed(true);
            }}
          >
            知道了
          </button>
        </div>
      )}
      <div className="pills">
        <span className="pill bg-orange-wash text-[#9C5620]">
          <b className="num">{dueTotal}</b> 道今天到期
        </span>
        <span className="pill bg-blue-wash text-blue-ink">
          <b className="num">{inReview}</b> 道在复习中
        </span>
        <span className={`pill ${badge.stale ? 'bg-orange-wash text-[#9C5620]' : 'bg-blue-wash text-blue-ink'}`}>
          {badge.text}
        </span>
      </div>
      <hr className="hairline" />
      <ul className="dotlist list-none m-0 p-0">
        {groups.map(({ group, questionCount, correctRate, dueCount }) => {
          const rate = correctRate === null ? null : Math.round(correctRate * 100);
          return (
            <li key={group.id}>
              <button className="row flex w-full items-baseline gap-[14px] py-[15px] text-left"
                onClick={() => navigate({ name: 'group', groupId: group.id })}>
                <span className="text-amber text-[19px] leading-none flex-none">·</span>
                <span className="row-title flex-1 min-w-0">{group.name}</span>
                <span className="meta flex-none text-t13 text-mute num flex items-center gap-[14px]">
                  <span>{questionCount} 题</span>
                  {rate === null ? (
                    <span>尚未练习</span>
                  ) : (
                    <span className="rate">
                      正确率 {rate}%<i><b style={{ width: `${rate}%` }} /></i>
                    </span>
                  )}
                  <span className={dueCount > 0 ? 'text-orange' : 'text-faint'}>
                    {dueCount > 0 ? `到期 ${dueCount}` : '无到期'}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}

function BrandIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19v17H6.5A2.5 2.5 0 0 0 4 22V5.5Z" />
      <path d="M8 7h7M8 11h7" />
    </svg>
  );
}
