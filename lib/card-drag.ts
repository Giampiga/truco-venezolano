export function cardDrag(id: string, enabled: boolean) {
  let dragged = false;
  return {
    draggable: enabled,
    onDragStart: (event: import('react').DragEvent<HTMLButtonElement>) => {
      if (!enabled) {
        event.preventDefault();
        return;
      }
      event.dataTransfer.setData('text/truco-card', id);
      event.dataTransfer.effectAllowed = 'move';
    },
    onPointerDown: (event: import('react').PointerEvent<HTMLButtonElement>) => {
      if (!enabled || event.pointerType !== 'touch' || !event.isPrimary) return;
      const element = event.currentTarget;
      const startX = event.clientX,
        startY = event.clientY;
      const pointerId = event.pointerId;
      const { transform, zIndex, pointerEvents } = element.style;
      let moved = false;
      dragged = false;
      element.setPointerCapture(pointerId);
      const move = (e: PointerEvent) => {
        if (e.pointerId !== pointerId) return;
        moved ||= Math.hypot(e.clientX - startX, e.clientY - startY) > 10;
        if (moved) {
          element.style.transform = `translate(${e.clientX - startX}px, ${e.clientY - startY}px)`;
          element.style.zIndex = '100';
        }
      };
      const end = (e: PointerEvent) => {
        if (e.pointerId !== pointerId) return;
        element.removeEventListener('pointermove', move);
        element.removeEventListener('pointerup', end);
        element.removeEventListener('pointercancel', end);
        element.removeEventListener('lostpointercapture', end);
        element.style.transform = transform;
        element.style.zIndex = zIndex;
        if (element.hasPointerCapture(pointerId))
          element.releasePointerCapture(pointerId);
        dragged = moved && e.type === 'pointerup';
        if (dragged) {
          element.style.pointerEvents = 'none';
          const target = document
            .elementFromPoint(e.clientX, e.clientY)
            ?.closest('[data-card-drop="true"]');
          element.style.pointerEvents = pointerEvents;
          target?.dispatchEvent(new CustomEvent('card-drop', { detail: id }));
        }
      };
      element.addEventListener('pointermove', move);
      element.addEventListener('pointerup', end);
      element.addEventListener('pointercancel', end);
      element.addEventListener('lostpointercapture', end);
    },
    onClickCapture: (event: import('react').MouseEvent<HTMLButtonElement>) => {
      if (!dragged) return;
      dragged = false;
      event.preventDefault();
      event.stopPropagation();
    },
  };
}
