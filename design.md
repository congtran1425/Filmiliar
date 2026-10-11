<!-- Hallmark · pre-emit critique: P4 H4 E3 S5 R4 V3 -->
# Filmiliar design system

This file records the visual direction for the existing website. Extend it as the product flows move to dedicated URLs.

## Direction

- Genre: approachable photographic editorial.
- Brand anchor: the owner supplied teal aperture and filmstrip logo. Use the horizontal mark in the header and footer, and the isolated icon as favicon.
- Marketing surfaces: warm paper, generous image space, large clear headlines, and few accents.
- Shopping surfaces: deep teal panels that frame the actual product photographs. Detail, rental, and purchase pages should share this family when routed pages are built.
- Content surfaces: warm paper with narrow reading columns and visible source or policy status.

## Palette

| Role | Value | Use |
| --- | --- | --- |
| Paper | `#F5F2EA` | Hero and light navigation |
| Paper raised | `#FFFCF6` | Logo backing, small highlights |
| Ink | `#143238` | Copy on paper |
| Brand teal | `#075E68` | Primary actions on paper |
| Deep teal | `#071F24` | Shop and footer background |
| Teal panel | `#0D2C33` | Product cards and dialogs |
| Rule | `#D9DED7` / `#1C424A` | Light / dark borders |
| Warm accent | `#D5A36A` | Limited supporting detail on dark surfaces |

Teal is the main action color. Warm accent is secondary; it must not compete with the logo. Text contrast is checked per surface.

## Typography and spacing

- Display: Plus Jakarta Sans, bold, compact tracking. The logo wordmark remains an image.
- Body: Plus Jakarta Sans, regular to medium.
- Technical data: JetBrains Mono, used sparingly for codes, prices, and labels.
- Spacing: 4 px base; 16/24/32/48/64 px section rhythm. Product images should keep a consistent ratio and take priority over decoration.

## Interaction and copy

- Main CTAs use a solid teal fill on paper; dark shop surfaces may use the warm accent for a secondary action until components migrate to semantic brand tokens.
- Hover is subtle; focus rings are visible. Reduced motion should disable ornamental transforms.
- Do not claim inspection results, availability, delivery speed, deposit or warranty terms without supporting data or a group approved policy.
- Rental and purchase are designed in parallel. Both end at an order review state until payment is genuinely available. The UI must say that no booking or charge has occurred.

## Current implementation and pending work

- Product URLs and rental/purchase review pages are implemented. The review pages do not create orders or charge money.
- A gallery of photographs of the exact physical unit is pending. Existing seed thumbnails are illustrative, and known unrelated images are suppressed in the client.
- The final payment integration remains outside the current UI/UX phase.
- Deposit and warranty terms require group decisions before policy UI or amounts are finalized.
