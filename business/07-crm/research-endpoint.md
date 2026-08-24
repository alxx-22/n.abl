# Setting up your research endpoint

Each person runs their own. Your runs go through **your** Claude subscription,
never anyone else's — which is the whole reason this is per-user rather than
one shared box.

The CRM never learns your endpoint's address or its token. It sends a lead id;
the edge function looks up whose endpoint to ask.

---

## What you are building

```
CRM  →  Supabase edge function  →  Cloudflare Tunnel  →  your VM  →  Claude Code CLI
        (checks it is you,          (no open ports)      (proxy on      (your
         and your hourly limit)                           :3456)      subscription)
```

Nothing listens on the public internet. `cloudflared` dials **out** from the
VM, so the firewall stays shut and there is no IP to find.

## 1. A machine that is always on

**Oracle Cloud Always Free** — an Ampere ARM instance, free indefinitely rather
than a trial. Google Cloud's `e2-micro` always-free tier works too.

Ubuntu 22.04 or later. When it asks about ingress rules, add none.

```bash
sudo apt update && sudo apt install -y curl
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node --version    # expect v22
```

## 2. Log the CLI in

```bash
npm install -g @anthropic-ai/claude-code
claude login
```

It prints a URL. Open it on your own machine, approve, paste the code back.
The session persists on the VM and refreshes itself.

**This session is your Claude account.** Treat the VM accordingly: SSH keys
only, password authentication off, and nothing else running on it.

```bash
sudo sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
sudo systemctl restart ssh
```

## 3. The proxy

```bash
npm install -g claude-max-api-proxy
claude-max-api-proxy      # listens on 127.0.0.1:3456
```

Keep it running:

```bash
sudo tee /etc/systemd/system/claude-proxy.service >/dev/null <<'UNIT'
[Unit]
Description=Claude API proxy
After=network.target

[Service]
ExecStart=/usr/bin/claude-max-api-proxy
Restart=always
User=ubuntu
Environment=HOME=/home/ubuntu

[Install]
WantedBy=multi-user.target
UNIT
sudo systemctl enable --now claude-proxy
```

Check it before going further:

```bash
curl -s localhost:3456/v1/chat/completions \
  -H 'content-type: application/json' \
  -d '{"model":"claude-opus-5","messages":[{"role":"user","content":"Reply with the word: ready"}]}'
```

**Also test whether it can read a web page**, because the whole feature depends
on it:

```bash
curl -s localhost:3456/v1/chat/completions \
  -H 'content-type: application/json' \
  -d '{"model":"claude-opus-5","messages":[{"role":"user","content":"Read https://nabl.agency and tell me in one sentence what this business does."}]}'
```

If it answers from the page, the CLI's own web tools are reaching through and
the prompt in `research-lead` works as written. If it says it cannot browse,
say so — the function needs to fetch pages itself instead, which is a change
to that file rather than to any of this.

## 4. The tunnel

```bash
curl -L -o cloudflared https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64
sudo mv cloudflared /usr/local/bin/ && sudo chmod +x /usr/local/bin/cloudflared
cloudflared tunnel login
cloudflared tunnel create research-alex
cloudflared tunnel route dns research-alex research-alex.nabl.agency
```

`~/.cloudflared/config.yml`:

```yaml
tunnel: research-alex
credentials-file: /home/ubuntu/.cloudflared/<TUNNEL-ID>.json
ingress:
  - hostname: research-alex.nabl.agency
    service: http://localhost:3456
  - service: http_status:404
```

```bash
sudo cloudflared service install
sudo systemctl enable --now cloudflared
```

## 5. Lock the hostname to the edge function

Cloudflare → **Zero Trust → Access → Applications → Add** a self-hosted app for
`research-alex.nabl.agency`. One policy: **Action Service Auth**, include
**Service Token**, and create a token named something like `supabase-edge`.

Copy the Client ID and Client Secret. Without this the tunnel hostname is
open to anyone who guesses it.

## 6. Register it

Once, as yourself, signed in to the team space:

```sql
insert into public.research_endpoints (user_id, url, service_token, label)
values (
  auth.uid(),
  'https://research-alex.nabl.agency',
  '<CLIENT_ID>:<CLIENT_SECRET>',
  'Oracle free tier'
);
```

The token is stored where **you cannot read it back** — a column grant, not
just row security, because the row itself is yours to read. Only the edge
function, running as the service role, can.

## 7. Deploy and switch on

```bash
supabase functions deploy research-lead
```

Then set `VITE_RESEARCH_URL` to that function's URL in the Cloudflare Pages
build environment and redeploy. Until it is set, the CRM's **Research this
lead** button is visible and disabled, and says why.

---

## Adding someone else

Everything above, with their own VM, their own `claude login`, their own
tunnel hostname, their own service token, their own row. Nothing is shared —
that is the point. Their runs come out of their subscription and their hourly
limit is theirs.

## Limits

`runs_per_hour` defaults to 20 per person and is enforced by a database
trigger, not by the edge function, so a second caller cannot route around it.
Failed runs count: one that crashed still spent your allowance, and a limit
counting only successes is one an error loop walks straight through.

## When it breaks

| What the CRM says | What it means |
|---|---|
| *no research endpoint registered* | Step 6 not done, or done as the wrong user |
| *rate limit: N runs in the last hour* | Working as intended; wait |
| *this research endpoint is disabled* | `enabled` is false on your row |
| *Your endpoint did not answer in time* | VM off, proxy stopped, or the read took over two minutes |
| *Your research endpoint returned 502* | Tunnel up, proxy down — `systemctl status claude-proxy` |
| *returned 403* | Access policy or service token wrong |
| *The reply could not be read as JSON* | The proxy answered but not in the expected shape; the raw text comes back with the error |

Your own runs are in `research_runs`, with the verbatim error on each.
