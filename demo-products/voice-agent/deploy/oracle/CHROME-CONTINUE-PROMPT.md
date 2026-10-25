# Continuing the setup in Claude in Chrome (Oracle account made)

Paste below the line into the same Claude in Chrome conversation once the
Oracle account exists and you're signed in to the Oracle Cloud console.

---

Update: the Oracle Cloud account is made and I'm signed in to the console.
Claude Code has already done step 0 (the Supabase project is restored), so
skip it. For `DATABASE_URL` in step 3 use this, with my database password in
place of `[YOUR-PASSWORD]` (I type that part):
`postgresql://postgres.auivrancfnrdwyiqoakt:[YOUR-PASSWORD]@aws-0-eu-central-1.pooler.supabase.com:5432/postgres`

If the Gemini key from step 1 isn't made yet, do step 1 first (a new key in
its own project, and never set up billing there). Then carry on from step 3.

**Cost rules for everything from here. These override anything else.**

The account is on Oracle's Free Tier with trial credits. It can't be charged
unless it's upgraded, but anything that isn't Always Free uses up the trial
credits and is deleted when the trial ends, which would take the demo down.
So:

1. **Never upgrade or touch billing.** Don't press or open anything named
   Upgrade, Pay As You Go, Upgrade and Manage Payment, Add payment method,
   Billing & Cost Management, Subscriptions or Monthly Flex, in Oracle,
   Google AI Studio or Cloudflare. If a page pushes you there, stop and ask
   me.
2. **Only Always Free resources, and only these:** one compute instance,
   the virtual cloud network and public subnet the instance wizard creates
   for it, and the two ingress rules in step 5. Create nothing else: no
   block volumes, load balancers, reserved public IPs, NAT gateways,
   databases, buckets, Kubernetes, functions, vaults or alarms.
3. **Region: the home region only** (Germany Central (Frankfurt)). Always
   Free resources only exist there. If the console shows another region in
   the top bar, switch back before doing anything.
4. **The shape is the trap.** The create-instance page often starts on a
   paid AMD or Intel shape (for example VM.Standard.E4.Flex or E5.Flex).
   Always press **Change shape → Ampere → VM.Standard.A1.Flex** and set
   **2 OCPUs and 12 GB** (no more; 1 OCPU and 6 GB is also free if 2 won't
   fit). It must say **Always Free-eligible** beside the shape. If it doesn't,
   stop and ask me.
5. **Image:** Canonical Ubuntu 24.04 (not Minimal). It must also show as
   Always Free-eligible.
6. **Leave these as they are:** the boot volume (don't set a custom size or
   higher performance), capacity type (on-demand: never dedicated host,
   capacity reservation or preemptible), and the public IP (the default
   ephemeral one, never a reserved one).
7. **Before pressing Create**, check the summary. If it shows an estimated
   cost, it must be 0. If it shows any price, a "not eligible for Always
   Free" note, or anything you're unsure of, stop and tell me what it says.
8. **Out of capacity:** try availability domains AD-2 and AD-3, then 1 OCPU
   and 6 GB. If none works, stop and tell me. Never upgrade to get capacity.
9. **Cloudflare and GitHub:** only the DNS record (step 6), the Worker
   secret (step 7) and merging the pull request (step 9). Don't change any
   plan or turn on any add-on.
10. **Secrets are still mine to type**, as before: never type, copy or read
    back a password, key, the database address with its password, or card
    details.

After each step, tell me what you did and what the page showed for cost or
Always Free status.
