import { useStoreSelect, setState, type Mode } from '../state';
import { useCapabilities } from '../sites/AdapterContext';
import { IconCentered, IconPageFs, IconFullscreen } from './icons';
import Tooltip from './Tooltip';

const modes: { key: Mode; icon: React.ReactNode; label: string }[] = [
  { key: 'centered', icon: <IconCentered />, label: '居中' },
  { key: 'page', icon: <IconPageFs />, label: '网页全屏' },
  { key: 'fullscreen', icon: <IconFullscreen />, label: '全屏' },
];

export default function ModeButtons() {
  const current = useStoreSelect((s) => s.mode);
  const { fullscreen } = useCapabilities();

  const setMode = (target: Mode) => {
    if (current === 'fullscreen') fullscreen?.exit();
    setState({ mode: target });
    if (target === 'fullscreen') fullscreen?.request();
  };

  return (
    <>
      {modes.map(({ key, icon, label }) => (
        <Tooltip key={key} label={label}>
          <button
            onClick={() => setMode(key)}
            className={`inline-flex items-center justify-center w-[38px] h-[38px] rounded-[10px] cursor-pointer transition-all duration-150 shrink-0 hover:bg-white/10 hover:text-white active:scale-92 ${current === key ? 'text-[#3ea6ff]' : 'text-white/88'}`}
          >
            {icon}
          </button>
        </Tooltip>
      ))}
    </>
  );
}
