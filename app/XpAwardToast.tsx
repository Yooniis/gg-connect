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
  const total = Math.max(0, Math.floor(award.elapsed));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const timeLabel =
    total > 90 * 60
      ? "ingen tidsbonus"
      : h > 0
        ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
        : `${m}:${String(s).padStart(2, "0")}`;
  return (
    <div className="xp-award-toast">
      <button onClick={() => setAward(null)} aria-label="Stäng">
        ×
      </button>
      <small>UPPDRAG SLUTFÖRT · {timeLabel}</small>
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
