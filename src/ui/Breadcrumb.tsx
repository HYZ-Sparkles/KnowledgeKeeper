export default function Breadcrumb({ trail }: { trail: string[] }) {
  return (
    <div className="text-t14 text-amber mb-[18px]">
      {trail.map((part, i) => (
        <span key={i}>
          {i > 0 && <span className="text-faint mx-2">/</span>}
          {part}
        </span>
      ))}
    </div>
  );
}
