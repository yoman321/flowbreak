import { NextResponse } from "next/server";

type RequestBody = { workers?: number; queue?: boolean; burst?: number; apiLimit?: number };

export async function POST(request: Request) {
  const { workers = 1, queue = false, burst = 500, apiLimit } = (await request.json()) as RequestBody;
  const capacity = workers * 100;
  const acceptedByApi = Math.min(burst, typeof apiLimit === "number" ? Math.max(0, apiLimit) : burst);
  const dropped = queue ? burst - acceptedByApi : Math.max(0, burst - capacity);
  const backlog = queue ? Math.max(0, acceptedByApi - capacity) : 0;
  const passed = queue && workers >= 3 && acceptedByApi === burst;

  return NextResponse.json({
    passed,
    workers,
    queue,
    burst,
    apiLimit: typeof apiLimit === "number" ? apiLimit : null,
    processed: burst - dropped,
    dropped,
    maxBacklog: backlog,
    averageLatencyMs: queue ? Math.round(90 + backlog / 4) : 640,
    feedback: passed
      ? "Burst absorbed. The API queues incoming work while workers drain the backlog."
      : !queue
        ? "The burst reaches workers directly. Put a queue between the API and workers."
        : workers < 3
          ? "The queue is protecting workers, but processing capacity is still too low. Add workers."
          : "The API intake limit turns away part of the burst. Raise it to accept every request.",
  });
}
