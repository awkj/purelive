export default function Tooltip({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative inline-flex items-center group/tip">
      {children}
      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 rounded-md bg-[rgba(20,20,20,0.92)] backdrop-blur-[24px] text-white/90 text-[11px] font-medium whitespace-nowrap pointer-events-none opacity-0 scale-95 group-hover/tip:opacity-100 group-hover/tip:scale-100 transition-all duration-150 border border-white/6 shadow-[0_8px_24px_rgba(0,0,0,0.45)] z-20">
        {label}
      </span>
    </div>
  );
}
