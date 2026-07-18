import type { DragEvent } from "react";

export function CanvasTrashTarget({ onDrop }: { onDrop: (event: DragEvent<HTMLDivElement>) => void }) {
  return <div className="canvas-trash" onDragOver={(event) => { event.preventDefault(); event.stopPropagation(); }} onDrop={onDrop} aria-label="Drop node here to delete it">
    <span aria-hidden="true">⌫</span>
    DROP TO DELETE
  </div>;
}
