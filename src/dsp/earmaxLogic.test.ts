import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EQ_BAND_MODE_CONFIGS,
  EQ_BAND_MODE_ORDER,
  applyBtd700ModeTransition,
  applyListeningModePolicy,
  detectExternalAudioRoute,
  formatBandSliderLabel,
  makeModeBands,
  planTwoStageBoost,
  sampleGainsForMode,
} from './earmaxLogic';

test('band modes define exact 3, 4, 5, and 7 band specs with clear labels', () => {
  const counts = EQ_BAND_MODE_ORDER.map((m) => EQ_BAND_MODE_CONFIGS[m].bands.length);
  assert.deepEqual(counts, [3, 4, 5, 7]);

  assert.equal(
    formatBandSliderLabel(EQ_BAND_MODE_CONFIGS.BAND_3.bands[0]),
    'Bass (60 Hz — Sub & Punch)',
  );
  assert.equal(
    formatBandSliderLabel(EQ_BAND_MODE_CONFIGS.BAND_7.bands[5]),
    'Presence (6 kHz — Sibilance / Detail)',
  );
});

test('makeModeBands and sampleGainsForMode clamp and preserve gains across layouts', () => {
  const bands5 = makeModeBands('BAND_5', [4.5, -2.0, 1.0, 2.5, 3.0]);
  assert.equal(bands5.length, 5);
  assert.deepEqual(sampleGainsForMode(bands5, 'BAND_5'), [4.5, -2, 1, 2.5, 3]);

  const sampled3 = sampleGainsForMode(bands5, 'BAND_3');
  assert.equal(sampled3.length, 3);
  assert.ok(sampled3[0] > 0, 'bass gain stays positive when sampled from warm 5-band curve');
});

test('external route detection unlocks Pro EQ for USB-C BTD 700, Bluetooth, and Bose Control Link', () => {
  const usb = detectExternalAudioRoute({
    selectedRoute: 'USB_AUDIO',
    btd700ModeActive: false,
    controlLinkActive: false,
  });
  assert.equal(usb.route, 'USB_AUDIO');
  assert.equal(usb.isExternalOutputActive, true);

  const btd = detectExternalAudioRoute({
    selectedRoute: 'PHONE_SPEAKER',
    btd700ModeActive: true,
    controlLinkActive: false,
  });
  assert.equal(btd.route, 'BTD700_LOSSLESS');
  assert.equal(btd.isExternalOutputActive, true);

  const controlLink = detectExternalAudioRoute({
    selectedRoute: 'PHONE_SPEAKER',
    btd700ModeActive: false,
    controlLinkActive: true,
  });
  assert.equal(controlLink.route, 'BOSE_CONTROL_LINK');
  assert.equal(controlLink.isExternalOutputActive, true);

  const speakerOnly = detectExternalAudioRoute({
    selectedRoute: 'PHONE_SPEAKER',
    btd700ModeActive: false,
    controlLinkActive: false,
  });
  assert.equal(speakerOnly.route, 'PHONE_SPEAKER');
  assert.equal(speakerOnly.isExternalOutputActive, false);
});

test('two-stage volume boost configures 4-band MBC with <55 Hz trim and 10:1 -0.5 dBFS limiter', () => {
  const zero = planTwoStageBoost(0, true);
  assert.equal(zero.mbcBands.length, 4);
  assert.equal(zero.mbcBands[0].cutoffHz, 55);
  assert.equal(zero.subBassPreGainDb, 0);
  assert.equal(zero.limiter.thresholdDb, -0.5);
  assert.equal(zero.limiter.ratio, 10.0);

  const maxBoost = planTwoStageBoost(12, true);
  assert.equal(maxBoost.subBassPreGainDb, -4.5);
  assert.equal(maxBoost.mbcBands[0].attackMs, 5);
  assert.equal(maxBoost.mbcBands[0].releaseMs, 80);
  assert.equal(maxBoost.limiter.enabled, true);
});

test('BTD 700 Mode locks Quiet NC 10 and forces ActiveSense OFF; Quiet mode defaults ActiveSense OFF', () => {
  const initial = {
    btd700ModeActive: false,
    activeSenseEnabled: true,
    currentModeIndex: 1,
    noise: { cancellingLevel: 0, ancEnabled: true, windBlock: false, spatialAudio: 'ROOM' as const },
  };

  const engaged = applyBtd700ModeTransition(initial, true);
  assert.equal(engaged.btd700ModeActive, true);
  assert.equal(engaged.activeSenseEnabled, false);
  assert.equal(engaged.currentModeIndex, 0);
  assert.equal(engaged.noise?.cancellingLevel, 10);
  assert.equal(engaged.noise?.spatialAudio, 'ROOM');

  const released = applyBtd700ModeTransition(engaged, false);
  assert.equal(released.btd700ModeActive, false);

  const switchedToQuiet = applyListeningModePolicy(
    { ...initial, activeSenseEnabled: true },
    0,
    'Quiet',
    { cancellingLevel: 10, ancEnabled: true, windBlock: false, spatialAudio: 'OFF' },
  );
  assert.equal(switchedToQuiet.activeSenseEnabled, false);
});
