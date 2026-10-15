import os
import re

ASSETS_DIR = "backend/static/assets"
js_files = [f for f in os.listdir(ASSETS_DIR) if f.endswith(".js")]

missing = set()
for js_file in js_files:
    content = open(os.path.join(ASSETS_DIR, js_file), encoding="utf-8", errors="ignore").read()
    # Match both static and dynamic imports
    matches = re.findall(r'[\'"](\./[a-zA-Z0-9_\-\.]+\.js)[\'"]', content)
    for m in matches:
        target = m.replace("./", "")
        if not os.path.exists(os.path.join(ASSETS_DIR, target)):
            missing.add(target)

if missing:
    print(f"Missing {len(missing)} referenced chunks:")
    for m in sorted(missing):
        print("  -", m)
else:
    print("ALL referenced chunks exist! Zero missing chunks.")
