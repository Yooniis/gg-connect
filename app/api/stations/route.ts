import { listTags } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Public station list without access codes (for manual check-in UI). */
export async function GET() {
  const tags = await listTags();
  return Response.json(
    {
      stations: tags
        .filter((t) => t.active)
        .map((t) => ({
          id: t.id,
          name: t.name,
          stationKey: t.stationKey,
          location: t.location,
        })),
    },
    { headers: { "cache-control": "no-store" } },
  );
}
