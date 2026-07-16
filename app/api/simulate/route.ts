import { NextResponse } from "next/server";

type RequestBody = { workers?: number; queue?: boolean; burst?: number };

export async function POST(request: Request) {
  const { workers = 1, queue = false, burst = 500 } = (await request.json()) as RequestBody;
  const capacity = workers * 100;
  const dropped = queue ? 0 : Math.max(0, burst - capacity);
  const backlog = queue ? Math.max(0, burst - capacity) : 0;
  const passed = queue && workers >= 3;

  return NextResponse.json({
    passed,
    workers,
    queue,
    burst,
    processed: burst - dropped,
    dropped,
    maxBacklog: backlog,
    averageLatencyMs: queue ? Math.round(90 + backlog / 4) : 640,
    feedback: passed
      ? "Burst absorbed. Your queue protects the API while workers drain the backlog."
      : queue
        ? "The queue absorbed the burst, but worker capacity is still too low to meet the goal."
        : "Requests exceed service capacity. Add a queue before the burst reaches the service.",
  });
}
