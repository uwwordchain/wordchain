#!/usr/bin/env python3
"""
Polls the Twilio A2P campaign status and emails a notification (via Resend)
when it leaves IN_PROGRESS. Designed to run every 10 minutes from launchd
(~/Library/LaunchAgents/com.uwwordchain.a2pcheck.plist). Sends at most one
email, then marks itself done via a state file.

Remove with:
  launchctl bootout gui/$(id -u)/com.uwwordchain.a2pcheck
  rm ~/Library/LaunchAgents/com.uwwordchain.a2pcheck.plist
"""
import json
import base64
import pathlib
import urllib.request

ENV_FILE = pathlib.Path(__file__).resolve().parent.parent / '.env.local'
DONE_FILE = pathlib.Path.home() / '.uwwordchain-a2p-notified'
NOTIFY_EMAIL = 'elenoraha@gmail.com'
MESSAGING_SERVICE_SID = 'MGc02d23997d9e7031105fd15f2f0abe15'

if DONE_FILE.exists():
    raise SystemExit(0)

env = {}
for line in ENV_FILE.read_text().splitlines():
    line = line.strip()
    if '=' in line and not line.startswith('#'):
        k, v = line.split('=', 1)
        env[k] = v.strip().strip('"')

sid, tok = env['TWILIO_ACCOUNT_SID'], env['TWILIO_AUTH_TOKEN']
auth = base64.b64encode(f'{sid}:{tok}'.encode()).decode()

req = urllib.request.Request(
    f'https://messaging.twilio.com/v1/Services/{MESSAGING_SERVICE_SID}/Compliance/Usa2p',
    headers={'Authorization': f'Basic {auth}'})
data = json.load(urllib.request.urlopen(req))
statuses = [c.get('campaign_status') for c in data.get('compliance', [])]
status = statuses[0] if statuses else 'UNKNOWN'
print(f'campaign status: {status}')

if status in ('IN_PROGRESS', 'PENDING', 'UNKNOWN'):
    raise SystemExit(0)

# Status changed — send the notification
subject = ('✅ Twilio A2P campaign APPROVED — texting is live'
           if status == 'VERIFIED'
           else f'⚠️ Twilio A2P campaign status: {status}')
body = (
    f'<p>The UW WordChain A2P campaign status is now: <strong>{status}</strong>.</p>'
    + ('<p>Texts from +1 (608) 830-1449 will now deliver. '
       'Make sure TWILIO_PHONE_NUMBER is set in Vercel, then run a live test.</p>'
       if status == 'VERIFIED'
       else '<p>Check the Twilio Console (Trust Hub → A2P campaigns) for details and next steps.</p>')
)
email = json.dumps({
    'from': 'UW WordChain <noreply@uwwordchain.app>',
    'to': [NOTIFY_EMAIL],
    'subject': subject,
    'html': body,
}).encode()
req = urllib.request.Request('https://api.resend.com/emails', data=email, headers={
    'Authorization': f"Bearer {env['RESEND_API_KEY']}",
    'Content-Type': 'application/json',
}, method='POST')
resp = json.load(urllib.request.urlopen(req))
print('notification sent:', resp.get('id'))
DONE_FILE.write_text(status)
