import {
  HardHatIcon,
  BroomIcon,
  ClockCardIcon,
  ConeIcon,
  SpeechLockIcon,
  FlameIcon,
  PinIcon,
} from "@/src/components/icons";
import type { NavIconKey } from "./nav";

export function NavIcon({ icon, sector }: { icon: NavIconKey; sector: "construction" | "college" }) {
  const props = { size: 20 };
  switch (icon) {
    case "overview":
      return sector === "college" ? <BroomIcon {...props} /> : <HardHatIcon {...props} />;
    case "attendance":
      return <ClockCardIcon {...props} />;
    case "safety":
      return <ConeIcon {...props} />;
    case "feedback":
      return <SpeechLockIcon {...props} />;
    case "risk":
      return <FlameIcon {...props} />;
    case "sites":
      return <PinIcon {...props} />;
  }
}
