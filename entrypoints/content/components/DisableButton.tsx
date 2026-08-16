import { setState, useStoreSelect } from '../state';
import { useCapabilities } from '../sites/AdapterContext';
import { IconPower } from './icons';
import Tooltip from './Tooltip';

export default function DisableButton() {
  const mode = useStoreSelect((s) => s.mode);
  const { fullscreen } = useCapabilities();

  const disable = () => {
    if (mode === 'fullscreen') {
      fullscreen?.exit();
      setState({ enabled: false, mode: 'centered' });
      return;
    }
    setState({ enabled: false });
  };

  return (
    <Tooltip label="退出沉浸模式">
      <button
        type="button"
        onClick={disable}
        aria-label="退出沉浸模式"
        className="inline-flex items-center justify-center w-[38px] h-[38px] rounded-[10px] text-white/60 cursor-pointer transition-all duration-150 shrink-0 hover:bg-white/10 hover:text-white active:scale-92"
      >
        <IconPower />
      </button>
    </Tooltip>
  );
}
