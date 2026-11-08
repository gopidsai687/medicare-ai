import sys
sys.path.insert(0, 'backend')
import asyncio, json
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.security import create_access_token

async def check():
    token = create_access_token('39a6b53f-5b14-44cb-b02f-d308fa33dd02', 'patient')
    headers = {'Authorization': f'Bearer {token}'}
    async with AsyncClient(transport=ASGITransport(app=app), base_url='http://test') as ac:
        dash_resp = await ac.get('/api/v1/patients/dashboard', headers=headers)
        d = dash_resp.json()
        print('Stats:', json.dumps(d.get('stats'), indent=2))
        print('\nVitals Summary:')
        for k, v in d.get('vitals', {}).items():
            print(f"  {k}: value={v.get('value')} {v.get('unit')}, status={v.get('status')}, has_data={v.get('has_data')}, src={v.get('source')}")
        print('\nRecent Activity (Top 6):')
        for a in d.get('recent_activity', [])[:6]:
            print(f"  [{a.get('type')}] {a.get('title')} ({a.get('date')}) - {a.get('status')}")

asyncio.run(check())
