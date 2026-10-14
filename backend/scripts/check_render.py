import urllib.request
import ssl
import re
import time
import json

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

url = "https://medicare-ai-iv31.onrender.com"

for attempt in range(1, 2):
    print(f"Polling Render (attempt {attempt}/1)...", flush=True)
    try:
        req = urllib.request.Request(f"{url}/", headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, context=ctx, timeout=30) as resp:
            html = resp.read().decode("utf-8", errors="ignore")
            scripts = re.findall(r'src="([^"]+)"', html)
            css = re.findall(r'href="([^"]+\.css)"', html)
            print(f"Status: {resp.status}", flush=True)
            print("CSS:", css, flush=True)
            print("Scripts:", scripts, flush=True)
            if any("index-Cr7TuGBo" in s for s in scripts) or any("index-DVB9OdQu" in c for c in css):
                print(">>> SUCCESS: Latest commit build 59f4b327 is LIVE on Render! <<<", flush=True)
                break
    except Exception as e:
        print(f"Attempt {attempt} failed / waiting: {e}", flush=True)
    time.sleep(10)
