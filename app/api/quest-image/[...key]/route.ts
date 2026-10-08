import { readHintImage } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  _: Request,
  { params }: { params: Promise<{ key: string[] }> },
) {
  const { key } = await params;
  const object = await readHintImage(key.join("/"));
  if (!object) return new Response("Not found", { status: 404 });

  const headers = new Headers();
  headers.set("content-type", object.contentType);
  headers.set("cache-control", "public, max-age=3600");
  if (object.etag) headers.set("etag", object.etag);
  return new Response(new Uint8Array(object.buffer), { headers });
}
