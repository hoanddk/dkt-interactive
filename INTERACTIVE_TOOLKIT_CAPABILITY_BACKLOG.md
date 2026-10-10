# INTERACTIVE TOOLKIT CAPABILITY BACKLOG

**Status:** TOOLKIT_CANDIDATE BACKLOG  
**Pilot:** Điện Kính Thiên / F-EDITOR-UX-04  
**Rule:** Ghi nhận để thiết kế Toolkit về sau; **không mở rộng Pilot 01 chỉ để trình diễn capability**.

## Visual
- Image
- Gallery
- Slideshow
- Zoom
- Hotspot
- 360 / panorama
- Before / after
- Overlay
- Side-by-side

## Media
- Video 16:9
- Video 9:16
- Audio

## Data visualization
- Bar
- Line
- Area
- Stacked
- Scatter
- Ranking
- Timeline
- KPI
- Small multiples

## Map
- Designed map
- Hotspot map
- Route map
- Layered map
- Data map
- External map service

## Live / Embed
- iframe / embed
- Live dashboard
- Real-time feeds
- Fallback state

## AI reader services
- Summary
- Ask this article
- Explain this
- Key facts
- Known / unknown
- Guided reading

## Visual direction
- AI-proposed theme
- Selectable visual direction
- Palette
- Typography
- Block-level override

## Deliberately outside F-EDITOR-UX-04
- Advanced chart library
- Google Maps integration
- Live data API
- AI Q&A / AI summary implementation
- DAM
- Backend CMS
- Advanced crop editor
- Theme marketplace
- Generic structured-graphic builder
- Drag/drop visual editor
- Collaborative editing

## Architecture findings promoted only as TOOLKIT_CANDIDATE
1. **Simple first:** expose the minimum editorial decision surface; technical controls stay on demand.
2. **Visual-type routing:** IMAGE / STRUCTURED_GRAPHIC / INTERACTIVE_COMPONENT / MEDIA are separate editing modes.
3. **Lock logic, not language:** structure, interaction logic and evidence status may be locked while display copy remains editable/proposable.
4. **Reader view ≠ editorial view:** internal IDs, evidence workflow codes and technical gates never belong in default reader UI.
5. **Optional data renders only when present:** footer, caption, author/source and publication metadata must disappear cleanly when empty.
6. **Human override over fake automation:** do not create hard compliance gates for facts the system cannot independently verify.
