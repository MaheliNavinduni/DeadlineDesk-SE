# DeadlineDesk – UI Style Guide

The visual rules behind the interface. All values live as CSS variables at the top of `css/styles.css`, so changing one value updates the whole app.

---

## 1. Colour palette

Five shades of purple, from light to dark.

| Swatch | Name | Hex | Used for |
|---|---|---|---|
| ![](https://placehold.co/24x24/efbbff/efbbff.png) | Lilac 100 | `#efbbff` | Hover backgrounds, light icon tiles, login background glow |
| ![](https://placehold.co/24x24/d896ff/d896ff.png) | Lilac 200 | `#d896ff` | Hover borders, default left edge of assignment cards, empty-state icon |
| ![](https://placehold.co/24x24/be29ec/be29ec.png) | Violet | `#be29ec` | Primary button (start of gradient), focus ring, "Medium" priority, section icons |
| ![](https://placehold.co/24x24/800080/800080.png) | Purple | `#800080` | Primary button (end of gradient), outline button text |
| ![](https://placehold.co/24x24/660066/660066.png) | Plum | `#660066` | Logo text, headings, numbers, "High" priority |

Supporting colours:

| Role | Hex | Used for |
|---|---|---|
| Page background | `#faf5ff` | App background (very light lilac, softer than white) |
| Text | `#2a0a2e` | Body text (dark plum instead of pure black) |
| Muted text | `#7a5f80` | Labels, subjects, hints |
| Border | `#ecdcf3` | Inputs, cards, dividers |
| Success | `#2e9e6a` | "Done" status, completed edge |
| Warning | `#e0901c` | "Due today / soon" text, "Pending" badge |
| Danger | `#d6336c` | "Overdue", errors, delete button |

**Rule:** status colours (green / amber / pink-red) are only used for meaning, never for decoration, so a student can spot overdue work at a glance.

---

## 2. Typography

| Element | Font | Size | Weight |
|---|---|---|---|
| Everything | Poppins (falls back to system font offline) | – | – |
| Logo (login screen) | | 1.7rem | 700 |
| Logo (top bar) | | 1.35rem | 700 |
| Stat numbers | | 1.6rem | 700 |
| Panel headings | | 1.05rem | 600 |
| Body / inputs / buttons | | 0.95rem | 400 / 500 |
| Field labels | | 0.82rem | 500 |
| Table headings | | 0.75rem, UPPERCASE | 600 |

---

## 3. Shape, spacing and depth

| Token | Value | Where |
|---|---|---|
| Card radius | 16px | Panels, stat cards |
| Control radius | 12px | Inputs, buttons, list rows |
| Pill radius | 999px | Priority and status badges |
| Card shadow | soft purple, `0 8px 30px rgba(102,0,102,.10)` | Panels |
| Hover shadow | stronger, `0 18px 50px rgba(102,0,102,.22)` | Lifted cards, modals |
| Page width | max 1240px, 24px side padding | Dashboard |

---

## 4. Icons

- Line icons (Lucide style), drawn as inline SVG – **no emojis**, and they work without internet.
- Size 18px, stroke 2px, rounded ends; they take the text colour of their parent.
- Every icon-only button has a tooltip and `aria-label` (e.g. "Mark as completed").

| Icon | Meaning |
|---|---|
| Graduation cap | Logo |
| Plus | Add assignment |
| Check / Undo arrow | Mark completed / move back to pending |
| Pencil | Edit |
| Trash | Delete |
| Calendar / Clock / Bell | Deadlines, pending, due this week |
| Warning triangle | Overdue |
| Book | Subject |

---

## 5. Components and their states

| Component | Normal | Hover | Other states |
|---|---|---|---|
| Primary button | Violet → purple gradient, white text | Lifts 2px, stronger glow | Pressed: shrinks to 97% |
| Outline button | Purple text, light border | Lilac background | – |
| Danger button | Pink-red | Lifts 2px | Only inside the delete confirmation |
| Icon button | Grey icon | Lilac tile, lifts 2px | Complete = green tile, delete = red tile |
| Input | Light border, near-white fill | – | Focus: violet border + soft violet ring. Error: red border + short shake |
| Assignment row | White card, coloured left edge by priority | Lifts 3px, shadow | Overdue: pink tint. Completed: faded + strikethrough |
| Priority pill | Low = grey-lilac, Medium = violet, High = plum | Lifts 2px in the picker | Selected: outlined |

---

## 6. Motion

Animations are short (0.2–0.6s) and only explain what changed – nothing loops except the small floating logo on the login screen.

| Animation | Duration | When |
|---|---|---|
| Rise (fade + move up) | 0.5–0.6s | Login card, stat cards (staggered), panels |
| Slide in | 0.35s, staggered 40ms per row | Assignment rows appear |
| Slide out | 0.3s | Deleted row leaves |
| Pop (scale in) | 0.3s | Edit / delete modals |
| Toast in / out | 0.35s / 0.3s | Success and error messages |
| Shake | 0.35s | Field with an error |

If the user has **Reduce motion** turned on in their system settings, all animations are switched off.

---

## 7. Responsive layout

| Screen width | Layout |
|---|---|
| Over 1000px | Add form on the left (340px), list on the right; 4 stat cards in a row |
| 760 – 1000px | Form above the list; stat cards 2 × 2 |
| Under 760px (phones) | Table headings hidden, each assignment becomes a card with small labels; "Logout" shows icon only |
| Under 420px | Tighter spacing; toasts stretch full width |
