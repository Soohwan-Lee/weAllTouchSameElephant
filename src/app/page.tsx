"use client";

import { useSession } from "@/lib/store";
import { Header } from "@/components/Header";
import { StartScreen } from "@/components/StartScreen";
import { GatherScreen } from "@/components/GatherScreen";
import { ConnectScreen } from "@/components/ConnectScreen";
import { MirrorScreen } from "@/components/MirrorScreen";
import { useI18n } from "@/lib/i18n";

export default function Home() {
  const step = useSession((s) => s.step);
  const { ready } = useI18n();

  if (!ready) return <div className="min-h-screen bg-paper" aria-busy="true" />;

  return (
    <div className="min-h-screen">
      <Header />
      <main>
        {step === "start" && <StartScreen />}
        {step === "gather" && <GatherScreen />}
        {step === "connect" && <ConnectScreen />}
        {step === "mirror" && <MirrorScreen />}
      </main>
    </div>
  );
}
