# Setting up the demo server with Claude in Chrome

Paste everything below the line into Claude in Chrome, in a new tab, signed
in to your Google, Supabase, Cloudflare and (once made) Oracle accounts.
It does the clicking; you type every password, key and card number
yourself. About an hour, most of it waiting. It ends with the demo live
at nabl.agency/demo. The written guide it follows
is [`README.md`](README.md) in this folder.

---

You're helping me put my company's AI receptionist demo on a free Oracle
Cloud server and live at nabl.agency/demo. Work in this browser, one step
at a time, and tell me briefly what you did after each step. The full
written guide is at
https://github.com/alxx-22/n.abl/blob/voice-agent-DEV/demo-products/voice-agent/deploy/oracle/README.md
— open it first and keep it in a tab; where this prompt and the guide
differ, the guide wins.

**Rules for the whole job**

- **Secrets are mine to type.** Never type, copy, paste or repeat in chat
  any password, API key, database address with a password in it, or card
  detail. When one is needed, put the cursor in the right box, tell me what
  to type there, and wait for me to say "done". Don't read them back from
  the screen either.
- **Nothing paid.** Everything here is free. Never choose anything that
  isn't marked *Always Free* or free, never upgrade an account, and stop
  and ask me if a page asks for payment, shows a price or says something
  will be charged.
- **Accounts and identity checks are mine.** If a sign-up, a card check, a
  phone code or a captcha appears, hand over to me and wait.
- **Ask before anything that can't be undone** (deleting, resetting a
  password, changing DNS that already exists). Never reset the Supabase
  database password: other things use it.
- Don't change anything not listed below. If something looks different
  from these steps, describe what you see and ask me.

**Step 0. Wake the database (Supabase)**

1. Open https://supabase.com/dashboard and choose the project
   **Persian Persuasion**.
2. If it says it's paused, press **Restore project**, then wait until it
   says it's healthy (refresh every minute or so).
3. Press **Connect** at the top, choose the **Session pooler** tab and show
   me where the connection address is. Don't copy it: I'll copy it myself
   later. It starts `postgresql://postgres.auivrancfnrdwyiqoakt:`.

**Step 1. The Gemini key (Google AI Studio)**

1. Open https://aistudio.google.com/apikey.
2. Ask me whether I already have a key for the demo. If not, press
   **Create API key**, then let me copy it myself. Don't read it out.

**Step 2. The Oracle Cloud account**

1. Open https://www.oracle.com/cloud/free/ and press **Start for free**.
2. Hand over to me for the sign-up. Remind me: **Home Region = Germany
   Central (Frankfurt)** (it can't be changed later), stay on the free tier,
   and the card is only for an identity check. If Oracle refuses the card,
   a different card usually works (it often turns down prepaid and virtual
   ones).
3. When I say I'm signed in to the Oracle Cloud console, carry on.

**Step 3. The server's settings (before creating it)**

Tell me to open a text editor (Notepad or TextEdit) and paste in the file
from
https://raw.githubusercontent.com/alxx-22/n.abl/voice-agent-DEV/demo-products/voice-agent/deploy/oracle/cloud-init.yaml
(open that address in a tab so I can select all and copy it). Then walk me
through replacing the four `PASTE-HERE` values myself:

- `GEMINI_API_KEY`: my key from step 1.
- `DATABASE_URL`: the Session pooler address from step 0, with the database
  password in place of `[YOUR-PASSWORD]` (no square brackets). If the
  password has any of `@ : / ? # [ ] %` in it, stop: tell me to ask Claude
  Code how to write it, because those characters need changing.
- `CONSOLE_PASSWORD`: a long password I make up for the team console.
- `DEMO_PROXY_SECRET`: a long string of letters and numbers I make up (no
  spaces or symbols). I'll need it again in step 7.

Tell me to save both made-up values in my password manager.

**Step 4. Create the server (Oracle console)**

Go to **☰ → Compute → Instances → Create instance** and set:

- **Name**: `nabl-reception`.
- **Image**: **Change image → Ubuntu → Canonical Ubuntu 24.04** (the plain
  one, not "Minimal"). If Oracle says the image doesn't suit the shape,
  choose the shape first and then the image again: it picks the Arm build.
- **Shape**: **Change shape → Ampere → VM.Standard.A1.Flex**, **2 OCPUs**,
  **12 GB** memory. Check it says **Always Free-eligible**; if it doesn't,
  stop and ask me.
- **Networking**: keep *Create new virtual cloud network* and *Create new
  public subnet*, with **Assign a public IPv4 address** on.
- **SSH keys**: **Generate a key pair for me**, then press **Save private
  key** and tell me where the file was saved. I keep it.
- **Advanced options → Management → Initialization script → Paste
  cloud-init script**: put the cursor in the box and ask me to paste my
  filled-in file from step 3. Wait for "done". Don't read the box back.

Then press **Create**. If it says **Out of capacity**: change
**Placement** to another availability domain (AD-2, then AD-3) and try
again. If all three are full, stop and tell me: the guide has what to do
next (try again later, or upgrade, which is my decision).

**Step 5. Let web traffic in**

1. On the instance's page, open its **subnet** (under *Primary VNIC* or
   *Networking*), then the **Default Security List**.
2. **Add Ingress Rules**: Source CIDR `0.0.0.0/0`, IP protocol **TCP**,
   destination port **80**. Then **+ Another ingress rule**: Source CIDR
   `0.0.0.0/0`, **TCP**, port **443**. Save.
3. Back on the instance's page, tell me its **Public IP address** (that's
   not a secret).

**Step 6. The web address (Cloudflare DNS)**

1. Open https://dash.cloudflare.com, choose **nabl.agency → DNS →
   Records**.
2. If a record named `demo-origin` already exists, stop and ask me.
   Otherwise **Add record**: Type **A**, Name `demo-origin`, IPv4 address
   = the public IP from step 5, **Proxy status off** (grey cloud, *DNS
   only*). Save.

**Step 7. The shared secret (Cloudflare Worker)**

1. In Cloudflare: **Workers & Pages →** the site's Worker (`n-abl`) **→
   Settings → Variables and Secrets → Add**.
2. Type **Secret**, name `DEMO_PROXY_SECRET`. Put the cursor in the value
   box and ask me to type the same value as in step 3. Wait for "done",
   then save and deploy.

**Step 8. Check it**

1. About 10–15 minutes after step 4, open
   https://demo-origin.nabl.agency/demo/healthz. It should show
   `{"ok":true,"calls":0,"version":"…"}`. If it doesn't load yet, wait
   five minutes and try again, up to half an hour.
2. Then open https://demo-origin.nabl.agency/demo/admin and hand over to
   me to sign in with the console password. Once I'm in, help me issue
   myself a key (name, company, **Issue a private key**) and open the demo
   with it.
3. Tell me to try it on my phone too.

**If step 8 doesn't work after half an hour**

1. In the Oracle console, open **Cloud Shell** (the `>_` button at the
   top).
2. Ask me to upload the private key from step 4 with Cloud Shell's own
   menu (top right of the Cloud Shell window) → **Upload**.
3. In Cloud Shell, type these (the IP is the public IP from step 5):

   ```
   chmod 600 ssh-key-*.key
   ssh -i ssh-key-*.key ubuntu@<public IP>
   sudo nabl status
   sudo tail -n 60 /var/log/nabl-install.log
   ```

   (Answer `yes` if it asks about the host's fingerprint.)
4. Show me what it says, in plain words, and stop. If it mentions
   `secrets.env` or a `PASTE-HERE` value, the fix is
   `sudo nano /opt/nabl/secrets.env` (I type the value), then
   `sudo nabl deploy`. Anything else: I'll take it to Claude Code. Never
   paste the contents of `secrets.env` anywhere.

**Step 9. Go live on nabl.agency** (only once step 8 works)

1. Open https://github.com/alxx-22/n.abl/pull/2 ("The AI receptionist
   demo at nabl.agency/demo"). Check it says it can be merged. Hand over to
   me to press **Merge pull request** and confirm (or press it yourself
   once I say "merge it").
2. In Cloudflare: **Workers & Pages → n-abl → Deployments**. A new
   build from `main` starts within a minute or two. Wait until it says
   it's deployed (refresh every minute; usually under five). If the build
   fails, stop and tell me what it says.
3. Open https://nabl.agency/demo/healthz: it should show
   `{"ok":true,…}`. Then https://nabl.agency (the normal site should look
   as before), and https://nabl.agency/demo/admin, where I sign in.
4. Tell me to open https://nabl.agency/demo/reception on my phone with my
   key and make a test call.

**When it's all working, finish by telling me**

- The demo's address: https://nabl.agency/demo/reception (the team console
  is https://nabl.agency/demo/admin). The server's own address,
  https://demo-origin.nabl.agency/demo/reception, keeps working too.
- That Oracle may stop a free server it thinks is idle; if the demo stops
  answering, **Compute → Instances → Start** brings it back with nothing
  lost.
