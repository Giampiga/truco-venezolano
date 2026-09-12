import assert from 'node:assert/strict';
import test from 'node:test';
import type { DragEvent, MouseEvent, PointerEvent } from 'react';
import { cardDrag } from '../lib/card-drag.ts';

void test('card dragging transfers only the selected card and can be disabled', () => {
  const transfer = {
    effectAllowed: '',
    setData(type: string, value: string) {
      assert.equal(type, 'text/truco-card');
      assert.equal(value, '3-oros');
    },
  };
  cardDrag('3-oros', true).onDragStart({
    dataTransfer: transfer,
  } as DragEvent<HTMLButtonElement>);
  assert.equal(transfer.effectAllowed, 'move');
  let prevented = false;
  const disabled = cardDrag('3-oros', false);
  assert.equal(disabled.draggable, false);
  disabled.onDragStart({
    preventDefault() {
      prevented = true;
    },
  } as DragEvent<HTMLButtonElement>);
  assert.equal(prevented, true);
});

void test('touch drag cleans up, ignores other fingers, and never drops on cancellation', () => {
  let captured = false;
  let previews = 0;
  const preview = {
    style: { transform: '' },
    removeAttribute() {},
    setAttribute() {},
    remove() {
      previews--;
    },
  };
  const card = Object.assign(new EventTarget(), {
    style: { transform: '', zIndex: '', pointerEvents: '' },
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 70, height: 100 }),
    cloneNode: () => preview,
    setPointerCapture() {
      captured = true;
    },
    hasPointerCapture() {
      return captured;
    },
    releasePointerCapture() {
      captured = false;
    },
  });
  const pointer = (type: string, pointerId = 1) =>
    Object.assign(new Event(type), { clientX: 40, clientY: 60, pointerId });
  const down = {
    preventDefault() {},
    pointerType: 'touch',
    isPrimary: true,
    currentTarget: card,
    clientX: 0,
    clientY: 0,
    pointerId: 1,
  } as unknown as PointerEvent<HTMLButtonElement>;
  let drops = 0;
  const pile = Object.assign(new EventTarget(), {
    setAttribute() {},
    removeAttribute() {},
  });
  pile.addEventListener('card-drop', (event) => {
    assert.equal((event as CustomEvent).detail, '3-oros');
    drops++;
  });
  const old = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      body: {
        appendChild() {
          previews++;
        },
      },
      elementFromPoint: () => ({ closest: () => pile }),
    },
  });
  try {
    const handlers = cardDrag('3-oros', true);
    handlers.onPointerDown(down);
    card.dispatchEvent(pointer('pointermove', 2));
    assert.equal(card.style.transform, '');
    card.dispatchEvent(pointer('pointermove'));
    card.dispatchEvent(pointer('pointerup'));
    assert.equal(previews, 0);
    assert.equal(drops, 1);
    assert.equal(card.style.transform, '');
    assert.equal(captured, false);
    card.dispatchEvent(pointer('pointerup'));
    assert.equal(drops, 1);
    const click = new Event('click', { cancelable: true });
    Object.defineProperty(click, 'currentTarget', { value: card });
    // React can render again before the synthesized click arrives.
    cardDrag('3-oros', true).onClickCapture(
      click as unknown as MouseEvent<HTMLButtonElement>,
    );
    assert.equal(click.defaultPrevented, true);

    for (const end of ['pointercancel', 'lostpointercapture']) {
      handlers.onPointerDown(down);
      card.dispatchEvent(pointer('pointermove'));
      card.dispatchEvent(pointer(end));
      assert.equal(drops, 1);
      assert.equal(card.style.transform, '');
      assert.equal(card.style.zIndex, '');
      assert.equal(captured, false);
      assert.equal(previews, 0);
      card.dispatchEvent(pointer('pointerup'));
      assert.equal(drops, 1);
    }
    handlers.onPointerDown(down);
    card.dispatchEvent(pointer('pointerup'));
    const tap = new Event('click', { cancelable: true });
    Object.defineProperty(tap, 'currentTarget', { value: card });
    handlers.onClickCapture(tap as unknown as MouseEvent<HTMLButtonElement>);
    assert.equal(tap.defaultPrevented, false);
  } finally {
    if (old) Object.defineProperty(globalThis, 'document', old);
    else Reflect.deleteProperty(globalThis, 'document');
  }
});
