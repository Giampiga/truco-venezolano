
export function cardDrag(id: string, enabled: boolean) {
  return {
    draggable: enabled,
    onDragStart: (event: import('react').DragEvent<HTMLButtonElement>) => {
      event.dataTransfer.setData('text/truco-card', id);
      event.dataTransfer.effectAllowed = 'move';
    },
    onPointerDown: (event: import('react').PointerEvent<HTMLButtonElement>) => {
      if (!enabled || event.pointerType !== 'touch') return;
      const element = event.currentTarget;
      const startX = event.clientX, startY = event.clientY;
      let moved = false;
      element.setPointerCapture(event.pointerId);
      const move = (e: PointerEvent) => {
        moved ||= Math.hypot(e.clientX - startX, e.clientY - startY) > 10;
        if (moved) { element.style.transform = `translate(${e.clientX - startX}px, ${e.clientY - startY}px)`; element.style.zIndex = '100'; }
      };
      const end = (e: PointerEvent) => {
        element.removeEventListener('pointermove', move);
        element.removeEventListener('pointerup', end);
        element.removeEventListener('pointercancel', end);
        element.style.transform = ''; element.style.zIndex = '';
        if (moved && e.type === 'pointerup') {
          element.style.pointerEvents = 'none';
          const target = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-card-drop="true"]');
          element.style.pointerEvents = '';
          target?.dispatchEvent(new CustomEvent('card-drop', { detail: id }));
        }
      };
      element.addEventListener('pointermove', move);
      element.addEventListener('pointerup', end);
      element.addEventListener('pointercancel', end);
    },
  };
}
