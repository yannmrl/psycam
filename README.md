# PsyCam

PsyCam is a real-time psychedelic visualizer that transforms a webcam feed or desktop capture into music-reactive visual effects. Designed for live performances, parties, VJing, and experimentation, all visual parameters can be controlled wirelessly from a smartphone.

## Features

- Music-reactive visual effects
- Live webcam input
- Desktop/screen capture support
- Smartphone remote control
- Real-time psychedelic rendering
- No installation required, runs directly in the browser

## How It Works

PsyCam uses a shared **token** to connect the display running on a computer with the control interface running on a smartphone.

### 1. Choose a Token

Select any unique token (for example: `xyz123`).

This token will be used to pair the display and the controller.

---

### 2. Open the Visualizer on the Computer

To use the webcam as the video source:

```
https://krorion.wysigot.com/psycam/display?token=YOUR_TOKEN
```

Example:

```
https://krorion.wysigot.com/psycam/display?token=xyz123
```

By default, PsyCam displays the webcam feed with the selected visual effects applied.

---

### 3. Use Screen Capture Instead

To apply effects to the computer screen rather than the webcam, open:

```
https://krorion.wysigot.com/psycam/display?screen&token=YOUR_TOKEN
```

Example:

```
https://krorion.wysigot.com/psycam/display?screen&token=xyz123
```

Your browser will ask which screen or window should be shared.

---

### 4. Connect the Smartphone Controller

Open the control interface on your phone:

```
https://krorion.wysigot.com/controls
```

Enter the same token used on the computer.

Example:

```
xyz123
```

Once connected, the phone becomes a wireless remote control for the visual effects.

---

## Typical Setup

```text
┌─────────────┐
│ Smartphone  │
│ Controls UI │
└──────┬──────┘
       │ Token
       ▼
┌─────────────┐
│   PsyCam    │
│  Display    │
│  Computer   │
└──────┬──────┘
       │
       ▼
 Webcam or Screen Capture
```

---

## Use Cases

- Live music performances
- VJ setups
- DJ sets
- Interactive art installations
- Creative coding experiments
- Party visuals

## Requirements

- A modern web browser
- A smartphone for remote control
- Optional microphone, webcam, or screen-sharing capability