# reihanwing Project Documentation

1. Project Overview
1.1 Description

ReihanWing is a mobile-first vertical arcade shooter inspired structurally by EverWing.

The player controls a neon geometric ship that automatically fires upward while enemies descend from the top of the screen.

This version is optimized for:

Touch controls

Vertical screen orientation

Mobile performance constraints

DOM-based rendering (no Canvas)

App packaging via Capacitor or PWA

2. Platform & Deployment Strategy
2.1 Target Platforms

Android

iOS (optional)

Web PWA fallback

2.2 Packaging Options

Option A – Capacitor (Recommended)
Option B – Cordova
Option C – Progressive Web App (PWA)

3. Mobile-First Design Principles

Portrait orientation only

One-thumb control design

High-contrast neon visuals

Large touch-friendly UI

60fps target performance

4. Core Gameplay Systems (Mobile Optimized)
4.1 Touch Control System
Control Design

Player movement via:

Touch drag (finger follows movement)
OR

Left/Right swipe zones

Recommended Implementation
gameArea.addEventListener("touchmove", handleTouchMove);
Player Positioning

Constrain within screen bounds

Use transform: translate() for smooth movement

4.2 Game Loop System

Use:

requestAnimationFrame(gameLoop)

Mobile Optimization Rules:

Avoid excessive DOM creation

Use transform instead of top/left

Limit object count

Remove unused elements immediately

Target: Stable 60fps on mid-range devices

4.3 Player System
Properties
{
  x: number,
  y: number,
  width: number,
  height: number,
  health: number,
  fireRate: number,
  isShielded: boolean
}
CSS Representation

Neon triangle

Strong glow for visibility

Slight pulse animation

Must be clearly visible on small screens.

4.4 Bullet System

Auto-fire every X milliseconds

Limited bullet cap (30 max active)

Speed slightly reduced compared to desktop

Optimization:

Reuse bullet elements via pooling

4.5 Enemy System
Spawn Logic

Random X spawn

Descend vertically

Speed increases gradually

Mobile Limits

Max 25 enemies active

Spawn interval controlled by difficulty scaling

4.6 Collision Detection

Use:

element.getBoundingClientRect()

Mobile Consideration:

Increase hitbox slightly for better user experience

Prioritize fairness over pixel-perfect accuracy

4.7 Health & UI System
Health Display

Horizontal health bar

Red gradient

Positioned bottom screen

Score Display

Large readable font

Top of screen

High score stored locally

Storage key:

reihanwing_mobile_highscore
5. UI/UX (Mobile Focused)
5.1 Layout Structure (Portrait)
+----------------------+
| SCORE    HIGH SCORE  |
|----------------------|
|                      |
|                      |
|     GAME AREA        |
|                      |
|                      |
|----------------------|
| HEALTH BAR           |
+----------------------+
5.2 Visual Design
Background

Animated vertical gradient

Subtle moving particles (limited quantity)

Dark base for neon contrast

Neon Color Scheme

Cyan (player)

Red (enemies)

Yellow (power-ups)

Purple (boss)

6. Performance Constraints

Mobile DOM rendering requires strict limits:

Object Type	Max Active
Enemies	25
Bullets	30
Power-ups	5
Optimization Rules

Use will-change: transform

Avoid layout thrashing

Use element pooling

Avoid heavy CSS filters

Avoid large blur shadows

7. Difficulty Scaling System

Difficulty increases based on:

Time survived

Score milestones

Scaling Parameters:

Enemy spawn rate decreases

Enemy speed increases

Enemy health increases

Boss spawns every X score

8. Boss System (Mobile Adapted)

Boss appears at score thresholds.

Boss Features:

Larger hitbox

Multiple hit points

Slight movement pattern

Special attack (enemy burst)

CSS representation:

Large glowing polygon

Slow rotation animation

9. Game States

Game states must be clearly defined:

{
  state: "menu" | "playing" | "paused" | "gameover"
}

State transitions:

Menu → Playing

Playing → Paused

Playing → GameOver

GameOver → Restart

10. Sound System (Optional)

Background music loop

Shooting sound

Hit sound

Explosion sound

Mobile Consideration:

Audio starts only after user interaction

Respect device mute settings

11. Development Roadmap
Phase 1 – Mobile Layout

Portrait lock

Touch controls

Player movement

Phase 2 – Core Mechanics

Shooting

Enemy spawning

Collision system

Phase 3 – UI & Health

Score

Health bar

Game over screen

Phase 4 – Scaling

Difficulty ramp

Boss system

Phase 5 – Optimization

Object pooling

Performance testing

Memory leak testing

Phase 6 – Packaging

Configure Capacitor

Build Android APK

Test on physical device

12. App Packaging Plan
Capacitor Setup Steps

Initialize project

Add Android platform

Configure manifest

Lock orientation to portrait

Build production APK

13. Testing Strategy
Device Testing

Low-end Android

Mid-range Android

Emulator stress testing

Performance Testing

10-minute continuous play

Rapid spawn scenario

Boss fight scenario

14. Completion Criteria

ReihanWing Mobile is complete when:

Stable 60fps gameplay

No input lag

Clean restart flow

No DOM memory leaks

APK installs and runs smoothly

Responsive on multiple screen sizes

15. Future Expansion

Online leaderboard

Skill tree upgrades

Cosmetic themes

Endless survival mode

Multiplayer co-op

Haptic feedback integration
