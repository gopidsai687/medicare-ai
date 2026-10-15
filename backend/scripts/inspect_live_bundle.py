import urllib.request
import re

url = "https://medicare-ai-iv31.onrender.com/"
req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})

try:
    with urllib.request.urlopen(req, timeout=45) as resp:
        html = resp.read().decode("utf-8")
        headers = dict(resp.getheaders())
        print(f"Status: {resp.status}")
        print(f"Server / Date: {headers.get('date', 'unknown')}")
        print(f"Content-Type: {headers.get('content-type', 'unknown')}")
        print(f"Cache-Control: {headers.get('cache-control', 'none')}")
        
        scripts = re.findall(r'src=["\']([^"\']+)["\']', html)
        print("Scripts in index.html:")
        for s in scripts:
            print("  ", s)
            
        css = re.findall(r'href=["\']([^"\']+\.css)["\']', html)
        print("CSS in index.html:")
        for c in css:
            print("  ", c)
            
        # Also check if sw.js is fetched
        sw_req = urllib.request.Request(url + "sw.js", headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(sw_req, timeout=10) as sw_resp:
            print("sw.js Status:", sw_resp.status)
            print("sw.js Cache-Control:", sw_resp.getheader("cache-control"))

        # Let's inspect the main JS file to see what dynamic chunks it references
        if scripts:
            main_js_url = url.rstrip('/') + scripts[0] if scripts[0].startswith('/') else scripts[0]
            print("\nFetching main JS:", main_js_url)
            with urllib.request.urlopen(urllib.request.Request(main_js_url, headers={"User-Agent": "Mozilla/5.0"}), timeout=15) as js_resp:
                js_content = js_resp.read().decode("utf-8", errors="ignore")
                # find chunks referenced
                chunks = set(re.findall(r'assets/([A-Za-z0-9_\-]+-[A-Za-z0-9_\-]+\.js)', js_content))
                print(f"Main bundle references {len(chunks)} dynamic chunks.")
                sample_chunks = list(chunks)[:10]
                print("Sample chunks referenced:")
                for sc in sample_chunks:
                    print("  ", sc)
                
                # Check if some chunks exist on the server
                for test_chunk in ["MedicalReportAnalysis", "PrescriptionAnalysis", "Appointments", "Settings"]:
                    matching = [c for c in chunks if test_chunk in c]
                    for m in matching:
                        chunk_url = url + "assets/" + m
                        try:
                            with urllib.request.urlopen(urllib.request.Request(chunk_url, headers={"User-Agent": "Mozilla/5.0"}), timeout=10) as c_resp:
                                print(f"  Chunk {m}: {c_resp.status} OK ({c_resp.getheader('content-length')} bytes)")
                        except Exception as ce:
                            print(f"  Chunk {m}: FAILED ({ce})")

except Exception as e:
    print("Failed to inspect live site:", e)
