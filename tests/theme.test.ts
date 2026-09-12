import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { THEME_SCRIPT } from '../lib/theme.ts';

void test('theme uses the system until an explicit choice and syncs preference changes', () => {
  let stored: string | null = null;
  let blocked = false;
  let dark = false;
  let onMedia = () => {};
  let onStorage = (_event: { key: string | null }) => {};
  const media = {
    matches: true,
    addEventListener: (_name: string, callback: () => void) => {
      onMedia = callback;
    },
  };
  runInNewContext(THEME_SCRIPT, {
    matchMedia: () => media,
    localStorage: {
      getItem: () => {
        if (blocked) throw new Error('Storage disabled');
        return stored;
      },
    },
    document: {
      documentElement: {
        classList: {
          toggle: (_class: string, value: boolean) => {
            dark = value;
          },
        },
      },
    },
    window: {
      addEventListener: (
        _name: string,
        callback: (event: { key: string | null }) => void,
      ) => {
        onStorage = callback;
      },
    },
  });

  assert.equal(dark, true);
  media.matches = false;
  onMedia();
  assert.equal(dark, false);
  stored = 'dark';
  onStorage({ key: 'truco-theme' });
  assert.equal(dark, true);
  onMedia();
  assert.equal(dark, true);
  stored = 'light';
  media.matches = true;
  onStorage({ key: 'truco-theme' });
  assert.equal(dark, false);
  stored = null;
  onStorage({ key: null });
  assert.equal(dark, true);
  stored = 'invalid';
  media.matches = false;
  onMedia();
  assert.equal(dark, false);
  stored = 'light';
  blocked = true;
  media.matches = true;
  onMedia();
  assert.equal(dark, true);
});
