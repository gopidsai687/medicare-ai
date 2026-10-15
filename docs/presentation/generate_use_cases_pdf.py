"""
MediCare AI — Real-World Use Cases Specification PDF Generator
Renders docs/presentation/MEDICARE_AI_USE_CASES_SPECIFICATION.md into a publication-grade PDF
at docs/presentation/MediCare_AI_Use_Cases_Specification.pdf using Microsoft Edge headless rendering.
"""
import os
import sys
import subprocess
import shutil
from pathlib import Path
import markdown
import pypdf

INPUT_MD = Path("docs/presentation/MEDICARE_AI_USE_CASES_SPECIFICATION.md")
OUTPUT_PDF = Path("docs/presentation/MediCare_AI_Use_Cases_Specification.pdf")
TEMP_HTML = Path(os.environ.get("TEMP", "C:/Temp")) / "medicare_use_cases_spec.html"
TEMP_PDF = Path(os.environ.get("TEMP", "C:/Temp")) / "medicare_use_cases_spec.pdf"
EDGE_EXE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"

def generate_pdf():
    if not INPUT_MD.exists():
        print(f"Error: {INPUT_MD} does not exist.")
        sys.exit(1)

    raw_md = INPUT_MD.read_text(encoding="utf-8")

    # Replace markdown links with bold text or clean links for printing
    html_content = markdown.markdown(raw_md, extensions=['tables', 'fenced_code'])

    # Style status pills
    html_content = html_content.replace(
        "<code>VERIFIED LIVE</code>",
        '<span class="badge badge-green">VERIFIED LIVE</span>'
    ).replace(
        "<code>VERIFIED LIVE / FALLBACK ACTIVE</code>",
        '<span class="badge badge-amber">VERIFIED LIVE / FALLBACK ACTIVE</span>'
    ).replace(
        "<code>SIMULATION ONLY / RESEARCH PROTOTYPE</code>",
        '<span class="badge badge-purple">SIMULATION ONLY / RESEARCH PROTOTYPE</span>'
    )

    full_html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>MediCare AI — 10 Real-World Clinical & Technical Use Cases</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Outfit:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');

  @page {{
    size: letter portrait;
    margin: 18mm 16mm 18mm 16mm;
    @top-right {{
      content: "MediCare AI — Real-World Use Cases Specification";
      font-family: 'Inter', sans-serif;
      font-size: 8pt;
      color: #94a3b8;
    }}
    @bottom-center {{
      content: "Confidential & Pre-Clinical Technology Audit — Version 1.0.0";
      font-family: 'Inter', sans-serif;
      font-size: 7.5pt;
      color: #94a3b8;
    }}
    @bottom-right {{
      content: "Page " counter(page);
      font-family: 'Inter', sans-serif;
      font-size: 8pt;
      font-weight: 600;
      color: #0f172a;
    }}
  }}

  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    color: #1e293b;
    background: #ffffff;
    font-size: 9pt;
    line-height: 1.55;
  }}

  h1, h2, h3, h4 {{
    font-family: 'Outfit', sans-serif;
    color: #0f172a;
    font-weight: 700;
  }}

  h1 {{
    font-size: 20pt;
    line-height: 1.25;
    color: #090e17;
    border-bottom: 2.5px solid #00b4d8;
    padding-bottom: 8px;
    margin-bottom: 14px;
    margin-top: 10px;
  }}

  h2 {{
    font-size: 14pt;
    line-height: 1.3;
    color: #0284c7;
    margin-top: 22px;
    margin-bottom: 10px;
    border-bottom: 1px solid #e2e8f0;
    padding-bottom: 5px;
    page-break-after: avoid;
  }}

  h3 {{
    font-size: 11.5pt;
    line-height: 1.35;
    color: #0f172a;
    margin-top: 18px;
    margin-bottom: 8px;
    page-break-after: avoid;
    background: #f8fafc;
    padding: 6px 10px;
    border-left: 4px solid #0284c7;
    border-radius: 4px;
  }}

  h4 {{
    font-size: 9.5pt;
    color: #334155;
    margin-top: 10px;
    margin-bottom: 4px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    page-break-after: avoid;
  }}

  p {{
    margin-bottom: 8px;
    text-align: justify;
  }}

  ul, ol {{
    margin-left: 20px;
    margin-bottom: 10px;
  }}

  li {{
    margin-bottom: 4px;
  }}

  code {{
    font-family: 'JetBrains Mono', monospace;
    font-size: 8pt;
    background: #f1f5f9;
    padding: 2px 5px;
    border-radius: 4px;
    color: #0369a1;
  }}

  pre {{
    background: #090e17;
    color: #f8fafc;
    padding: 12px;
    border-radius: 6px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 7.5pt;
    line-height: 1.4;
    overflow-x: auto;
    margin-bottom: 12px;
    page-break-inside: avoid;
  }}

  pre code {{
    background: transparent;
    color: #38bdf8;
    padding: 0;
  }}

  table {{
    width: 100%;
    border-collapse: collapse;
    margin-top: 10px;
    margin-bottom: 16px;
    font-size: 8pt;
    page-break-inside: avoid;
  }}

  th, td {{
    padding: 6px 8px;
    border: 1px solid #cbd5e1;
    text-align: left;
    vertical-align: top;
  }}

  th {{
    background: #0f172a;
    color: #ffffff;
    font-weight: 600;
    font-size: 8pt;
  }}

  tr:nth-child(even) td {{
    background: #f8fafc;
  }}

  hr {{
    border: none;
    border-top: 1px solid #e2e8f0;
    margin: 16px 0;
  }}

  .badge {{
    display: inline-block;
    padding: 2px 7px;
    border-radius: 12px;
    font-size: 7.5pt;
    font-weight: 700;
    letter-spacing: 0.4px;
    text-transform: uppercase;
  }}

  .badge-green {{
    background: #d1fae5;
    color: #065f46;
    border: 1px solid #a7f3d0;
  }}

  .badge-amber {{
    background: #fef3c7;
    color: #92400e;
    border: 1px solid #fde68a;
  }}

  .badge-purple {{
    background: #f3e8ff;
    color: #6b21a8;
    border: 1px solid #e9d5ff;
  }}
</style>
</head>
<body>
{html_content}
</body>
</html>
"""

    TEMP_HTML.write_text(full_html, encoding="utf-8")
    print(f"Wrote temporary HTML to {TEMP_HTML}")

    if not os.path.exists(EDGE_EXE):
        print(f"Error: Edge executable not found at {EDGE_EXE}")
        sys.exit(1)

    cmd = [
        EDGE_EXE,
        "--headless",
        "--disable-gpu",
        "--allow-file-access-from-files",
        f"--print-to-pdf={TEMP_PDF}",
        "--no-pdf-header-footer",
        str(TEMP_HTML)
    ]

    print("Running Edge headless print-to-pdf...")
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        print(f"Edge error: {res.stderr}")
        sys.exit(1)

    if not TEMP_PDF.exists():
        print(f"Error: {TEMP_PDF} was not created.")
        sys.exit(1)

    shutil.copy2(TEMP_PDF, OUTPUT_PDF)
    print(f"Successfully generated {OUTPUT_PDF}")

    # Inspect with PyPDF
    reader = pypdf.PdfReader(str(OUTPUT_PDF))
    print(f"Verified PDF: {len(reader.pages)} pages in {OUTPUT_PDF}")

if __name__ == "__main__":
    generate_pdf()
