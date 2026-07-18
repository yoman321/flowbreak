import { NextResponse } from "next/server";

type RequestBody = { workers?: number; queue?: boolean; burst?: number; apiLimit?: number; clientConnected?: boolean };

export async function POST(request: Request) {
  const { workers = 1, queue = false, burst = 500, apiLimit, clientConnected = true } = (await request.json()) as RequestBody;
  const capacity = workers * 100;
  const acceptedByApi = clientConnected ? Math.min(burst, typeof apiLimit === "number" ? Math.max(0, apiLimit) : burst) : 0;
  const acceptedByWorkers = queue ? acceptedByApi : Math.min(acceptedByApi, capacity);
  const dropped = clientConnected ? burst - acceptedByWorkers : 0;
  const backlog = queue ? Math.max(0, acceptedByWorkers - capacity) : 0;
  const passed = clientConnected && queue && workers >= 3 && acceptedByApi === burst;

  return NextResponse.json({
    passed,
    workers,
    queue,
    burst,
    apiLimit: typeof apiLimit === "number" ? apiLimit : null,
    processed: acceptedByWorkers,
    dropped,
    acceptedResponses: acceptedByWorkers,
    rejectedResponses: dropped,
    clientResponses: clientConnected ? burst : 0,
    unansweredRequests: clientConnected ? 0 : burst,
    maxBacklog: backlog,
    averageLatencyMs: queue ? Math.round(90 + backlog / 4) : 640,
    feedback: passed
      ? "Burst absorbed. The API queues incoming work while workers drain the backlog."
      : !clientConnected
        ? "The client needs both a request edge to the API and a response edge back before its requests can receive a response."
        : !queue
        ? "The burst reaches workers directly. Put a queue between the API and workers."
        : workers < 3
          ? "The queue is protecting workers, but processing capacity is still too low. Add workers."
          : "The API intake limit turns away part of the burst. Raise it to accept every request.",
  });
}
