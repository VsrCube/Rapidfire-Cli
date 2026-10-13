#!/usr/bin/env python3
"""
Generate the polished 5-column architectural flowchart for RapidFire CLI.
Palette: Strict Monotone Yellow-Gold (#FFC107 / #F59E0B) and Crisp White (#FFFFFF).
Background: 100% Transparent (no canvas background rect).
Screen Size: Canva Presentation (16:9 Widescreen - 1920x1080 and 4K 3840x2160).
"""

import os
import subprocess

def escape_xml(s):
    if not isinstance(s, str):
        return s
    return str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")

def generate_flowchart_svg():
    width = 1920
    height = 1080

    svg = []
    svg.append(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" width="{width}" height="{height}" style="background: transparent; font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, Helvetica, Arial, sans-serif;">')

    svg.append('''<defs>
    <!-- Arrow Marker (Gold) -->
    <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#FFC107" />
    </marker>
    <!-- Glow filter for terminal pills -->
    <filter id="gold-glow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="0" stdDeviation="3.5" flood-color="#FFC107" flood-opacity="0.45"/>
    </filter>
  </defs>''')

    GOLD_MAIN = "#FFC107"
    GOLD_RICH = "#F59E0B"
    GOLD_LIGHT = "#FEF3C7"
    GOLD_MUTED = "#FCD34D"
    WHITE = "#FFFFFF"
    WHITE_MUTED = "#E2E8F0"
    BOX_FILL = "rgba(16, 17, 22, 0.94)"
    DIAMOND_FILL = "rgba(26, 23, 14, 0.96)"
    PILL_FILL = "rgba(32, 28, 14, 0.96)"

    def box(cx, cy, w, h, title, subtitle="", rx=7, stroke=GOLD_RICH, fill=BOX_FILL, stroke_w=1.8):
        x = cx - w/2
        y = cy - h/2
        s = '<g>'
        s += f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="{fill}" stroke="{stroke}" stroke-width="{stroke_w}"/>'
        if subtitle:
            s += f'<text x="{cx}" y="{cy - 5}" font-size="12.5" font-weight="700" fill="{WHITE}" text-anchor="middle">{escape_xml(title)}</text>'
            s += f'<text x="{cx}" y="{cy + 13}" font-size="10.5" font-weight="400" fill="{GOLD_LIGHT}" text-anchor="middle">{escape_xml(subtitle)}</text>'
        else:
            s += f'<text x="{cx}" y="{cy + 5}" font-size="13" font-weight="700" fill="{WHITE}" text-anchor="middle">{escape_xml(title)}</text>'
        s += '</g>'
        return s

    def detailed_box(cx, cy, w, h, title, lines, rx=7, stroke=GOLD_RICH, fill=BOX_FILL, stroke_w=1.8):
        x = cx - w/2
        y = cy - h/2
        if isinstance(lines, str):
            lines = [lines]
        flat_lines = []
        for l in lines:
            flat_lines.extend(str(l).split('\n'))

        s = '<g>'
        s += f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="{fill}" stroke="{stroke}" stroke-width="{stroke_w}"/>'
        s += f'<text x="{cx}" y="{y + 18}" font-size="12" font-weight="700" fill="{WHITE}" text-anchor="middle">{escape_xml(title)}</text>'
        start_y = y + 33
        for i, line in enumerate(flat_lines):
            line_color = GOLD_LIGHT if i == 0 else WHITE_MUTED
            font_size = "9.5" if len(flat_lines) > 2 else "10"
            s += f'<text x="{cx}" y="{start_y + i * 14}" font-size="{font_size}" font-weight="400" fill="{line_color}" text-anchor="middle">{escape_xml(line.strip())}</text>'
        s += '</g>'
        return s

    def terminal_pill(cx, cy, w, h, text, subtext="", stroke=GOLD_MAIN, fill=PILL_FILL):
        x = cx - w/2
        y = cy - h/2
        s = '<g filter="url(#gold-glow)">'
        s += f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{h/2}" fill="{fill}" stroke="{stroke}" stroke-width="2.2"/>'
        if subtext:
            s += f'<text x="{cx}" y="{cy - 4}" font-size="12.5" font-weight="800" fill="{GOLD_MAIN}" text-anchor="middle" letter-spacing="0.5">{escape_xml(text)}</text>'
            s += f'<text x="{cx}" y="{cy + 12}" font-size="10" font-weight="500" fill="{WHITE}" text-anchor="middle">{escape_xml(subtext)}</text>'
        else:
            s += f'<text x="{cx}" y="{cy + 5}" font-size="13" font-weight="800" fill="{GOLD_MAIN}" text-anchor="middle" letter-spacing="0.5">{escape_xml(text)}</text>'
        s += '</g>'
        return s

    def diamond(cx, cy, w, h, title, subtext="", stroke=GOLD_MAIN, fill=DIAMOND_FILL):
        s = '<g>'
        half_w = w / 2
        half_h = h / 2
        pts = f"{cx},{cy - half_h} {cx + half_w},{cy} {cx},{cy + half_h} {cx - half_w},{cy}"
        s += f'<polygon points="{pts}" fill="{fill}" stroke="{stroke}" stroke-width="2.2"/>'
        if subtext:
            s += f'<text x="{cx}" y="{cy - 4}" font-size="11.5" font-weight="700" fill="{WHITE}" text-anchor="middle">{escape_xml(title)}</text>'
            s += f'<text x="{cx}" y="{cy + 12}" font-size="9.5" font-weight="500" fill="{GOLD_MUTED}" text-anchor="middle">{escape_xml(subtext)}</text>'
        else:
            s += f'<text x="{cx}" y="{cy + 4}" font-size="12" font-weight="700" fill="{WHITE}" text-anchor="middle">{escape_xml(title)}</text>'
        s += '</g>'
        return s

    def branch_label(cx, cy, text, is_yes=True):
        bg = "rgba(18, 18, 22, 0.96)"
        border = GOLD_MAIN if is_yes else "#94A3B8"
        txt_color = GOLD_MAIN if is_yes else WHITE
        w = max(40, len(text) * 8 + 14)
        h = 20
        s = '<g>'
        s += f'<rect x="{cx - w/2}" y="{cy - h/2}" width="{w}" height="{h}" rx="{h/2}" fill="{bg}" stroke="{border}" stroke-width="1.3"/>'
        s += f'<text x="{cx}" y="{cy + 4.5}" font-size="9.5" font-weight="800" fill="{txt_color}" text-anchor="middle">{escape_xml(text)}</text>'
        s += '</g>'
        return s

    def arrow_line(x1, y1, x2, y2, stroke=GOLD_MAIN, stroke_w=2):
        return f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{stroke}" stroke-width="{stroke_w}" marker-end="url(#arrow)"/>'

    def path_arrow(d, stroke=GOLD_MAIN, stroke_w=2):
        return f'<path d="{d}" fill="none" stroke="{stroke}" stroke-width="{stroke_w}" marker-end="url(#arrow)"/>'

    svg.append(f'''
    <!-- Top Header -->
    <g>
      <text x="960" y="32" font-size="20" font-weight="900" fill="{GOLD_MAIN}" text-anchor="middle" letter-spacing="2">RAPIDFIRE CLI : SYSTEM EXECUTION FLOWCHART</text>
      <text x="960" y="50" font-size="11.5" font-weight="400" fill="{GOLD_LIGHT}" text-anchor="middle" letter-spacing="0.5">End-to-End Architectural Pipeline • Command Dispatching • DevSecOps • 3-Tier Scaffolding • Multi-Provider AI</text>
    </g>
    ''')

    svg.append(terminal_pill(960, 83, 340, 38, "START: USER COMMAND INPUT", "Terminal REPL or direct CLI invocation"))

    svg.append(arrow_line(960, 102, 960, 122))

    svg.append(box(960, 144, 350, 44, "Command Lexer & Tokenizer", "Parses verbs, subcommands, arguments & flags (src/commands/index.js)"))

    svg.append(arrow_line(960, 166, 960, 188))

    d1_cx, d1_cy = 960, 222
    svg.append(diamond(d1_cx, d1_cy, 260, 68, "RapidFire Built-in Command?", "setup • push • ask • suggest • preset • deploy"))

    svg.append(path_arrow(f"M {d1_cx - 130} {d1_cy} L 200 {d1_cy} L 200 348"))
    svg.append(branch_label(520, d1_cy - 12, "NO (Pass)", is_yes=False))

    svg.append(arrow_line(d1_cx, d1_cy + 34, d1_cx, 286))
    svg.append(branch_label(d1_cx + 34, 271, "YES", is_yes=True))

    svg.append(f'''
    <!-- Dispatcher Hub -->
    <rect x="750" y="286" width="420" height="30" rx="15" fill="rgba(24, 22, 14, 0.96)" stroke="{GOLD_MAIN}" stroke-width="1.8"/>
    <text x="960" y="306" font-size="11.5" font-weight="800" fill="{GOLD_MAIN}" text-anchor="middle" letter-spacing="1">RAPIDFIRE COMMAND ROUTER &amp; DISPATCHER</text>
    ''')

    svg.append(f'<path d="M 960 316 L 960 330 M 580 330 L 1720 330" fill="none" stroke="{GOLD_MAIN}" stroke-width="2"/>')
    svg.append(arrow_line(580, 330, 580, 348))
    svg.append(arrow_line(960, 330, 960, 348))
    svg.append(arrow_line(1340, 330, 1340, 348))
    svg.append(arrow_line(1720, 330, 1720, 348))

    c1_cx = 200
    c1_w = 310

    svg.append(terminal_pill(c1_cx, 364, 290, 32, "NATIVE PTY PASSTHROUGH", "Non-RapidFire Commands (<2ms latency)"))
    svg.append(arrow_line(c1_cx, 380, c1_cx, 405))

    svg.append(detailed_box(c1_cx, 432, c1_w, 54, "node-pty Stream Bridge", [
        "Raw ANSI bidirectional stream (<2ms latency)",
        "ConPTY on Windows • Unix PTY on macOS/Linux"
    ]))
    svg.append(arrow_line(c1_cx, 459, c1_cx, 484))

    svg.append(detailed_box(c1_cx, 511, c1_w, 54, "Host OS Native Shell", [
        "Executes directly in bash, zsh, or PowerShell",
        "Retains working directory (cwd) & environment"
    ]))
    svg.append(arrow_line(c1_cx, 538, c1_cx, 563))

    svg.append(detailed_box(c1_cx, 590, c1_w, 54, "Bidirectional Terminal Sync", [
        "Handles SIGWINCH viewport resizing events",
        "Preserves interactive curses / full terminal apps"
    ]))
    svg.append(arrow_line(c1_cx, 617, c1_cx, 855))

    svg.append(terminal_pill(c1_cx, 876, 290, 42, "HOST SHELL OUTPUT", "Direct execution output returned"))

    c2_cx = 580
    c2_w = 310

    svg.append(terminal_pill(c2_cx, 364, 290, 32, "ROUTE: setup <recipe>", "3-Tier Deterministic Scaffolding Engine"))
    svg.append(arrow_line(c2_cx, 380, c2_cx, 405))

    svg.append(box(c2_cx, 430, c2_w, 48, "Recipe Classifier & Parser", "Analyzes requested stack tokens (planner.js)"))
    svg.append(arrow_line(c2_cx, 454, c2_cx, 480))

    d2_cx, d2_cy = c2_cx, 514
    svg.append(diamond(d2_cx, d2_cy, 210, 68, "Predefined Stack?", "In 13 built-in offline templates"))

    svg.append(arrow_line(d2_cx, d2_cy + 34, d2_cx, 580))
    svg.append(branch_label(d2_cx + 34, 564, "YES", is_yes=True))

    svg.append(detailed_box(c2_cx, 608, c2_w, 56, "Tier 1: 13 Predefined Stacks", [
        "React, Next.js, Vue, FastAPI, Flask, Django, Vite",
        "Instant offline copy from embedded templates"
    ]))

    svg.append(path_arrow(f"M {d2_cx + 105} {d2_cy} L {c2_cx + 145} {d2_cy} L {c2_cx + 145} 675 L {c2_cx} 675"))
    svg.append(branch_label(c2_cx + 125, d2_cy - 12, "NO", is_yes=False))

    svg.append(detailed_box(c2_cx, 706, c2_w, 60, "Tier 2 & 3: Composed / Dynamic", [
        "'+' Token: Dual-tier client:3000 + API:8000 + CORS",
        "Unknown: AI JSON Blueprint + AST Path Guard"
    ]))

    svg.append(path_arrow(f"M {c2_cx - 145} 608 L {c2_cx - 165} 608 L {c2_cx - 165} 750 L {c2_cx} 750"))

    svg.append(arrow_line(c2_cx, 736, c2_cx, 760))

    svg.append(detailed_box(c2_cx, 788, c2_w, 56, "Automated Environment Setup", [
        "Installs dependencies • Builds Python venv",
        "Configures CORS middleware • Injects .rapidfire.json"
    ]))
    svg.append(arrow_line(c2_cx, 816, c2_cx, 855))

    svg.append(terminal_pill(c2_cx, 876, 290, 42, "READY WORKSPACE", "Fullstack dev server ready (npm run dev)"))

    c3_cx = 960
    c3_w = 310

    svg.append(terminal_pill(c3_cx, 364, 290, 32, "ROUTE: push [commit_msg]", "Shift-Left DevSecOps & Git Lifecycle"))
    svg.append(arrow_line(c3_cx, 380, c3_cx, 405))

    svg.append(box(c3_cx, 430, c3_w, 48, "Monorepo Guard & Tree Inspection", "getParentGitRepo() check • Prevents nested .git"))
    svg.append(arrow_line(c3_cx, 454, c3_cx, 480))

    svg.append(detailed_box(c3_cx, 508, c3_w, 54, "In-Flight Secret Interceptor", [
        "Scans git diffs against 160+ high-entropy rules",
        "AWS, GitHub PAT, OpenAI, Gemini, JWT, Private Keys"
    ]))
    svg.append(arrow_line(c3_cx, 535, c3_cx, 560))

    d3_cx, d3_cy = c3_cx, 594
    svg.append(diamond(d3_cx, d3_cy, 160, 68, "Secret Detected?", "Entropy & rule verify"))

    svg.append(arrow_line(880, d3_cy, 880, 650))
    svg.append(branch_label(880 - 32, 622, "YES", is_yes=True))
    svg.append(detailed_box(880, 685, 145, 70, "ABORT PUSH", [
        "0 remote packets sent",
        "Diff redacted locally",
        "Alerts file & token line"
    ]))

    svg.append(arrow_line(880, 720, 880, 755))
    svg.append(terminal_pill(880, 775, 145, 34, "LEAK BLOCKED", "Credentials safe"))

    svg.append(arrow_line(1040, d3_cy, 1040, 650))
    svg.append(branch_label(1040 + 32, 622, "NO", is_yes=False))
    svg.append(detailed_box(1040, 685, 145, 70, "ATOMIC COMMIT", [
        "Hooks Auto-Installed",
        "git add . && commit",
        "Pushes to remote repo"
    ]))

    svg.append(path_arrow(f"M 1040 720 L 1040 810 L {c3_cx} 810 L {c3_cx} 855"))

    svg.append(terminal_pill(c3_cx, 876, 290, 42, "VERIFIED GITHUB REPO", "Upstream linked • Zero leaked secrets"))

    c4_cx = 1340
    c4_w = 310

    svg.append(terminal_pill(c4_cx, 364, 290, 32, "ROUTE: ask / suggest / explain", "Multi-Provider AI Intelligence Layer"))
    svg.append(arrow_line(c4_cx, 380, c4_cx, 405))

    svg.append(box(c4_cx, 430, c4_w, 48, "Context Ingestion & Error Capture", "Captures last 50 lines stderr + package manifest"))
    svg.append(arrow_line(c4_cx, 454, c4_cx, 480))

    svg.append(box(c4_cx, 504, c4_w, 48, "Safety Command Sanitizer", "Regex blocks destructive commands (rm -rf, sudo, dd)"))
    svg.append(arrow_line(c4_cx, 528, c4_cx, 552))

    svg.append(detailed_box(c4_cx, 580, c4_w, 54, "Pluggable Multi-Provider Dispatch", [
        "1. Google Gemini (Gemini 2.0 / 1.5 Flash)",
        "2. Groq Cloud (Llama 3.3) • 3. Local Ollama"
    ]))
    svg.append(arrow_line(c4_cx, 607, c4_cx, 632))

    d4_cx, d4_cy = c4_cx, 666
    svg.append(diamond(d4_cx, d4_cy, 210, 68, "Actionable Terminal Fix?", "Interactive execution decision"))

    svg.append(arrow_line(d4_cx, d4_cy + 34, d4_cx, 735))
    svg.append(branch_label(d4_cx + 34, 718, "YES", is_yes=True))

    svg.append(detailed_box(c4_cx, 762, c4_w, 54, "Interactive [Y/N] Safety Gate", [
        "Displays verified fix • User confirms execution",
        "Executes command directly in Node-PTY shell"
    ]))
    svg.append(arrow_line(c4_cx, 789, c4_cx, 855))

    svg.append(terminal_pill(c4_cx, 876, 290, 42, "AI SOLUTION RESOLVED", "Error fixed • Zero browser copy-pasting"))

    c5_cx = 1720
    c5_w = 310

    svg.append(terminal_pill(c5_cx, 364, 290, 32, "ROUTE: preset / deploy", "State Serialization & Cloud Delivery"))
    svg.append(arrow_line(c5_cx, 380, c5_cx, 405))

    svg.append(box(c5_cx, 430, c5_w, 48, "Workspace State Inspector", "Validates clean git state & directory manifest"))
    svg.append(arrow_line(c5_cx, 454, c5_cx, 480))

    d5_cx, d5_cy = c5_cx, 514
    svg.append(diamond(d5_cx, d5_cy, 160, 68, "Selected Action?", "preset or deploy"))

    svg.append(arrow_line(1640, d5_cy, 1640, 570))
    svg.append(branch_label(1640 - 38, 542, "PRESET", is_yes=True))
    svg.append(detailed_box(1640, 608, 145, 74, "Preset Engine", [
        "Strips node_modules",
        "Serializes clean tree",
        "to JSON blueprint"
    ]))

    svg.append(arrow_line(1640, 645, 1640, 745))
    svg.append(terminal_pill(1640, 765, 145, 34, "PRESET SAVED", "Zero-drift replica"))

    svg.append(arrow_line(1800, d5_cy, 1800, 570))
    svg.append(branch_label(1800 + 38, 542, "DEPLOY", is_yes=True))
    svg.append(detailed_box(1800, 608, 145, 74, "Vercel Cloud", [
        "Direct API Bridge",
        "Validates build output",
        "Streams cloud logs"
    ]))

    svg.append(path_arrow(f"M 1800 645 L 1800 810 L {c5_cx} 810 L {c5_cx} 855"))

    svg.append(terminal_pill(c5_cx, 876, 290, 42, "LIVE PRODUCTION URL", "SSL-secured global deployment (<60s)"))

    svg.append(f'''
    <!-- Bottom Monotone Legend / Metadata -->
    <g>
      <line x1="50" y1="945" x2="1870" y2="945" stroke="{GOLD_MAIN}" stroke-width="1.2" stroke-opacity="0.35"/>
      <text x="960" y="976" font-size="12" font-weight="700" fill="{GOLD_MAIN}" text-anchor="middle" letter-spacing="1">FLOWCHART SYMBOLOGY: Ovals = Terminal Endpoints • Diamonds = Decision Gates • Rectangles = Subsystem Processes</text>
      <text x="960" y="998" font-size="11" font-weight="400" fill="{GOLD_LIGHT}" text-anchor="middle">Greater Noida Institute of Technology (GNIOT) • Department of Computer Science &amp; Engineering • RapidFire CLI v0.1.26</text>
    </g>
    ''')

    svg.append('</svg>')
    return '\n'.join(svg)

if __name__ == "__main__":
    content = generate_flowchart_svg()
    svg_path = "rapidfire_flowchart_for_ppt.svg"
    with open(svg_path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"Generated {svg_path}")

    targets = [
        ("rapidfire_flowchart_canva_4k.png", 3840, 2160),
        ("rapidfire_flowchart_canva_1080p.png", 1920, 1080),
        ("rapidfire_flowchart_upscaled_4k.png", 3840, 2160),
        ("rapidfire_flowchart_1080p.png", 1920, 1080),
    ]

    for filename, w, h in targets:
        cmd = ["rsvg-convert", "-w", str(w), "-h", str(h), "-f", "png", svg_path, "-o", filename]
        subprocess.run(cmd, check=True)
        print(f"Rendered {filename} ({w}x{h})")
