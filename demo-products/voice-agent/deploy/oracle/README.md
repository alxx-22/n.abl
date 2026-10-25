# The demo on Oracle Cloud's free server

The demo server runs on Oracle Cloud's **Always Free** tier: an Arm server
with 2 processors and 12 GB of memory that stays on, at no cost. It sits in
Frankfurt, beside the Supabase database. Caddy gives it HTTPS at
`demo-origin.nabl.agency`, and the site's Worker forwards
`nabl.agency/demo/*` to it.

Once set up it looks after itself. Every five minutes it checks GitHub, and
a push to `voice-agent-DEV` goes live a few minutes later, once any call in
progress has ended. If a new build fails, the previous one keeps running.

This is where prospects use the demo. The GitHub Codespace
(`.devcontainer/voice-agent`) stays for building and testing it.

About 30 minutes, once. You need:

- **A Gemini API key** from [Google AI Studio](https://aistudio.google.com/apikey).
- **The Supabase database password** for the project (Persian Persuasion).
  If nobody has it, ask whoever built the chatbot in the same project before
  resetting it: a reset changes it for everything that uses it.
- **A card for Oracle's identity check.** It is not charged on the free
  tier, but a small temporary hold may appear.
- **The Supabase project awake** (step 0).

## 0. Wake the database

Supabase pauses a free project after a week with nothing using it, and the
server can't start against a paused one.

1. Open [supabase.com/dashboard](https://supabase.com/dashboard) and choose
   the project **Persian Persuasion**.
2. If it says the project is **paused**, press **Restore project** and wait
   until it says it is healthy (a few minutes). It is shared with the
   chatbot, which wakes up too; nothing in it changes.

Once the server is running it keeps the database awake: it checks it every
30 seconds.

## 1. Make an Oracle Cloud account

1. Go to [oracle.com/cloud/free](https://www.oracle.com/cloud/free/) and press
   **Start for free**.
2. For **Home Region**, choose **Germany Central (Frankfurt)**. This can't be
   changed later. It's next to the database, and free servers are usually
   easier to get there than in London.
3. Finish the sign-up, including the card check. Stay on the free tier: don't
   upgrade.

## 2. Fill in the server's settings

1. Open [`cloud-init.yaml`](cloud-init.yaml) and copy all of it into a text
   editor (Notepad or TextEdit).
2. Replace each of the four `PASTE-HERE`:
   - **`GEMINI_API_KEY`**: your Gemini key.
   - **`DATABASE_URL`**: in Supabase, open the project, press **Connect** at
     the top, choose **Session pooler**, and copy the address. It starts
     `postgresql://postgres.auivrancfnrdwyiqoakt:`. Put the database password
     where it says `[YOUR-PASSWORD]`, without the square brackets. If the
     password has any of `@ : / ? # [ ] %` in it, ask Claude first: those
     characters need writing differently.
   - **`CONSOLE_PASSWORD`**: make one up, long. It's the password for the
     team console.
   - **`DEMO_PROXY_SECRET`**: make up a long string of letters and numbers.
     Keep it: step 6 uses it again.

## 3. Create the server

In the Oracle console: **☰ → Compute → Instances → Create instance**.

- **Name**: `nabl-reception`.
- **Image**: **Change image → Ubuntu → Canonical Ubuntu 24.04**, the plain one
  (not "Minimal").
- **Shape**: **Change shape → Ampere → VM.Standard.A1.Flex**, with **2 OCPUs**
  and **12 GB** of memory. It should say *Always Free-eligible*.
- **Networking**: keep *Create new virtual cloud network* and *Create new
  public subnet*, with **Assign a public IPv4 address** on.
- **SSH keys**: **Generate a key pair for me**, then **Save private key** and
  keep the file. It's only needed if something goes wrong (see the end of
  this guide).
- **Advanced options → Management → Initialization script → Paste
  cloud-init script**: paste your filled-in file.

Press **Create**. If it says **Out of capacity**, change **Placement** to
another availability domain (AD-2 or AD-3) and try again. Failing that, try
again later: free servers come free during the day. If it keeps saying it,
upgrade the account to **Pay As You Go** (**☰ → Billing & Cost Management →
Upgrade and Manage Payment**): free Arm servers are usually there straight
away then, and nothing is charged while you only use *Always Free*
resources. To be sure, add a budget of £1 with an email alert (**Billing &
Cost Management → Budgets**).

The server then sets itself up, which takes about ten minutes.

## 4. Let web traffic in

Oracle's network only lets in SSH until you add rules for the web.

1. On the instance's page, open its **subnet**: under **Networking** or
   *Primary VNIC*.
2. Open the subnet's **Default Security List**, then **Add Ingress Rules**:
   - Source CIDR `0.0.0.0/0`, IP protocol **TCP**, destination port **80**.
   - **+ Another ingress rule**: Source CIDR `0.0.0.0/0`, **TCP**, port **443**.
3. Save.

## 5. Give it its web address

1. On the instance's page, copy the **Public IP address**.
2. In Cloudflare: **nabl.agency → DNS → Records → Add record**:
   - **Type** A
   - **Name** `demo-origin`
   - **IPv4 address**: the public IP
   - **Proxy status** off: the grey cloud, *DNS only*. The server gets its own
     HTTPS certificate and needs to be reached directly to do it.
3. Save.

## 6. Give the site's Worker the shared secret

In Cloudflare: **Workers & Pages →** the site's Worker **→ Settings →
Variables and Secrets → Add**. Choose type **Secret**, name
`DEMO_PROXY_SECRET`, and the same value as in step 2. Save and deploy.

## 7. Check it

After about ten minutes, open
[`https://demo-origin.nabl.agency/demo/healthz`](https://demo-origin.nabl.agency/demo/healthz).
It should show `{"ok":true,"calls":0,"version":"…"}`.

Then open
[`https://demo-origin.nabl.agency/demo/admin`](https://demo-origin.nabl.agency/demo/admin),
sign in with the console password, and issue yourself a key.

**On nabl.agency itself**: the forwarding from `nabl.agency/demo` is on the
`voice-agent-DEV` branch. It goes live when that branch is merged into
`main`: merge [pull request #2](https://github.com/alxx-22/n.abl/pull/2)
once step 7 works, and Cloudflare deploys the site a few minutes later.
Outside the demo's own folder the merge changes only the site's Worker
(the forwarding), `wrangler.jsonc`, `robots.txt` and a test: the site's
pages stay as they are. Until then, use `demo-origin.nabl.agency`.

## Afterwards

- **When a client signs and pays, turn on billing for the Gemini key**
  (Alex's decision, 25 October: demos for prospects stay on the free tier).
  In AI Studio, set up billing for the key's project: the key itself stays
  the same. At published prices that's about 2p a call minute, and the
  demo's per-key limits cap the minutes.
- **If the site stops answering**: Oracle stops free servers it considers idle
  for a week (very little processor, memory and network use), and a quiet demo
  can count. Start it again from **Compute → Instances**. Nothing is lost,
  because the data lives in Supabase. Upgrading the account to Pay As You Go
  stops this happening, and it stays free as long as you only use Always Free
  resources.
- **Changing a setting, or looking at what's wrong**: open **Cloud Shell**
  (the `>_` button at the top of the Oracle console), upload the private key
  from step 3 using Cloud Shell's menu, then run:

  ```bash
  chmod 600 ssh-key-*.key
  ssh -i ssh-key-*.key ubuntu@<public IP>
  sudo nabl status                     # what is running, and the end of its log
  sudo nano /opt/nabl/secrets.env      # change a setting, then:
  sudo nabl deploy
  sudo cat /var/log/nabl-install.log   # how the first setup went
  ```

## What the script does

[`nabl.sh`](nabl.sh), which cloud-init fetches and runs on the first boot:

- installs Docker, Caddy and git;
- opens ports 80 and 443 in Ubuntu's firewall;
- stops the app's container from reaching Oracle's metadata service, where
  cloud-init's settings are kept;
- lets the website scout's Chromium run in its own sandbox: the container
  gets Docker's default seccomp filter plus the four calls the sandbox
  needs ([`seccomp-chromium.json`](seccomp-chromium.json)), and Ubuntu's
  limit on user namespaces goes back to how 22.04 shipped;
- fetches only `demo-products/voice-agent` from GitHub;
- builds the image and runs it on localhost, with Caddy in front for HTTPS;
- installs a timer that runs `nabl update` every five minutes.

The app's settings come from `/opt/nabl/secrets.env`, plus four the script
adds:

- a `SESSION_SECRET` that lasts across restarts, so people stay signed in;
- `CLIENT_IP_HEADER=x-real-ip`, so the key throttle sees each visitor's real
  address, which Caddy sets on every request;
- `MAX_CONCURRENT_CALLS=3`;
- `CHROMIUM_SANDBOX=on`, so the scout renders prospects' sites inside
  Chromium's sandbox (if it can't start, the scout reads the site's
  stylesheets instead and `sudo nabl status` shows a warning).

The database connection is encrypted and its certificate checked: the
session pooler's is signed by a public authority, and Supabase's own root
(for the direct address) ships with the code.
