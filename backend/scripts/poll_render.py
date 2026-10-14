import time
import urllib.request
import json

URL = "https://medicare-ai-iv31.onrender.com/api/health"
print("Polling Render deployment at:", URL)

for attempt in range(1, 25):
    try:
        req = urllib.request.Request(URL, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=12) as res:
            if res.status == 200:
                body = res.read().decode()
                print(f"Render is LIVE! Status: 200, Response: {body}")
                break
    except Exception as exc:
        print(f"Attempt {attempt}/25: Render deploying/waking up... ({exc})")
    time.sleep(10)
