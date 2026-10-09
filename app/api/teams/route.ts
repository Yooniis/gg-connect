export const dynamic = "force-dynamic";

/** Team forming is disabled — everyone plays in one community. */
export async function GET() {
  return Response.json(
    { teams: [], disabled: true },
    { headers: { "cache-control": "no-store" } },
  );
}

export async function POST() {
  return Response.json(
    {
      error:
        "Lag är avstängda. Alla spelar i samma community – jaga toppen på XP-listan i stället.",
    },
    { status: 410 },
  );
}
