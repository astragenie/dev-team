# Style selection — product type → direction, palette, typography

Visual direction is a function of the product's field and audience, not personal taste. Select a
style by product type first, then verify accessibility constraints, then commit.

## Style taxonomy (with constraints)

| Style                       | Signature                                            | Best for                           | Caution                                          |
| --------------------------- | ---------------------------------------------------- | ---------------------------------- | ------------------------------------------------ |
| **Minimalism (Swiss)**      | Clean, spacious, grid-disciplined                    | Enterprise, dashboards, SaaS       | Needs typographic craft or reads as empty        |
| **Glassmorphism**           | Frosted panels, backdrop-blur 10–20px                | Modern SaaS, overlays/modals       | Light mode needs `bg-white/80`+, never `/10`     |
| **Brutalism**               | Raw, stark, high contrast                            | Portfolios, media, tech blogs      | Commit fully; half-brutalism reads as broken     |
| **Bento Grid**              | Apple-style modular cards, varied sizes              | Dashboards, feature overviews      | Vary tile sizes or it's just a card grid         |
| **Dark Mode (OLED)**        | #000 ground + restrained vibrant accents             | Dev tools, music, night-use apps   | Muted text ≥ slate-400 equivalent; test contrast |
| **Soft UI / Claymorphism**  | Soft 3D, generous radius (16–24px), toy-like         | Education, wellness, consumer      | Low-contrast risk — keep WCAG AA floors          |
| **Motion-driven**           | Scroll-triggered narrative, parallax                 | Storytelling, launches, portfolios | `prefers-reduced-motion` mandatory               |
| **Aurora / mesh gradients** | Iridescent backgrounds                               | Branding moments, heroes           | Text contrast over gradients; never on data UI   |
| **AI-native**               | Conversational, minimal chrome, streaming indicators | Copilots, chat products            | Don't add purple gradients "because AI"          |

## Product type → recommended direction

| Product                   | Pattern                      | Style                               | Palette direction                                      | Typography                                     |
| ------------------------- | ---------------------------- | ----------------------------------- | ------------------------------------------------------ | ---------------------------------------------- |
| Dev tool / AI product     | Product UI Slate hero        | Dark-first or pure-white minimalism | Near-black #0A0A0A + one restrained accent             | Neo-grotesque or mono display                  |
| Enterprise SaaS dashboard | Data-dense tiles, drill-down | Minimalism + Bento                  | Off-white ground, semantic status colors               | Refined sans, mono for numbers                 |
| Fintech / crypto          | Conversion + real-time       | Glassmorphism + OLED dark           | Dark #0F172A + electric accent                         | Confident sans, tabular numerals               |
| Healthcare / gov / legal  | Trust & authority            | Accessible & ethical (AAA)          | Calm blue #0891B2, health green #059669, warm neutrals | Readable 16px+ body, traditional serif accents |
| E-commerce / consumer     | Hero-centric + social proof  | Vibrant block-based or soft UI      | One dominant brand hue + warm neutrals                 | Friendly sans display                          |
| Luxury / fashion / food   | Index Manuscript / Collage   | Editorial                           | Off-white/near-black, muted earth accents              | Serif display + mono metadata                  |
| Wellness / education      | Storytelling                 | Organic / claymorphism              | Earth tones, soft pastels + one anchor                 | Rounded sans, generous line-height             |

## Industry palette anchors

| Industry              | Ground                   | Ink                 | Accent                   |
| --------------------- | ------------------------ | ------------------- | ------------------------ |
| Aerospace / defense   | #0A0A0A, #0C1222         | white/silver        | single restrained blue   |
| Tech / AI / dev tools | pure white OR near-black | high-contrast       | glow edges, chrome/glass |
| Finance / legal       | navy, charcoal, forest   | off-white           | conservative metallic    |
| Food / hospitality    | cream, charcoal          | editorial serif ink | muted earth tones        |
| Fashion / luxury      | off-white / near-black   | serif               | minimal to none          |

## Anti-pattern pairings (flag on sight)

- AI purple/pink gradients on healthcare, legal, or finance — trendy and trust-destroying
- Playful claymorphism on banking — unprofessional
- Light airy minimalism on fintech — missing security/trust signals
- Ornate motion-heavy design on data dashboards — slow and distracting
- Dark-mode-only on broad consumer products — excludes contexts
- Emoji as icons anywhere — use SVG icon sets (Lucide, Heroicons)
- The same editorial-luxury register (cream + serif + brass) applied to a tech product

## Reference research procedure

Before committing, study 3–5 real production sites in the product's field. Per site, record:
primary display font, body font, palette as hex, structural concept, one signature move to borrow.

Starting sets:

- **AI / dev tools:** Vercel, Cursor, Linear, Stripe, Figma, Zed, Raycast, Supabase, Anthropic, OpenAI
- **Infra / security:** Cloudflare, Tailscale, Chainguard, Datadog, HashiCorp, Teleport
- **Fintech / wealth:** Stripe, Addepar, Pictet, Mercury
- **Luxury / fashion:** Bottega Veneta, The Row, A.P.C., Hermès
- **Editorial / publishing:** The Paris Review, Apartamento, MIT Press, NYRB
- **Food / hospitality:** Noma, Eleven Madison Park, Atomix
