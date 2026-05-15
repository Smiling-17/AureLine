import type { LocaleMessages } from "@/locales/schema";

export const enWearable: LocaleMessages["wearable"] = {
  companion: {
    eyebrow: "ActiveComfort Hybrid Pro",
    title: "Wearable Coach",
    description: "Physical haptic guidance delivered through 4 precision zones on the harness.",
    viewCta: "View device",
    postureStateLabel: "Device state",
    activeZonesLabel: "Active zones",
    noActiveZonesLabel: "All clear",
    disconnectedLabel: "Not connected",
    disconnectedDescription:
      "The wearable is not connected yet. Camera posture tracking still runs; haptic feedback becomes available after pairing the device.",
    disconnectedZonesLabel: "Device not connected",
    correctionLabel: "Good correction",
    correctionDescription: "The harness flashes green to mirror the moment your body returns to a healthier position.",
    tensionLabel: "Assist active",
    tensionDescription: "Adaptive support zones glow amber when prolonged load needs gentle mechanical guidance.",
    loadLabel: "posture load",
    noLoadLabel: "Waiting for live load",
    disconnectedLoadLabel: "No device data",
  },
  page: {
    badge: "ActiveComfort Hybrid Pro",
    title: "Meet your",
    titleHighlight: "posture harness",
    description:
      "The only wearable that combines real-time AI coaching with intelligent haptic feedback — so your body learns correct posture instinctively.",
    ctaDashboard: "Open dashboard",
    rotateTip: "Drag to rotate · Scroll to zoom",
    zoneSelectLabel: "Explore zones",
  },
  zones: {
    centerBack: {
      name: "Core Module",
      badge: "Upper Back",
      description:
        "The central haptic engine. Delivers precise vibration feedback for forward-head and torso lean corrections.",
      detail:
        "Houses the main processor, 6-axis IMU sensor, and primary haptic actuators. Activates for forward-head posture and torso lean issues.",
    },
    leftShoulder: {
      name: "Left Shoulder",
      badge: "Shoulder Zone",
      description: "Detects and corrects asymmetric shoulder elevation and lateral roll.",
      detail:
        "Secondary haptic zone. Activates when shoulder tilt is detected. Works with the right shoulder for bilateral correction.",
    },
    rightShoulder: {
      name: "Right Shoulder",
      badge: "Shoulder Zone",
      description: "Mirror of the left shoulder zone — completes bilateral posture symmetry.",
      detail:
        "Secondary haptic zone. Mirrors the left shoulder zone. Together both provide real-time symmetry correction feedback.",
    },
    frontChest: {
      name: "Front Strap",
      badge: "Stabilization",
      description:
        "The front stabilization strap that anchors the harness and supports chest-forward posture.",
      detail:
        "Provides mechanical tension assistance. Activates for forward-head posture to remind the body to maintain chest engagement.",
    },
  },
  productZones: {
    shoulderStraps: {
      name: "Shoulder Straps",
      badge: "Motion symmetry",
      description:
        "Dual shoulder straps track asymmetric drift and deliver side-specific haptic feedback.",
      detail:
        "Each strap is mapped to a shoulder haptic channel. When one shoulder rises or rolls, the matching side pulses instead of lighting the whole harness.",
      activatesFor: "Left or right shoulder tilt",
    },
    coreModule: {
      name: "Upper Back Core Module",
      badge: "IMU + BLE + haptics",
      description:
        "The central module houses motion sensing, wireless sync, haptic drive, and battery logic.",
      detail:
        "This zone is the primary feedback point for forward-head drift and torso lean, so the user feels guidance exactly between the shoulder blades.",
      activatesFor: "Forward head, torso lean, correction success",
    },
    frontStabilization: {
      name: "Front Stabilization Strap",
      badge: "Balance anchor",
      description:
        "The front strap stabilizes the harness so haptic feedback lands consistently during desk work.",
      detail:
        "It supports chest-forward alignment mechanically, but forward-head haptics remain centered on the upper-back module.",
      activatesFor: "Chest engagement and harness balance",
    },
    adaptiveSupport: {
      name: "Adaptive Support Zones",
      badge: "Semi-active assist",
      description:
        "Semi-active tension zones visualize the gentle assist that would guide the user back after prolonged slouching.",
      detail:
        "When static hold, high exposure, or torso lean persists, these zones pulse amber to show tension assistance rather than simple vibration.",
      activatesFor: "Static hold, torso lean, high exposure",
    },
  },
  features: {
    eyebrow: "Device features",
    title: "How the harness works",
    description: "Three integrated layers build lasting posture habits — haptic, mechanical, and behavioral.",
    items: [
      {
        badge: "Layer 1",
        title: "Awareness",
        description:
          "Gentle haptic pulses in the exact zone that needs adjustment — instant body-level feedback with no screen required.",
      },
      {
        badge: "Layer 2",
        title: "Mechanical Guidance",
        description:
          "Intelligent tension assistance physically guides your body toward correct alignment as you sit and work.",
      },
      {
        badge: "Layer 3",
        title: "Behavior Reinforcement",
        description:
          "AI coaching syncs with your session data to reinforce good posture patterns over time.",
      },
      {
        badge: "Precision",
        title: "4 Haptic Zones",
        description:
          "Core module, dual shoulder zones, and front strap — complete upper-body coverage for every posture issue.",
      },
    ],
  },
  landing: {
    eyebrow: "Physical wearable",
    badge: "ActiveComfort Hybrid Pro",
    title: "Posture coaching that",
    titleHighlight: "you can feel",
    description:
      "The AI sees. The harness responds. Four precisely-placed haptic zones deliver real-time correction exactly where your body needs it — no screen, no distraction.",
    cta: "Explore the device",
    secondaryCta: "Start coaching",
    keyPoints: [
      {
        title: "4 Haptic Zones",
        description: "Targeted vibration feedback for upper back, shoulders, and chest.",
      },
      {
        title: "AI Sync",
        description: "Live posture data drives zone activation in real time.",
      },
      {
        title: "Adaptive Tension",
        description: "Mechanical guidance assists body alignment automatically.",
      },
    ],
  },
  story: {
    eyebrow: "Simulated reality",
    steps: [
      {
        title: "The wearable appears",
        description: "A browser-native 3D product model lets visitors inspect the harness before a physical prototype exists.",
        metric: "3D product",
      },
      {
        title: "Senses your every move",
        description: "The core module becomes the sensing hub: IMU, Bluetooth sync, haptic driver, and battery logic in one upper-back unit.",
        metric: "Core module",
      },
      {
        title: "Knows exactly where you drift",
        description: "Haptic points light up on the shoulder and upper-back zones that match the posture issue detected by the AI coach.",
        metric: "4 haptic zones",
      },
      {
        title: "Gently guides you back",
        description: "Adaptive support zones pulse amber to show semi-active tension assistance during prolonged load or static slouching.",
        metric: "Assist active",
      },
      {
        title: "Tracks your improvement",
        description: "The dashboard score rises as posture recovers, closing the loop between camera intelligence and wearable feedback.",
        metric: "Score 92",
      },
    ],
  },
};
