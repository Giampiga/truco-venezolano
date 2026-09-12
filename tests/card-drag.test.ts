import assert from 'node:assert/strict';
import test from 'node:test';
import { cardDrag } from '../lib/card-drag.ts';
test('card dragging transfers only the selected card and can be disabled', () => {
  assert.equal(cardDrag('3-oros', false).draggable, false);
  const transfer = { effectAllowed: '', setData(type: string, value: string) { assert.equal(type, 'text/truco-card'); assert.equal(value, '3-oros'); } };
  cardDrag('3-oros', true).onDragStart({dataTransfer: transfer} as any);
  assert.equal(transfer.effectAllowed, 'move');
});
test('touch drag drops only on a legal pile and resets visual state', () => {
  const card = Object.assign(new EventTarget(), {style: {transform:'', zIndex:'', pointerEvents:''}, setPointerCapture() {} });
  let drops = 0;
  const pile = new EventTarget();
  pile.addEventListener('card-drop', event => { assert.equal((event as CustomEvent).detail, '3-oros'); drops++; });
  const old = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', {configurable:true, value: {elementFromPoint: () => ({closest: () => pile})}});
  try {
    cardDrag('3-oros', true).onPointerDown({pointerType:'touch', currentTarget:card, clientX:0, clientY:0, pointerId:1} as any);
    card.dispatchEvent(Object.assign(new Event('pointermove'), {clientX:40, clientY:60}));
    card.dispatchEvent(Object.assign(new Event('pointerup'), {clientX:40, clientY:60}));
    assert.equal(drops, 1); assert.equal(card.style.transform, '');
    card.dispatchEvent(Object.assign(new Event('pointerup'), {clientX:40, clientY:60}));
    assert.equal(drops, 1);
  } finally { if (old) Object.defineProperty(globalThis,'document',old); else Reflect.deleteProperty(globalThis,'document'); }
});
