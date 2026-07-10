import { countScripts, createScript } from './repositories/scripts';

/**
 * DEV-only demo seed: inserts sample scripts when the library is empty so the
 * simulator/dev build isn't blank. Excluded from release builds via __DEV__,
 * so real installs start on the guided empty-state.
 */
export async function seedIfEmpty(): Promise<void> {
  if (!__DEV__) return;
  if ((await countScripts()) > 0) return;

  await createScript({
    title: 'Weekly update — episode 14',
    body: 'Big week. Three things I promised you last time, and where each one landed. [pause] Let us get into it.',
  });
  await createScript({
    title: 'Skincare routine · morning',
    body: "First thing, always — a splash of cold water. No cleanser yet. [pause] Here's why that matters for your skin barrier.",
  });
  await createScript({
    title: 'Product launch — take 2',
    body:
      "Hey everyone — today I want to show you the thing we've been building for the last six months. [look left]\n\n" +
      'Six months ago we had a whiteboard and one stubborn idea. [pause] Here is what it looks like now.\n\n' +
      "Three things make it different, and I'll go through each one so stick with me.",
  });
}
