# FretMaster Mobile App — Complete Visual Design Specification

Use this document to replicate the exact visual design of the FretMaster web app in a React Native mobile application. Every color, font, size, and spacing value is specified precisely.

---

## 1. COLOR SYSTEM (All colors in HSL, hex equivalents provided)

### 1.1 Brand Colors
| Token | HSL | Hex Equivalent | Usage |
|---|---|---|---|
| **Primary** | `hsl(38, 75%, 52%)` | `#D4952A` | Primary buttons, active states, accent highlights, chord dot fills, slider thumbs, active tab indicators, BPM values, chord count numbers |
| **Brand** | `hsl(30, 62%, 44%)` | `#B57028` | Gradient start for CTA buttons, subtle warm accents |
| **Emphasis** | `hsl(43, 83%, 65%)` | `#E8C55C` | Metronome accent beats, beat countdown numbers, "Tap Tempo" button, calibration button, reference tone button, secondary glow accents |

### 1.2 Text Colors
| Token | HSL | Hex Equivalent | Usage |
|---|---|---|---|
| **Text Default** | `hsl(36, 33%, 93%)` | `#F2EDE5` | Primary headings, chord symbols, main body text, nut bar on chord diagrams |
| **Text Subtle** | `hsl(33, 14%, 72%)` | `#BFB6AA` | Secondary text, descriptions, chord strings on diagram, open string markers |
| **Text Muted** | `hsl(30, 7%, 47%)` | `#807A73` | Tertiary text, labels, disabled text, muted string X markers, inactive tab icons/labels, slider labels |

### 1.3 Background Colors
| Token | HSL | Hex Equivalent | Usage |
|---|---|---|---|
| **BG Base** | `hsl(30, 25%, 4%)` | `#0D0B08` | Main app background, primary CTA button text color, status bar background |
| **BG Elevated** | `hsl(28, 20%, 8%)` | `#181310` | Cards, panels, dropdowns, header background (at 85% opacity with blur), modals, elevated surfaces |
| **BG Overlay** | `hsl(28, 17%, 11%)` | `#211D18` | Hover states, bottom sheet bodies, secondary surfaces, pressed states |
| **BG Surface** | `hsl(28, 14%, 15%)` | `#2C2723` | Input backgrounds, inactive buttons, filter chips (default), tag backgrounds |

### 1.4 Border Colors
| Token | HSL | Hex Equivalent | Usage |
|---|---|---|---|
| **Border Default** | `hsl(28, 12%, 21%)` | `#3D3731` | Standard borders on cards, buttons, inputs, dividers between sections |
| **Border Subtle** | `hsl(28, 10%, 16%)` | `#2E2A25` | Very subtle dividers, tab bar top border, card borders (lighter), section separators |

### 1.5 Semantic Colors
| Token | HSL | Hex Equivalent | Usage |
|---|---|---|---|
| **Success** | `hsl(142, 71%, 45%)` | `#22C55E` | "Correct" feedback badge, microphone active state, "Chord Diagram On" toggle active state, metronome playing indicator, tuner active state |
| **Warning** | `hsl(43, 96%, 56%)` | `#FACC15` | Warning badges, missing chord indicators |
| **Error** | `hsl(0, 84%, 60%)` | `#EF4444` | "Wrong" feedback badge, delete actions, stop button, high-severity confusion pairs, favorites heart icon |
| **Info** | `hsl(217, 91%, 60%)` | `#3B82F6` | Info tooltips, "Strict" sensitivity label |

### 1.6 Accent Colors (Used for specific UI features)
| Color | HSL | Hex | Usage |
|---|---|---|---|
| **Root Note Blue** | `hsl(200, 80%, 62%)` | `#4DB8E8` | Root note diamond shapes on chord diagrams, root string filter chips |
| **Amber** | `hsl(38, 92%, 50%)` / `#F59E0B` | Key filter chip active state, key selector accent bar |
| **Emerald** | `hsl(152, 69%, 31%)` / `#10B981` | Category filter chip active state, chord practice card accent bar, "Chords" card icon background |
| **Violet** | `hsl(258, 90%, 66%)` / `#8B5CF6` | Type filter chip active state, progression practice card accent bar, "Chord Progressions" card icon background, "Choose Progression" section accent bar |
| **Cyan** | `hsl(187, 100%, 42%)` / `#06B6D4` | Play audio icon tint on scale chord preview |
| **Rose** | `hsl(350, 89%, 60%)` / `#F43F5E` | "My Progressions" section accent bar |

### 1.7 Fret Inlay Color
- Fret position marker dots: `hsl(30, 15%, 50%)` / `#8C7D6B` at 50% opacity

---

## 2. TYPOGRAPHY

### 2.1 Font Families
| Role | Font Family | Fallback | Google Fonts URL |
|---|---|---|---|
| **Display / Headings** | `Sora` | `sans-serif` | `https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800` |
| **Body / UI** | `DM Sans` | `sans-serif` | `https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700` |

### 2.2 Type Scale & Usage

| Element | Font | Size | Weight | Letter Spacing | Color |
|---|---|---|---|---|---|
| **App title (header)** | Sora | 18px | 600 (semibold) | tight (-0.025em) | Text Default `#F2EDE5` |
| **Page title (hero h1)** | Sora | 30px mobile / 48px tablet | 800 (extrabold) | normal | Text Default `#F2EDE5` or gradient (see gradients) |
| **Section heading** | Sora | 14px | 600–700 (semibold/bold) | wider (0.05em), UPPERCASE | Text Default `#F2EDE5` |
| **Card title** | Sora | 24px mobile / 30px tablet | 700 (bold) | normal | Text Default `#F2EDE5` |
| **Chord symbol (practice view)** | Sora | 30px mobile / 48–60px desktop | 800 (extrabold) | normal | Text Default `#F2EDE5` |
| **Chord name (subtitle)** | DM Sans | 12px mobile / 16px desktop | 400 | normal | Text Muted `#807A73` |
| **Body text / descriptions** | DM Sans | 14px | 400 | normal | Text Subtle `#BFB6AA` |
| **Button text (primary CTA)** | Sora | 18px | 700 (bold) | wider (0.05em), UPPERCASE | BG Base `#0D0B08` |
| **Button text (secondary)** | Sora | 12–14px | 700 (bold) | normal | varies by context |
| **Label / meta text** | DM Sans | 10–11px | 500–600 | widest (0.1em), UPPERCASE | Text Muted `#807A73` |
| **Tab bar labels** | Sora | 14px | 600 (semibold) | normal | Primary `#D4952A` (active) or Text Muted `#807A73` (inactive) |
| **Badge text ("Correct"/"Wrong")** | Sora | 20px mobile / 24px desktop | 800 (extrabold) | wider (0.05em), UPPERCASE | Success `#22C55E` or Error `#EF4444` |
| **Filter chip text** | DM Sans | 14px | 500 (medium) | normal | Varies by active state |
| **Filter pill/tag text** | DM Sans | 11px | 500 (medium) | normal | Amber/Emerald/Violet depending on filter type |
| **Stat number (large)** | Sora | 24px | 800 (extrabold) | normal | Varies by semantic meaning |
| **Tooltip / small label** | DM Sans | 10px | 500 | wider (0.05em), UPPERCASE | Text Muted `#807A73` |
| **Chord diagram finger number** | DM Sans | sm: 14px, md: 18px, lg: 24px | 700 (bold) | normal | BG Base `#0D0B08` (on primary dots) or `hsl(220, 20%, 10%)` (on root dots) |
| **Fret number label** | DM Sans | sm: 9px, md: 11px, lg: 14px | 600 (semibold) | normal | Text Subtle `#BFB6AA` |

---

## 3. CHORD DIAGRAM SPECIFICATIONS

### 3.1 Diagram Sizes
| Size | SVG Width | SVG Height | Dot Radius | Font Size (finger#) | Top Padding Y |
|---|---|---|---|---|---|
| **Small (sm)** | 100px | 130px | 7px | 14px | 18px |
| **Medium (md)** | 140px | 175px | 9.5px | 18px | 22px |
| **Large (lg)** | 200px | 250px | 13px | 24px | 30px |

### 3.2 Diagram Element Colors
| Element | Color | Details |
|---|---|---|
| **Fret lines (horizontal)** | `#FFFFFF` (white) | stroke-width: 2px (2.5px for top fret when no nut) |
| **Nut bar** (open position, baseFret=1) | Text Default `#F2EDE5` | Rendered as a filled rect: height 6px, border-radius 1px, sits at the top of the grid |
| **String lines (vertical)** | Text Subtle `#BFB6AA` | Graduated thickness simulating real strings: Low E = 2.6px, A = 2.2px, D = 1.8px, G = 1.4px, B = 1.0px, High e = 0.7px |
| **Finger dot (non-root)** | Primary `#D4952A` | Filled circle, radius per size table above |
| **Finger number text** | BG Base `#0D0B08` | Centered inside the dot, DM Sans bold, size per table |
| **Root note** | `hsl(200, 80%, 62%)` / `#4DB8E8` | Rendered as a **diamond shape** (rotated square/polygon), NOT a circle. The diamond is 1.15× the dot radius. Four points: top, right, bottom, left |
| **Root note text** | `hsl(220, 20%, 10%)` / `#1A1D24` | Bold, centered inside diamond |
| **Barre bar** | Primary `#D4952A` | Rounded rectangle connecting first to last barre string. Height = 38% of dot radius on each side (total height = 76% of dot radius). Border-radius = bar height |
| **Open string marker (O)** | Text Subtle `#BFB6AA` | Unfilled circle (stroke only), stroke-width 1.5px, radius = 65% of dot radius. Positioned above the nut |
| **Open string root marker** | `#4DB8E8` | Diamond shape (like fretted root), 1.2× the open marker radius |
| **Muted string marker (X)** | Text Muted `#807A73` | Two crossed lines forming an X, stroke-width 1.5px, extends ±(65% of dot radius) from center. Positioned above the nut |
| **Fret position inlay dots** | `hsl(30, 15%, 50%)` / `#8C7D6B` at 50% opacity | Circle at half the dot radius. Single dot at frets 3, 5, 7, 9, 15, 17, 19, 21. Double dots (side by side between strings 1-2 and 3-4) at frets 12, 24 |

### 3.3 Fret Number Label
- Shown only when baseFret > 1 (not open position)
- Text: "{baseFret}fr" (e.g., "3fr")
- Font: DM Sans, weight 600
- Size: sm=9px, md=11px, lg=14px
- Color: Text Subtle `#BFB6AA`
- Position: Left of the grid, aligned to first fret center, text-anchor: end

---

## 4. LAYOUT & NAVIGATION

### 4.1 Header Bar
- Height: **58px**
- Background: BG Base at 85% opacity + backdrop blur (12px)
- Border: bottom, Border Subtle `#2E2A25`
- Sticky top: `position: sticky; top: 0; z-index: 40`
- Logo: Guitar icon (from lucide-react) at **31×31px**, colored Primary `#D4952A`. Rotates -8° on hover
- Nav links: DM Sans 14px medium, Text Muted `#807A73` default, Primary `#D4952A` at 10% opacity background when active
- Nav icons: **23×23px**

### 4.2 Mobile Bottom Tab Bar
- Height: **56px** (plus safe area bottom inset)
- Layout: **5-column grid**, equal width
- Background: BG Base at 92% opacity + backdrop blur (large)
- Border: top, Border Subtle `#2E2A25`
- Fixed bottom, z-index: 50
- **Tab icons**: 30×30px
- **Tab labels**: Sora 14px semibold
- **Active tab color**: Primary `#D4952A`
- **Inactive tab color**: Text Muted `#807A73`
- **Active tab indicator**: 32px wide × 2px tall rounded bar at the very top of the tab, colored Primary `#D4952A`
- Tabs (left to right): Practice (custom guitar SVG icon), Metronome (custom SVG), Tuner (custom tuning fork SVG), Lessons (PlayCircle), Library (BookOpen)

### 4.3 Page Background — "Stage Gradient"
- Base: BG Base `#0D0B08`
- Overlaid radial gradients:
  1. `radial-gradient(ellipse at 50% 0%, hsl(38 75% 52% / 0.08) 0%, transparent 60%)` — Primary glow at top center
  2. `radial-gradient(ellipse at 80% 50%, hsl(30 62% 44% / 0.05) 0%, transparent 50%)` — Brand glow at right center

---

## 5. COMPONENT SPECIFICATIONS

### 5.1 Primary CTA Button ("Start Practice" / "Start Progression")
- Height: ~56px (py-4)
- Border radius: 12px (rounded-xl)
- Background: **horizontal linear gradient** from Brand `#B57028` → Primary `#D4952A` → Emphasis `#E8C55C`
- Text: Sora 18px bold, UPPERCASE, wider letter-spacing, colored BG Base `#0D0B08`
- Glow shadow: `0 0 20px hsl(38 75% 52% / 0.25), 0 0 60px hsl(38 75% 52% / 0.1)`
- Hover glow: `0 0 30px hsl(38 75% 52% / 0.4), 0 0 80px hsl(38 75% 52% / 0.15)`
- Press: scale to 97%
- Sweep animation on hover: A translucent white gradient (`from-transparent via-white/10 to-transparent`) translates from left to right over 700ms
- Disabled: BG Surface `#2C2723`, Text Muted `#807A73`, no glow

### 5.2 Correct/Wrong Feedback Badge
- Container: min-height 32px mobile / 40px desktop
- Badge pill: rounded-2xl (16px radius), backdrop-blur
- **Correct**: Background `hsl(142, 71%, 45%, 0.15)`, border 2px `hsl(142, 71%, 45%, 0.5)`, text `#22C55E`, text-shadow: `0 0 20px hsl(142 71% 45% / 0.4), 0 0 40px hsl(142 71% 45% / 0.15)`
- **Wrong**: Background `hsl(0, 84%, 60%, 0.15)`, border 2px `hsl(0, 84%, 60%, 0.5)`, text `#EF4444`, text-shadow: `0 0 20px hsl(0 84% 60% / 0.4), 0 0 40px hsl(0 84% 60% / 0.15)`
- Text: Sora 20px mobile / 24px desktop, extrabold 800, UPPERCASE, wider letter-spacing
- Animation: spring entrance (scale from 0.5 → 1, opacity 0 → 1, y from 6 → 0), duration 300ms

### 5.3 Listening/Microphone Indicator Bar
- Background: Success at 6% opacity, border Success at 15% opacity
- Rounded: 8px
- Contains animated audio bars: 5 vertical bars, width 2px each, gap 4px, colored Success `#22C55E`, animate height between 4px and 12px in a staggered wave (0.8s cycle, 0.12s delay per bar)
- Label: DM Sans 12px medium, Success green

### 5.4 Sensitivity Slider
- Track: 6px height, rounded 3px, colored Border Default `#3D3731`
- Thumb: 18px diameter circle, colored Primary `#D4952A`, shadow: `0 0 6px hsl(38 75% 52% / 0.4)`
- Thumb hover: scale 1.2, shadow expands
- Thumb active: scale 1.3, shadow expands further
- Label colors: ≤3 = Info blue `#3B82F6` ("Strict"), 4–7 = Primary `#D4952A` ("Balanced"), ≥8 = Success `#22C55E` ("Sensitive")

### 5.5 Show Diagrams Toggle
- Pill background (ON): `hsl(142, 71%, 45%, 0.1)`, border `hsl(142, 71%, 45%, 0.5)`, text `#22C55E`
- Pill background (OFF): BG Surface `#2C2723`, border Border Default `#3D3731`, text Text Muted `#807A73`
- Toggle track: 32px wide × 18px tall, rounded full
  - ON: `hsl(142, 71%, 45%, 0.35)`
  - OFF: Border Default `#3D3731`
- Toggle circle: 14×14px, rounded full
  - ON: at right position (15px from left), solid Success `#22C55E`
  - OFF: at left position (2px from left), solid Text Muted `#807A73`
- Icon: Eye (on) / EyeOff (off), 16×16px
- Label: Sora 12px bold, "Chord Diagram On" / "Chord Diagram Off"

### 5.6 Cards (Setup/Config Panels)
- Border radius: 12px (rounded-xl)
- Border: Border Subtle `#2E2A25`
- Background: BG Elevated at 60% opacity + backdrop-blur
- Padding: 16px mobile / 24px desktop
- **Accent bar**: 3px tall, full width, at the very top of the card, rounded top corners. Horizontal gradient specific to the section:
  - Key section: from `#F59E0B` (amber) → amber lighter → amber/30%
  - Scale section: from `#06B6D4` (cyan) → cyan lighter → cyan/30%
  - Progression section: from `#8B5CF6` (violet) → violet lighter → violet/30%
  - My Progressions: from `#F43F5E` (rose) → rose lighter → rose/30%
  - Ready to Practice: from Brand → Primary → Emphasis/30%

### 5.7 Filter Chips
- Padding: 12px horizontal, 10px vertical
- Border radius: 8px
- Font: DM Sans 14px medium
- Default: BG Elevated `#181310`, border Border Default `#3D3731`, text Text Subtle `#BFB6AA`
- Active (Key): amber-500 border at 50% opacity, amber-500 bg at 10% opacity, text amber-400
- Active (Category): emerald-500 border at 50% opacity, emerald-500 bg at 10% opacity, text emerald-400
- Active (Type): violet-500 border at 50% opacity, violet-500 bg at 10% opacity, text violet-400
- Icon: 16×16px, left side
- ChevronDown icon: 14×14px, right side, rotates 180° when dropdown open

### 5.8 Filter Tags/Pills (below filter bar)
- Padding: 10px horizontal, 2px vertical
- Border radius: full (pill shape)
- Font: DM Sans 11px medium
- Key tag: amber-500 bg at 12% opacity, amber-500 border at 25% opacity, text amber-400
- Category tag: emerald-500 bg at 12% opacity, emerald-500 border at 25% opacity, text emerald-400
- Type tag: violet-500 bg at 12% opacity, violet-500 border at 25% opacity, text violet-400
- Root tag: Root Blue `#4DB8E8` bg at 12% opacity, border at 25% opacity
- Remove button: 14×14px circle, centered X icon at 10px

### 5.9 Practice Mode Selection Cards (PracticeLanding)
- Border radius: 16px (rounded-2xl)
- Border: Border Subtle `#2E2A25`, changes to accent color at 50% opacity on hover
- Background: BG Elevated at 70% opacity + backdrop blur
- **Icon badge**: 48×48px, rounded-xl (12px), solid color background:
  - Chords card: Emerald `#10B981` background
  - Progressions card: Violet `#8B5CF6` background
  - The icon inside is a custom inline SVG drawing (see Section 6 for the SVG specs)
- Card title: Sora 24px mobile / 30px tablet, bold
- Description: DM Sans 14px, Text Subtle `#BFB6AA`
- CTA text: Sora 14px bold, accent color (emerald-400 or violet-400)
- Hover: glow shadow `0 0 40px rgba(accent, 0.12)`
- Press: scale 98%
- Spotlight effect: On desktop, a radial gradient (320px circle) follows the mouse cursor inside the card, colored Primary at 12% opacity

### 5.10 Bottom Toolbar (Practice View)
- Fixed bottom, full width, z-index 40
- Background: BG Elevated at 95% opacity + backdrop blur
- Border: top, Border Default `#3D3731`
- Max width: 672px (max-w-2xl) centered
- Padding: 10px vertical, 8px horizontal
- Button size: 44×44px mobile / 48×48px desktop
- Button border radius: 12px (rounded-xl)
- Button style: border Border Default, bg BG Surface, text Text Subtle
- **Next button** (accent): Primary `#D4952A` background, BG Base text, glow-primary shadow
- **Reveal button**: Primary at 15% opacity bg, Primary text, Primary border at 30% opacity

### 5.11 Session Summary Modal
- Overlay: black at 70% opacity + backdrop blur
- Modal: max-width 448px, rounded-2xl (16px), border Border Default, bg BG Elevated
- Accent bar at top: 3px, gradient Brand → Primary → Emphasis/30%
- Stats grid: 2×2, each stat card has semantic bg at 8%, border at 20%, centered layout
- Attempt log items: rounded-lg (8px), correct items get Success bg at 4%

### 5.12 Progression Timeline
- Horizontal scrolling container
- Each chord: rounded-lg (8px), min-width 48px, padded 12px horizontal / 8px vertical
- **Current chord**: Primary bg at 15%, Primary border at 50%, scale 110%
- **Past chord**: Success bg at 8%, Success border at 20%
- **Future chord**: BG Surface, Border Subtle
- Separator: `›` character, muted color

### 5.13 Confusion Matrix Cards
- Each confusion pair row: rounded-lg (8px), has a background fill bar showing relative frequency
- Severity colors:
  - **High (≥10)**: Error bg at 10%, Error border at 25%, Error text
  - **Medium (5–9)**: Emphasis bg at 8%, Emphasis border at 20%, Emphasis text
  - **Low (<5)**: BG Surface at 50%, Border Subtle, Text Subtle

---

## 6. CUSTOM SVG ICONS

### 6.1 Chord Practice Card Icon (inside 48×48 emerald badge)
- A mini G chord diagram SVG (28×34px viewport, rendered inside a 34×42 viewBox)
- Contains: nut bar (filled rect), fret lines (horizontal), string lines (vertical, graduated width), 3 open string circles (unfilled), 3 finger dots (filled circles)
- All elements colored BG Base `#0D0B08` (since they sit on a bright emerald background)

### 6.2 Progression Card Icon (inside 48×48 violet badge)
- A Roman numeral composition SVG (28×34px, 34×42 viewBox)
- "I" at top: Georgia serif, 19px, weight 800, centered
- Thin separator line below
- "IV" bottom-left: Georgia serif, 13px, weight 700
- Dot separator
- "V" bottom-right: Georgia serif, 13px, weight 700
- All colored BG Base `#0D0B08`

### 6.3 Metronome Icon
- Custom SVG, 24×24 viewBox, stroke-based (currentColor), strokeWidth 2, round caps/joins
- Trapezoidal body: path `M5 21h14l-3-18H8L5 21z`
- Pendulum arm: line from (12,21) to (16,5)
- Pendulum weight: circle at (14.5, 11), radius 1.5
- Sizes: 26px in mobile tab bar, 32px in desktop header button, 20px in panel headers

### 6.4 Tuning Fork Icon
- Custom SVG, 24×24 viewBox, stroke-based
- Fork prongs: path `M9 2v8a3 3 0 0 0 3 3 3 3 0 0 0 3-3V2`
- Stem: line from (12, 13) to (12, 22)
- Size: 30px in tab bar, 25px in desktop header

### 6.5 Guitar Icon (Practice Tab)
- Custom SVG, 24×24 viewBox, stroke-based
- Body with soundhole and neck detail (paths provided in source code)
- Size: 30px in mobile tab bar

---

## 7. GRADIENTS

### 7.1 Text Gradient (hero headlines)
- `linear-gradient(135deg, Emphasis #E8C55C, Primary #D4952A, Brand #B57028)`
- Applied as background-clip text (text fill transparent)

### 7.2 CTA Button Gradient
- `linear-gradient(to right, Brand #B57028, Primary #D4952A, Emphasis #E8C55C)`

### 7.3 Glow Effects
- **glow-primary**: `box-shadow: 0 0 20px hsl(38 75% 52% / 0.25), 0 0 60px hsl(38 75% 52% / 0.1)`
- **glow-emphasis**: `box-shadow: 0 0 30px hsl(43 83% 65% / 0.2), 0 0 80px hsl(43 83% 65% / 0.08)`

### 7.4 Hero Image Overlay
- Background image at 30% opacity (or 20% on landing page)
- Gradient overlay: `linear-gradient(to bottom, BG Base at 30%, BG Base at 70%, BG Base at 100%)`

---

## 8. SPACING SYSTEM

Based on an 8px grid with 4px fine-tuning:

| Token | Value | Usage |
|---|---|---|
| xs | 4px | Fine spacing, icon-to-text gaps inside small elements |
| sm | 8px | Tight gaps between related items |
| md | 12px | Standard gap between components |
| base | 16px | Standard padding, section gaps |
| lg | 24px | Card padding (desktop), section padding |
| xl | 32px | Large vertical spacing between sections |
| 2xl | 48px | Hero section vertical padding (mobile) |
| 3xl | 64px | Hero section vertical padding (desktop) |

### Key dimensions:
- Header height: 58px
- Bottom tab bar height: 56px + safe area
- Bottom practice toolbar: ~66px (44px buttons + 22px padding)
- Card border radius: 12px
- Button border radius: 12px
- Modal border radius: 16px
- Pill/tag border radius: 9999px (full)
- Touch targets: minimum 44×44px

---

## 9. ANIMATIONS & TRANSITIONS

| Animation | Duration | Easing | Details |
|---|---|---|---|
| **Badge entrance** | 300ms | `[0.16, 1, 0.3, 1]` (spring-like) | Scale 0.5→1, opacity 0→1, y 6→0 |
| **Badge exit** | 300ms | same | Scale 1→0.7, opacity 1→0, y 0→-6 |
| **Chord transition** | 300ms | default | Opacity 0→1, y 20→0 (enter), y 0→-20 (exit) |
| **Dropdown open** | 150ms | default | Opacity 0→1, y -8→0 |
| **Bottom sheet** | spring, stiffness 400, damping 36 | spring | Slides up from y 100% |
| **Button press** | instant | — | Scale to 95–98% on press |
| **Audio bar wave** | 800ms each, infinite | easeInOut | Height oscillates 4px–12px, staggered 120ms per bar |
| **Mic pulse dot** | CSS pulse | — | 2.5px green dot, animates opacity |
| **Hover sweep (CTA)** | 700ms | ease-in-out | White gradient translates left→right |
| **Tab indicator** | spring, stiffness 500, damping 35 | spring | Layout animation (shared layout ID) |
| **General transitions** | 200ms | default | Color changes, border changes, background changes |

---

## 10. DARK MODE ONLY

This app uses **dark mode exclusively**. There is no light mode variant. The color scheme is set to `dark` at the HTML level. All colors above are the only colors used — do not invert or create light variants.

The theme color (status bar / browser chrome) is `#0D0B08` (BG Base).

---

## 11. BORDER RADIUS SYSTEM

| Token | Value | Usage |
|---|---|---|
| sm | 4px | Small inline badges, tags |
| md | 8px | Filter chips, buttons, list items, smaller cards |
| lg | 10px | Default radius (--radius), standard cards |
| xl | 12px | Buttons, cards, panels |
| 2xl | 16px | Modals, practice mode cards, bottom sheets |
| full | 9999px | Pills, tags, avatar badges, toggle track, tab indicators |

---

## 12. OPACITY PATTERNS

These opacity values are used consistently throughout:
- **Active/selected backgrounds**: 8–15% of accent color
- **Active borders**: 25–50% of accent color
- **Hover backgrounds**: Use BG Overlay or accent at 10–20%
- **Disabled elements**: 40% overall opacity
- **Backdrop blur surfaces**: 85–95% of background color + blur
- **Subtle decorative elements**: 5–8% of accent color
- **Glow shadow inner**: 25% of color
- **Glow shadow outer**: 8–15% of color
