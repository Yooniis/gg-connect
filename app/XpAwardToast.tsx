"use client";

import { useEffect, useState } from "react";
import { CURRENCY } from "@/lib/types";

type Award = { base: number; bonus: number; total: number; elapsed: number };

export default function XpAwardToast() {
  const [award, setAward] = useState<Award | null>(null);
  useEffect(() => {
    const show = (event: Event) => {
      const detail = (event as CustomEvent<Award>).detail;
      if (detail) {
        setAward(detail);
        setTimeout(() => setAward(null), 6500);
      }
    };
    window.addEventListener("xp-awarded", show);
    return () => window.removeEventListener("xp-awarded", show);
  }, []);
  if (!award) return null;
  const m = Math.floor(award.elapsed / 60);
  const s = award.elapsed % 60;
  return (
    <div className="xp-award-toast">
      <button onClick={() => setAward(null)} aria-label="Stäng">
        ×
      </button>
      <small>
        UPPDRAG SLUTFÖRT · {m}:{String(s).padStart(2, "0")}
      </small>
      <strong>
        +{award.total} {CURRENCY}
      </strong>
      <span>
        Grund {award.base} {CURRENCY}
        {award.bonus > 0
          ? ` + tidsbonus ${award.bonus} ${CURRENCY}`
          : " · ingen tidsbonus"}
      </span>
    </div>
  );
}
