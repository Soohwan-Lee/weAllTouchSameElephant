"use client";

import { useSession } from "@/lib/store";
import { Header } from "@/components/Header";
import { StartScreen } from "@/components/StartScreen";
import { GatherScreen } from "@/components/GatherScreen";
import { ConnectScreen } from "@/components/ConnectScreen";
import { MirrorScreen } from "@/components/MirrorScreen";

export default function Home() {
  const step = useSession((s) => s.step);

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
