# AI Posture Coach - User Diagram And User Flow

> Generated from source review of `D:\Code\AI_Posture_Coach`.

## 1. Purpose

Tài liệu này mô tả cách người dùng đi qua sản phẩm AI Posture Coach từ lúc mở app, bật camera, calibration, theo dõi tư thế, nhận feedback, nghỉ giải lao, tập recovery, xem report, thay đổi settings và quit app. Nội dung bám theo source code hiện tại, không phải spec lý thuyết riêng.

## 2. Primary User

| User group | Context | Need |
| --- | --- | --- |
| Sinh viên | Học/lập trình nhiều giờ trên laptop | Được nhắc tư thế sai mà không phải tự quan sát liên tục |
| Lập trình viên | Làm việc 6-10 tiếng/ngày, hay forward head/rounded shoulders | Feedback nhẹ, score, report và break/recovery cue |
| Nhân viên văn phòng | Ngồi máy tính lâu, cần wellness loop riêng tư | Local-first posture tracking và guided reset |

## 3. User-Facing Product Map

```mermaid
flowchart TD
  Landing["Landing page /"] --> Dashboard["Dashboard /dashboard"]
  Dashboard --> Settings["Settings /settings"]
  Dashboard --> Report["Report /report"]
  Dashboard --> Recovery["Recovery /recovery"]
  Settings --> Dashboard
  Report --> Recovery
  Recovery --> Dashboard
  Dashboard --> Overlay["Level 4 Desktop Overlay /overlay"]
  Overlay --> Dashboard
  Overlay --> Snooze["Snooze 60s"]
  Dashboard --> Tray["System Tray"]
  Tray --> Dashboard
  Tray --> Quit["Quit with persistence flush"]
```

## 4. Use Case Diagram

```mermaid
flowchart LR
  User["User"]
  OS["OS Camera / Windows Shell"]
  App["AI Posture Coach"]

  User --> UC1["Start monitoring"]
  User --> UC2["Choose camera"]
  User --> UC3["Choose relaxed/strict landmark mode"]
  User --> UC4["Hold neutral posture for calibration"]
  User --> UC5["Receive posture cue"]
  User --> UC6["Correct posture"]
  User --> UC7["Pause/resume monitoring"]
  User --> UC8["Snooze or open Level 4 overlay"]
  User --> UC9["View daily report"]
  User --> UC10["Start recovery flow"]
  User --> UC11["Change privacy/reminder settings"]
  User --> UC12["Quit from tray"]

  UC1 --> App
  UC2 --> App
  UC3 --> App
  UC4 --> App
  UC5 --> App
  UC6 --> App
  UC7 --> App
  UC8 --> App
  UC9 --> App
  UC10 --> App
  UC11 --> App
  UC12 --> App

  App --> OS
  OS --> UC1
  OS --> UC8
  OS --> UC12
```

## 5. Main User Journey

| Step | User action | System response | Data effect |
| --- | --- | --- | --- |
| 1 | Mở app desktop | Electron mở main window tại `/dashboard` | Load preferences từ localStorage và runtime snapshot từ IndexedDB |
| 2 | Bấm `Start monitoring` | Runtime init worker, request camera permission, start hidden video stream | Append `session-start` event |
| 3 | Chờ calibration | UI hiện calibration progress, camera label, valid/processed frames, tracking lost reason nếu có | Calibration accumulator thu validMs và metrics arrays |
| 4 | Calibration đủ điều kiện | Runtime tạo baseline median và thresholds | Monitoring status sang `tracking` |
| 5 | Làm việc bình thường | App chạy frame loop 15 FPS target, worker process pose | Update live metrics, posture state, session duration |
| 6 | Tư thế lệch nhẹ | Dashboard chuyển state warning/bad và cue text | Append `state-change` nếu state đổi |
| 7 | Cùng issue kéo dài 10s | Level 2 feedback | Append `feedback`, tăng intervention count |
| 8 | Cùng issue kéo dài 20s | Level 3 feedback | Update Level 3 rolling window, break suppression clock |
| 9 | Bad posture 35s hoặc 3 Level 3 trong 10 phút | Level 4 overlay desktop | Show overlay, tăng overlay count |
| 10 | Sửa lại posture và giữ good 5s | Positive reward nếu có pending intervention và micro celebration on | Append `correction-success`, tăng correction count |
| 11 | Tracked time đạt reminder threshold | Break reminder nếu enabled và gần đây không có Level 3/4 | Append `break-reminder` |
| 12 | Khoảng cách camera lệch 5s | Distance advisory too-close/too-far | Append `distance-warning`, không trừ score |
| 13 | Bấm Stop hoặc Quit | Runtime finalize session, persist records, cleanup | Rebuild daily summary, achievements, snapshot |
| 14 | Vào Report | UI lấy summary ngày hiện tại hoặc ngày gần nhất tracked >=5m | Hiện score, best/worst hour, issue, recovery minutes |
| 15 | Vào Recovery | UI recommend bài tập theo current/dominant issue hoặc distance/break | Completion persist recovery activity metadata |

## 6. Monitoring Flow Diagram

```mermaid
flowchart TD
  A["User clicks Start monitoring"] --> B["Runtime status: initializing"]
  B --> C["Initialize Pose Worker"]
  C --> D{"Worker READY?"}
  D -- No --> E["Status: error, show runtimeError"]
  D -- Yes --> F["Request webcam permission"]
  F --> G{"Camera granted?"}
  G -- No --> E
  G -- Yes --> H["Create session accumulator"]
  H --> I["Append session-start event"]
  I --> J["Worker UPDATE_CONFIG + START"]
  J --> K["Status: calibrating"]
  K --> L{"Enough valid frames?"}
  L -- "15s elapsed and >=8s valid" --> M["Build baseline median + thresholds"]
  L -- ">20s elapsed and <8s valid" --> N["Status: calibration-retry"]
  N --> O{"Stable valid frames return?"}
  O -- Yes --> K
  O -- No --> N
  M --> P["Status: tracking"]
  P --> Q["Classify posture every valid frame"]
  Q --> R["Update score, summary, feedback, distance, samples"]
```

## 7. Calibration User Flow

| UI status | What user sees | Likely user action |
| --- | --- | --- |
| `requesting-permission` | Browser/Electron asks camera permission | Grant camera access |
| `calibrating` | Calibration percent, camera label, valid frame count | Sit neutrally and keep face/shoulders visible |
| `calibration-retry` in relaxed mode | Message about needing face/shoulders stable | Recenter body, adjust lighting/camera |
| `calibration-retry` in strict mode | Message saying strict mode needs face, shoulders, hips | Move back so camera sees upper body and hips |
| `tracking` | Live posture card, skeleton overlay, score starts after next valid frame | Work normally |
| `error` | Runtime error message in monitor panel | Check camera permission/device or choose another camera |

## 8. Feedback Ladder User Flow

```mermaid
sequenceDiagram
  actor User
  participant Runtime
  participant Dashboard
  participant Audio as Sound/Voice
  participant Overlay as Desktop Overlay

  Runtime->>Runtime: Detect warning/bad issue
  Runtime->>Dashboard: Level 1 visual state appears immediately
  Runtime->>Runtime: Same issue sustained 10s
  Runtime->>Dashboard: Level 2 cue
  Runtime->>Audio: Optional sound or voice
  Runtime->>Runtime: Same issue sustained 20s
  Runtime->>Dashboard: Level 3 cue
  Runtime->>Audio: Optional sound or voice
  Runtime->>Runtime: Bad sustained 35s or 3 Level 3 cues in 10m
  Runtime->>Overlay: Level 4 desktop overlay
  User->>Overlay: Snooze or Open Dashboard
  Runtime->>Runtime: User returns good posture and holds 5s
  Runtime->>Dashboard: Positive reward
```

## 9. User State Machine

```mermaid
stateDiagram-v2
  [*] --> AppClosed
  AppClosed --> DashboardIdle: open app
  DashboardIdle --> Permission: Start monitoring
  Permission --> Error: permission denied / camera unavailable
  Permission --> Calibration: camera granted
  Calibration --> CalibrationRetry: not enough landmarks after 20s
  CalibrationRetry --> Calibration: landmarks stable again
  Calibration --> Tracking: baseline ready
  Tracking --> Analyzing: tracking lost > 1.5s
  Analyzing --> Tracking: valid pose returns
  Tracking --> Paused: Pause
  Calibration --> Paused: Pause
  CalibrationRetry --> Paused: Pause
  Paused --> Tracking: Resume previous tracking state
  Paused --> Calibration: Resume previous calibration state
  Tracking --> OverlayActive: Level 4 feedback
  OverlayActive --> Tracking: Open Dashboard / Snooze / posture good 5s
  Tracking --> Report: user opens report
  Tracking --> Recovery: user opens recovery
  Tracking --> DashboardIdle: Stop monitoring
  Tracking --> AppClosed: Quit from tray after flush
  Error --> DashboardIdle: retry after user action
```

## 10. Dashboard Screen Diagram

```mermaid
flowchart TD
  Dashboard["Dashboard Page"] --> Header["Hero controls: Start/Pause/Resume/Stop/Settings"]
  Dashboard --> LiveMonitor["LiveMonitorPanel"]
  Dashboard --> Coach["CoachStatusPanel"]
  Dashboard --> Summary["SummaryGrid"]
  Dashboard --> History["FeedbackHistoryPanel"]
  Dashboard --> Health["HealthInsightsPanel"]
  Dashboard --> Analytics["AnalyticsSection"]
  Dashboard --> Rewards["RewardsSection"]

  LiveMonitor --> Video["Video stream + skeleton overlay"]
  LiveMonitor --> CalibrationUI["Calibration/progress/tracking lost diagnostics"]
  LiveMonitor --> Metrics["Live metric text: head/torso/shoulder"]

  Coach --> Score["Live/session score"]
  Coach --> Cue["Current cue detail"]
  Coach --> Cooldown["Next cue cooldown"]
  Coach --> BreakCard["Break reminder card"]
  Coach --> RewardCard["Reward/achievement card"]

  Health --> RecoverySuggestion["Issue/distance-based recovery CTA"]
  Analytics --> Charts["Weekly trend, issue ratio, hourly timeline"]
  Rewards --> Identity["Dynamic identity card"]
```

## 11. Settings User Flow

| Setting | User action | Runtime effect |
| --- | --- | --- |
| Sensitivity | Move slider 20..100 | Rebuild thresholds if baseline exists |
| Feedback mode | Choose gentle/sound/voice | Changes cue output channel |
| Reminder preset | Choose 45/50/60 minutes | Updates next reminder tracked threshold |
| Micro celebrations | Toggle on/off | Controls positive reward cue visibility |
| Theme | Choose midnight/pearl/system | Updates document theme |
| Camera | Select device or default | Next camera request uses selected `deviceId.exact`, fallback if missing |
| Landmark mode | Choose relaxed/strict | Worker config updates; active session recalibrates |
| Local processing | Toggle | If off, live inference continues but session persistence is skipped |
| Reminders enabled | Toggle | Enables/disables break reminder trigger |

## 12. Recovery User Flow

```mermaid
flowchart TD
  A["User opens /recovery"] --> B["Runtime computes recommendation"]
  B --> C{"Reason"}
  C -- "too-close distance" --> D["Recommend neck flow"]
  C -- "dominant/current issue" --> E["Map issue to body area"]
  C -- "break cue" --> F["Recommend desk-reset"]
  C -- "default" --> G["Recommend desk-reset"]
  D --> H["Open RecoveryFlow"]
  E --> H
  F --> H
  G --> H
  H --> I["Step timer"]
  I --> J["Pause / Resume / Previous / Next"]
  J --> K{"Complete final step?"}
  K -- No --> I
  K -- Yes --> L["Persist RecoveryActivityRecord"]
  L --> M["Report recovery minutes updates"]
```

## 13. Report User Flow

```mermaid
flowchart TD
  A["User opens /report"] --> B["Filter summaries tracked >= 5m"]
  B --> C{"Has report summary?"}
  C -- No --> D["NoDataState: go to Dashboard or Recovery"]
  C -- Yes --> E["Use today if today >=5m else latest qualifying day"]
  E --> F["Find previous calendar day summary"]
  F --> G["ReportHeroInsight"]
  F --> H["ReportOverview"]
  F --> I["ReportInsights"]
  G --> J["Score, delta, best window, recovery minutes"]
  H --> K["Posture ratio and sitting breakdown"]
  I --> L["Strongest window, yesterday comparison, recovery CTA"]
```

## 14. Tray And Quit User Flow

```mermaid
sequenceDiagram
  actor User
  participant Tray
  participant Main as Electron Main
  participant Runtime as Renderer Runtime
  participant Store as IndexedDB

  User->>Tray: Click Quit
  Tray->>Main: requestQuit()
  Main->>Runtime: tray action {type: "quit"}
  Runtime->>Runtime: stopMonitoring()
  Runtime->>Store: persist session, samples, events
  Runtime->>Store: cleanupRuntimeData()
  Runtime->>Main: notifyQuitReady()
  Main->>Main: destroy overlay/main windows
  Main->>Main: app.quit()
```

If renderer does not acknowledge, main process uses a bounded fallback timeout of 10 seconds.

## 15. User Error And Edge-Case Matrix

| Scenario | What user sees | System behavior |
| --- | --- | --- |
| Camera permission denied | Runtime error / camera off message | Status becomes `error` |
| Selected camera missing | App still starts with fallback camera | Clears selected camera preference |
| Virtual camera selected by OS | User can open Settings and choose real webcam | `cameraDeviceId` saved to preferences |
| Face/shoulders not visible | Calibration/analyzing reason says landmarks missing | No scoring until valid frames |
| Hips not visible in relaxed mode | UI notes torso metric paused | Score normalizes active metric weights |
| Hips not visible in strict mode | Calibration retry asks user to move back | Strict requires torso landmarks |
| App window minimized during monitoring | Window hides to tray | Monitoring continues |
| Pause during monitoring | Status paused | Worker stopped, late frames ignored, no score gap counted |
| Resume after long pause | Returns to previous state | Timestamps reset to avoid time jump |
| Worker crash | Runtime error | Session finalizes and stream/overlay release |
| Sitting too close/far | Distance advisory cue | Does not reduce posture score |
| User returns to good posture | Positive reward after 5s if eligible | Correction success event persisted |
| User crosses midnight while monitoring | Logical session rolls over | New dayKey starts for samples/events/summary |

## 16. Product Interaction Rules

| Rule | User-facing effect |
| --- | --- |
| Calibration first | User cannot get a score until baseline is created |
| Gentle by default | Feedback starts visually and avoids heavy interruption unless issue persists |
| Local-first by default | User data stays in browser/Electron local storage |
| No video save | User can trust that camera stream is only runtime input |
| Relaxed mode default | Laptop webcam users can still score without visible hips |
| Strict mode optional | User can demand fuller torso metric when camera framing supports it |
| Break reminders use tracked time | Long pause, sleep, or tracking lost gap does not trigger fake reminders |
| Recovery is deterministic/local | Recommendations come from issue/distance/history rules, not cloud AI |

## 17. Screen-Level User Entry Points

| Entry point | Main CTA | Secondary actions |
| --- | --- | --- |
| Landing `/` | Go to dashboard/demo | Learn privacy/features |
| Dashboard `/dashboard` | Start monitoring | Pause, resume, stop, settings, recovery suggestions |
| Settings `/settings` | Tune runtime behavior | Camera refresh, landmark mode, privacy/reminders |
| Report `/report` | Review latest qualifying day | Open recovery recommendation |
| Recovery `/recovery` | Start recommended reset | Filter by body area, open shoulder flow, complete guided flow |
| Overlay `/overlay` | Open Dashboard | Snooze 60s |

## 18. User Data Objects

| Object | Created by user/system action | Used by |
| --- | --- | --- |
| Runtime preferences | Settings changes | Runtime thresholds, feedback, reminders, camera, privacy |
| SessionRecord | Stop, worker error, day rollover | Daily summary, score, report, retention |
| PoseSampleRecord | 1Hz valid tracked frame | Hourly trend, report, analytics |
| PostureEventRecord | Session/cue/break/distance/reward/snooze | Feedback history, audit trail |
| DailySummary | Rebuilt after session persistence | Dashboard, report, streak, achievements, identity |
| RuntimeAchievement | Computed from summaries | Rewards section |
| RecoveryActivityRecord | Recovery flow completion | Report recovery minutes, recommendation rotation |

## 19. Recommended Demo Script

| Step | Demo action | Expected result |
| --- | --- | --- |
| 1 | Run Electron app and open dashboard | App opens `/dashboard` |
| 2 | Click Start monitoring | Camera permission requested, calibration UI appears |
| 3 | Keep face/shoulders visible for 15s | Status becomes tracking, score starts after valid tracked frame |
| 4 | Lean head forward for 10s | Level 2 cue appears |
| 5 | Continue issue to 20s | Level 3 cue appears |
| 6 | Force bad posture long enough | Level 4 overlay appears |
| 7 | Click Snooze 60s | Overlay hides and snooze event is recorded |
| 8 | Return to good posture for 5s | Reward cue appears if micro celebrations enabled |
| 9 | Move too close to screen for 5s | Distance advisory appears, score remains high if posture good |
| 10 | Open Recovery from dashboard | Recommended flow is selected by current/dominant issue |
| 11 | Complete flow | Recovery minutes appear in report for that day |
| 12 | Stop monitoring | Session persists, report has loaded data if tracked >=5m |
