import { useCallback, useEffect, useState } from 'react';
import type { Core } from './core';
import type { GroupSummary, LibraryMeta } from './core/types';
import { currentRoute, navigate, type Route } from './router';
import Breadcrumb from './ui/Breadcrumb';
import EntryView from './ui/EntryView';
import GroupView from './ui/GroupView';
import PracticeView from './ui/PracticeView';
import QuestionPage from './ui/QuestionPage';
import Toast from './ui/Toast';

export default function App({ core }: { core: Core }) {
  const [route, setRoute] = useState<Route>(currentRoute);
  const [groups, setGroups] = useState<GroupSummary[] | null>(null);
  const [meta, setMeta] = useState<LibraryMeta | null>(null);
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
    const [list, libraryMeta] = await Promise.all([
      core.listGroups(), core.getMeta(),
    ]);
    setGroups(list);
    setMeta(libraryMeta);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  // #group without an id lands on the first group (spec「总则」hash routes).
  const effectiveRoute: Route = route.name === 'group' && !route.groupId && groups?.length
    ? { name: 'group', groupId: groups[0].group.id }
    : route;

  const today = new Intl.DateTimeFormat('zh-CN', {
    month: 'long', day: 'numeric', weekday: 'short',
  }).format(new Date());

  return (
    <>
      <Topbar
        active={effectiveRoute.name === 'entry' ? 'entry' : 'library'}
        today={today}
      />
      <div className="shell">
        <LeftRail groups={groups ?? []} route={effectiveRoute} />
        <main className="content">
          {effectiveRoute.name === 'home' ? (
            <HomeView groups={groups ?? []} meta={meta} />
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
        <RightRail route={effectiveRoute} />
      </div>
      <Toast key={toast?.id ?? 0} message={toast?.text ?? null} onClose={closeToast} />
    </>
  );
}

function Topbar({ active, today }: { active: string; today: string }) {
  const nav = [
    { key: 'library', label: '题库', hash: '#home' },
    { key: 'entry', label: '录入', hash: '#entry' },
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
                  {dueCount > 0 ? dueCount : ''}
                </em>
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}

function RightRail({ route }: { route: Route }) {
  if (route.name === 'practice') return <aside className="rail-right" />;
  return (
    <aside className="rail-right">
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
      <div className="mb-[26px]">
        <h2 className="text-t14 font-semibold text-ink-2 mb-[10px]">存储</h2>
        <p className="text-t12_5 leading-[1.7] text-mute m-0">
          题库只存在这台设备的浏览器里。记得在「备份」页导出 JSON 文件兜底。
        </p>
      </div>
    </aside>
  );
}

function HomeView({ groups, meta }: { groups: GroupSummary[]; meta: LibraryMeta | null }) {
  const totalQuestions = groups.reduce((sum, g) => sum + g.questionCount, 0);
  const dueTotal = groups.reduce((sum, g) => sum + g.dueCount, 0);
  const inReview = groups.reduce((sum, g) => sum + g.inReviewCount, 0);
  const backupText = meta?.lastBackupAt
    ? `上次备份 ${daysSince(meta.lastBackupAt)} 天前`
    : '尚未备份';
  const backupStale = !meta?.lastBackupAt || daysSince(meta.lastBackupAt) >= 7;
  return (
    <>
      <Breadcrumb trail={['我的题库']} />
      <h1 className="text-t40 font-bold text-ink-2 mb-3 tracking-[-.3px]">我的题库</h1>
      <p className="text-t15 text-mute mb-[18px] max-w-[62ch]">
        {groups.length} 个分组，{totalQuestions} 道题。做错的题会按
        1、2、4、7、15、30 天重新出现，直到通过最后一个间隔。
      </p>
      <div className="pills">
        <span className={`pill ${dueTotal > 0 ? 'bg-orange-wash text-[#9C5620]' : 'bg-blue-wash text-blue-ink'}`}>
          <b className="num">{dueTotal}</b> 道今天到期
        </span>
        <span className="pill bg-blue-wash text-blue-ink">
          <b className="num">{inReview}</b> 道在复习中
        </span>
        <span className={`pill ${backupStale ? 'bg-orange-wash text-[#9C5620]' : 'bg-blue-wash text-blue-ink'}`}>
          {backupText}
        </span>
      </div>
      <hr className="hairline" />
      <ul className="dotlist list-none m-0 p-0">
        {groups.map(({ group, questionCount, correctRate, dueCount }) => (
          <li key={group.id}>
            <button className="row flex w-full items-baseline gap-[14px] py-[15px] text-left"
              onClick={() => navigate({ name: 'group', groupId: group.id })}>
              <span className="text-amber text-[19px] leading-none flex-none">·</span>
              <span className="row-title flex-1 min-w-0">{group.name}</span>
              <span className="meta flex-none text-t13 text-mute num flex items-center gap-[14px]">
                <span>{questionCount} 题</span>
                <span>{correctRate === null ? '尚未练习' : `正确率 ${Math.round(correctRate * 100)}%`}</span>
                <span>{dueCount > 0 ? `到期 ${dueCount}` : '无到期'}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

function daysSince(iso: string): number {
  const then = new Date(iso).getTime();
  return Math.max(0, Math.floor((Date.now() - then) / 86_400_000));
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
