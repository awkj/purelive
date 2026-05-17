import { useStoreSelect } from '../state';

export default function QualityLabel() {
  const label = useStoreSelect((s) => s.qualityLabel);
  if (!label) return null;

  return (
    <div className="inline-flex items-center px-2.5 h-[38px] text-[13px] font-medium text-white/60 whitespace-nowrap tracking-wide">
      {label}
    </div>
  );
}
