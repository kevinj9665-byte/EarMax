# Earshot (Web)

**One companion app for your Bluetooth headset, whatever the brand.** Local-first React + Web Audio DSP rewrite of the Earshot Android application.

## Features

- **Home & Listening Modes:** Radial segmented battery dial (overall or Left / Right / Case breakdown), playback & volume controls, mode carousel with favourites & custom mode editor, live noise cancelling slider, Wind Block, Spatial Audio (`Off / Still / Motion`), Skullcandy Crusher haptic bass, and vendor controls for 19 virtual demo headsets across Bose, Soundcore, Sennheiser, Sony, Skullcandy, JBL, and Apple.
- **Sound (Pro EQ):** Real-time Web Audio API RBJ biquad filter engine (`Peak`, `Low Shelf`, `High Shelf`) with preamp headroom, output limiter, +12 dB volume boost, live logarithmic frequency curve, 10-band Graphic EQ, Parametric band editor, AutoEq `ParametricEQ.txt` import/export, and live audition player.
- **Sleep:** 15 min to 6 h sleep timer with fade-out, scheduled noise-cancelling shutoff, 3-layer procedural Web Audio soundscape mixer (`Rain`, `Heavy Rain`, `Ocean`, `Campfire`, `Stream`, `Wind`, `Brown/Pink/White Noise`, `Box Fan`, plus custom audio loop import), ear-routing (`Both / Mono / Left / Right`), and wake-up alarms with synthesized tones and 60-second fallback escalation.
- **Tools:** Programmable button remapper & press detector, Connection & Latency + Multipoint + LE Audio switcher, Codec inspector, Call Audio boost & Sidetone, browser `MediaRecorder` Mic Check, Find My Headphones beacon tone, and read-only Lab protocol explorer + Connection Timeline.
- **More:** Universal device remote, Automation rule builder, Field & Aurora appearances (light/dark/system), portable JSON Backup & Restore, and privacy-first About details.

## Running locally

```bash
npm install
npm run dev
```

## Notes & Limitations

- Browsers cannot open native Android Bluetooth Classic RFCOMM / BMAP sockets or Shizuku privileged IPC, so headset telemetry and vendor protocols run against Earshot's 19 built-in virtual headset profiles (Demo Mode).
- All audio processing (Pro EQ, sleep soundscapes, alarm tones, find beacon, and mic check) runs live in the browser via the Web Audio API and `MediaRecorder`.
