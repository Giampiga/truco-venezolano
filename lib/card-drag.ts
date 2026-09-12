// Keep click suppression across React renders during a touch gesture.
const draggedCards = new WeakSet<HTMLButtonElement>();

export function cardDrag(id: string, enabled: boolean) {
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
      const element = event.currentTarget;
      draggedCards.delete(element);
      if (
        !enabled ||
        !['touch', 'pen'].includes(event.pointerType) ||
        !event.isPrimary
      )
        return;
      event.preventDefault();
      const startX = event.clientX,
        startY = event.clientY;
      const pointerId = event.pointerId;
      const bounds = element.getBoundingClientRect();
      let preview: HTMLElement | null = null;
      let target: Element | null = null;
      element.setPointerCapture(pointerId);
      const move = (e: PointerEvent) => {
        if (e.pointerId !== pointerId) return;
        if (
          !preview &&
          Math.hypot(e.clientX - startX, e.clientY - startY) <= 10
        )
          return;
        if (!preview) {
          // A viewport overlay avoids clipping and stacking contexts in either table layout.
          preview = element.cloneNode(true) as HTMLElement;
          preview.removeAttribute('id');
          preview.removeAttribute('draggable');
          preview.setAttribute('aria-hidden', 'true');
          preview.setAttribute('inert', '');
          Object.assign(preview.style, {
            position: 'fixed',
            left: `${bounds.left}px`,
            top: `${bounds.top}px`,
            width: `${bounds.width}px`,
            height: `${bounds.height}px`,
            margin: '0',
            zIndex: '10000',
            pointerEvents: 'none',
            transition: 'none',
          });
          document.body.appendChild(preview);
        }
        preview.style.transform = `translate(${e.clientX - startX}px, ${e.clientY - startY}px)`;
        target?.removeAttribute('data-card-drop-active');
        target =
          document
            .elementFromPoint(e.clientX, e.clientY)
            ?.closest('[data-card-drop="true"]') ?? null;
        target?.setAttribute('data-card-drop-active', '');
      };
      const end = (e: PointerEvent) => {
        if (e.pointerId !== pointerId) return;
        element.removeEventListener('pointermove', move);
        element.removeEventListener('pointerup', end);
        element.removeEventListener('pointercancel', end);
        element.removeEventListener('lostpointercapture', end);
        const moved = !!preview;
        preview?.remove();
        target?.removeAttribute('data-card-drop-active');
        if (element.hasPointerCapture(pointerId))
          element.releasePointerCapture(pointerId);
        if (!moved) return;
        draggedCards.add(element);
        if (e.type === 'pointerup') {
          document
            .elementFromPoint(e.clientX, e.clientY)
            ?.closest('[data-card-drop="true"]')
            ?.dispatchEvent(new CustomEvent('card-drop', { detail: id }));
        }
      };
      element.addEventListener('pointermove', move);
      element.addEventListener('pointerup', end);
      element.addEventListener('pointercancel', end);
      element.addEventListener('lostpointercapture', end);
    },
    onClickCapture: (event: import('react').MouseEvent<HTMLButtonElement>) => {
      if (!draggedCards.has(event.currentTarget)) return;
      draggedCards.delete(event.currentTarget);
      event.preventDefault();
      event.stopPropagation();
    },
  };
}
