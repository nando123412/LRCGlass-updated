import test from 'node:test';
import assert from 'node:assert/strict';
import { blurFor, scrollProgress, shadeFor, videoOpacityFor } from './backdrop-math.ts';

test('scrollProgress computes normalized progression', () => {
  assert.equal(scrollProgress(0, 400), 0);
  assert.equal(scrollProgress(200, 400), 0.5);
  assert.equal(scrollProgress(400, 400), 1);
  assert.equal(scrollProgress(600, 400), 1); // clamped to 1
  assert.equal(scrollProgress(-50, 400), 0); // clamped to 0
});

test('blurFor starts at 0 and reaches maxBlur smoothly', () => {
  assert.equal(blurFor(0, 28), 0);
  assert.equal(blurFor(1, 28), 28);
  assert.ok(blurFor(0.5, 28) > 0 && blurFor(0.5, 28) < 28);
});

test('shadeFor transitions from minShade to maxShade', () => {
  assert.equal(shadeFor(0, 0.2, 0.88), 0.2);
  assert.equal(shadeFor(1, 0.2, 0.88), 0.88);
  assert.ok(shadeFor(0.5, 0.2, 0.88) > 0.2);
});

test('videoOpacityFor gracefully fades from maxOpacity to minOpacity', () => {
  assert.equal(videoOpacityFor(0, 0.15, 1.0), 1.0);
  assert.equal(videoOpacityFor(1, 0.15, 1.0), 0.15);
  assert.ok(videoOpacityFor(0.5, 0.15, 1.0) < 1.0);
});
