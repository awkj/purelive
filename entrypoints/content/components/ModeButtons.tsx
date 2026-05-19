import { useStoreSelect, setState, type Mode } from '../state';
import { useCapabilities } from '../sites/AdapterContext';
import { IconCentered, IconCinema, IconFullscreen, IconFullscreenExit } from './icons';
import Tooltip from './Tooltip';

const baseModes: { key: Mode; label: string }[] = [
  { key: 'centered', label: '居中' },
  { key: 'page', label: '影院模式' },
  { key: 'fullscreen', label: '全屏' },
];

function iconFor(key: Mode, active: boolean) {
  if (key === 'centered') return <IconCentered />;
  if (key === 'page') return <IconCinema />;
  return active ? <IconFullscreenExit /> : <IconFullscreen />;
}

export default function ModeButtons() {
  const current = useStoreSelect((s) => s.mode);
  const { fullscreen } = useCapabilities();

  const setMode = (target: Mode) => {
    if (current === target) {
      if (target === 'fullscreen') {
        fullscreen?.exit();
        setState({ mode: 'centered' });
      }
      return;
    }
    if (current === 'fullscreen') fullscreen?.exit();
    setState({ mode: target });
    if (target === 'fullscreen') fullscreen?.request();
  };

  const labelFor = (key: Mode, active: boolean) =>
    key === 'fullscreen' && active ? '退出全屏' : baseModes.find((m) => m.key === key)!.label;

  return (
    <>
      {baseModes.map(({ key }) => {
        const active = current === key;
        return (
          <Tooltip key={key} label={labelFor(key, active)}>
            <button
              onClick={() => setMode(key)}
              className={`inline-flex items-center justify-center w-[38px] h-[38px] rounded-[10px] cursor-pointer transition-all duration-150 shrink-0 hover:bg-white/10 hover:text-white active:scale-92 ${active ? 'text-[#3ea6ff]' : 'text-white/88'}`}
            >
              {iconFor(key, active)}
            </button>
          </Tooltip>
        );
      })}
    </>
  );
}
