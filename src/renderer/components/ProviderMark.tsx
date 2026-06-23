import type { ProviderId } from "../../shared/types";
import claudeLogo from "../assets/providers/claude.webp";
import nvidiaLogo from "../assets/providers/nvidia.svg";
import openAiLogo from "../assets/providers/openai.png";

interface ProviderMarkProps {
  provider: ProviderId;
}

const providerLogos: Record<ProviderId, string> = {
  openai: openAiLogo,
  claude: claudeLogo,
  nvidia: nvidiaLogo
};

export function ProviderMark({ provider }: ProviderMarkProps) {
  return (
    <span className={`provider-mark provider-mark-${provider}`} aria-hidden="true">
      <img src={providerLogos[provider]} alt="" draggable={false} />
    </span>
  );
}
