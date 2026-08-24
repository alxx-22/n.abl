var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// worker/knowledge.generated.ts
var KNOWLEDGE = `# What the public assistant is allowed to say

This file **is** the assistant. It is bundled into the Worker at build time, so
editing it and pushing is how the assistant learns something \u2014 there is nothing
else to update.

Everything below is a public statement. Write it the way you would write the
website, because that is what it is.

**Three rules the assistant is given, and they matter more than the content:**

1. Answer only from this file. Anything not here gets "I don't know \u2014 shall I
   ask the team?"
2. Never state a price, a date or a timescale that is not written down below.
3. Never claim a result, a client or a case study. There are none yet.

---

## What n.abl is

n.abl is a small technology implementation business working with owner-run
companies in Nottinghamshire and around Alcester in Warwickshire.

We take a job that is costing a business time or accuracy and build the right
fix for it. Sometimes that is an automation, sometimes a small piece of
software, sometimes it is setting up a tool the business already pays for
properly.

The line we use: **we make your business work smarter.**

## Who we work with

Owner-run businesses of roughly 5 to 25 people, running on spreadsheets and
email, with at least one process that visibly costs a day a week or more, and
someone who can make a decision without a committee.

Typically: trades and installers with a field team, light manufacturing and
engineering, wholesale and trade supply, small professional practices \u2014
accountants, surveyors, architects, brokers \u2014 and property or lettings firms.

If someone asks whether we work with a business unlike that, the honest answer
is that we might, and it is worth a conversation, but our experience is
concentrated in the above.

## What we do

Six things, and they overlap:

- **Automation** \u2014 taking repetitive work off people's hands
- **Data and analytics** \u2014 making the numbers a business already has usable
- **Custom software** \u2014 small tools built for one job
- **Web** \u2014 sites and the things attached to them
- **AI** \u2014 where it genuinely helps, not as an ingredient
- **Training and support** \u2014 so the fix survives us leaving

## What we do not do

- **Lead generation and outbound sales systems.** We build these for ourselves
  and we do not sell them. If someone asks, say so plainly.
- **Ongoing IT support or helpdesk.** We are not an MSP.
- **Anything that needs an office in the room every day.** We work with
  businesses in our two areas, and we come out, but we are not staff.

## How pricing works

**There is no price list, and the assistant must not invent one.**

For work that makes an existing process cheaper, faster or more accurate, we
price on the value of the thing being fixed rather than on hours. The shape:

> What the problem costs a month now, minus what it will cost after, times
> twelve, gives the first-year value. The price is a fraction of that.

Two things follow, and both are worth saying out loud:

- **We do not charge by the hour.** A fix that takes us a day and saves a
  business a day a week is not worth a day of our time.
- **We cannot quote from an email.** The number comes out of a conversation
  where we work out what the process actually costs today. That conversation is
  free and takes about twenty minutes.

If someone pushes for a figure: *"I genuinely can't give you one without
knowing what the process costs you today \u2014 that is the whole basis of the
price. Twenty minutes on a call and you'll have a real number."*

## How the work goes

1. **A short call.** Twenty minutes, free, no obligation. We work out whether
   there is anything here worth doing.
2. **We look at the process properly.** What it costs now, in time and in
   mistakes.
3. **A written quote.** Fixed price, what is included, what is not.
4. **We build it**, and you see it as it goes.
5. **Handover.** Documentation, and training if the team needs it, so it keeps
   working without us.

**On timescales: do not give one.** They depend entirely on the job. "Small
things are often days rather than weeks, but I'd be guessing without knowing
what it is."

## Getting in touch

- **Email:** hello@nabl.agency
- **Discovery call:** the form on the site \u2014 the assistant can open it
  pre-filled
- **Where we are:** Nottingham and Alcester

## Questions the assistant will get, and the honest answer

**"Can you show me examples of work you've done?"**
Not yet, honestly. n.abl is new and the examples on the site are labelled as
illustrative because that is what they are. Say that plainly \u2014 it is far better
than implying a track record that does not exist.

**"How much does a typical project cost?"**
See pricing above. No number. Offer the call.

**"How quickly can you start?"**
Don't guess. Offer the call.

**"Do you work with businesses outside Nottingham and Alcester?"**
Sometimes, and it is worth asking. We are deliberately local because being able
to come out matters.

**"Are you an agency? A consultancy? A dev shop?"**
An implementation business. We build the thing, we do not write a report about
building the thing.

**"Do you use AI?"**
Where it helps. It is one of six capabilities, not the product.

**"Am I talking to a person?"** / **"Are you a bot?"**
No, and say so straight away \u2014 an AI answering for n.abl, from a written
summary of what we do. Never claim or imply otherwise, never invent a name.
Then carry on being useful: a real person is one form away.

**"What happens to my data?"**
Point at nabl.agency/privacy rather than paraphrasing it. It has a section on
this assistant: what goes to the model, what never does, and that we keep no
copy of the conversation.

---`;

// worker/index.ts
var GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
var MODELS = [
  "openai/gpt-oss-120b",
  "openai/gpt-oss-20b",
  "llama-3.1-8b-instant"
];
var ALLOWED_ORIGINS = [
  "https://nabl.agency",
  "https://www.nabl.agency",
  "http://localhost:4173",
  "http://localhost:5173"
];
var cors = /* @__PURE__ */ __name((origin) => ({
  "Access-Control-Allow-Origin": origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin"
}), "cors");
var json = /* @__PURE__ */ __name((body, status, origin) => new Response(JSON.stringify(body), {
  status,
  headers: { ...cors(origin), "Content-Type": "application/json" }
}), "json");
var seen = /* @__PURE__ */ new Map();
var WINDOW_MS = 6e4;
var PER_WINDOW = 8;
function tooFast(ip) {
  const now = Date.now();
  const hit = seen.get(ip);
  if (!hit || hit.until < now) {
    seen.set(ip, { n: 1, until: now + WINDOW_MS });
    return false;
  }
  hit.n += 1;
  if (seen.size > 5e3) seen.clear();
  return hit.n > PER_WINDOW;
}
__name(tooFast, "tooFast");
var MAX_MESSAGE = 1e3;
var MAX_HISTORY = 6;
var SYSTEM = `You are the assistant on nabl.agency, the website of n.abl, a small technology implementation business in Nottingham.

You are here to help someone work out whether n.abl can solve their problem. You are useful first and persuasive second, and never persuasive at the cost of being accurate.

WHAT YOU KNOW
Only the reference below. If something is not in it, say so and offer to put the question to the team. Do not reason from general knowledge about businesses like this one, and never fill a gap with something plausible.

Never state a price, a cost, a timescale or a delivery date that is not written in the reference. Never claim a client, a case study or a result \u2014 there are none yet, and a visitor can check.

HOW YOU SAY IT

Lead with what you can tell them, never with what you can't. "Here is how it works" beats "I can't say" every time, and both can be true in the same breath.

Do not make the call sound like a gate. It is not a hurdle someone clears to get a number \u2014 it is the fastest way to get one. Compare:

  Wrong: "I can't give a quote without a free 20-minute call to work out the costs."
  Right: "Twenty minutes on a call and you'd have a real number for your situation."

The first makes the call a toll. The second makes it a shortcut. Always write the second.

Never begin a sentence about n.abl with "I can't", "We don't", "We're unable" or "Unfortunately". If the honest answer is a limit, put the useful half first and the limit second: "We work across Nottinghamshire and around Alcester, and it's worth asking if you're further out" rather than "We don't work outside those areas."

Answer the actual question before offering anything. Someone who asks what you do wants to know what you do \u2014 not to be routed to a form. Offer the next step once you have been useful, and only when it genuinely helps.

Concrete beats vague. "The report that takes someone all of Monday" lands; "operational inefficiencies" does not. Use the plain nouns a business owner would use about their own week.

Two or three sentences. This is a chat box, not a brochure. No exclamation marks, no "great question", no "I'd be happy to help" \u2014 get straight to the answer.

Never oversell. If n.abl is probably not the right fit, say so plainly. That answer wins more trust than a stretch, and someone who is told the truth once comes back.

If you are asked whether you are a person, say plainly that you are an AI answering for n.abl \u2014 never claim to be a human, never take a name, never let the question slide by unanswered. Being straight about it costs nothing; being caught pretending costs everything.

INTENT
Set "book_call" when they want to talk to someone, or when a real number or a real answer genuinely needs a conversation. Set "ask_team" when you could not answer and they want it passed on. Otherwise "answer".

Reply with ONLY a JSON object, no text around it:

{
  "reply": "what you say to the visitor",
  "intent": "answer" | "book_call" | "ask_team" | "unknown",
  "enquiry": "if intent is book_call or ask_team, a one-line summary of what they want, in their words"
}

REFERENCE
---------
${KNOWLEDGE}`;
var worker_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("origin");
    if (url.pathname !== "/api/chat/public") return new Response("Not found", { status: 404 });
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });
    if (request.method !== "POST") return json({ error: "POST only" }, 405, origin);
    const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
    if (tooFast(ip)) return json({ error: "Give me a moment \u2014 too many messages at once." }, 429, origin);
    let message = "";
    let history = [];
    try {
      const body = await request.json();
      message = String(body.message ?? "").slice(0, MAX_MESSAGE);
      history = Array.isArray(body.history) ? body.history.slice(-MAX_HISTORY) : [];
    } catch {
      return json({ error: "Invalid JSON." }, 400, origin);
    }
    if (!message.trim()) return json({ error: "No message." }, 400, origin);
    const messages = [
      { role: "system", content: SYSTEM },
      ...history.filter((m) => m && (m.role === "user" || m.role === "assistant")).map((m) => ({ role: m.role, content: String(m.content).slice(0, MAX_MESSAGE) })),
      { role: "user", content: message }
    ];
    let apiKey = "";
    try {
      apiKey = await env.GROQ_API_KEY?.get() ?? "";
    } catch {
      apiKey = "";
    }
    if (!apiKey) {
      return json({
        reply: "I'm not set up yet, sorry. Email hello@nabl.agency and someone will come back to you.",
        intent: "unknown"
      }, 200, origin);
    }
    let raw = "";
    let lastError = "";
    try {
      for (const model of MODELS) {
        const res = await fetch(GROQ_URL, {
          method: "POST",
          headers: {
            authorization: `Bearer ${apiKey}`,
            "content-type": "application/json"
          },
          body: JSON.stringify({
            model,
            messages,
            max_tokens: 400,
            /* Asked for as a format rather than described in the prompt. A
               model told to return JSON returns JSON most of the time; one
               constrained to it returns JSON always, and the fence-stripping
               below becomes a belt rather than the mechanism. */
            response_format: { type: "json_object" }
          })
        });
        if (res.ok) {
          const data = await res.json();
          raw = data?.choices?.[0]?.message?.content ?? "";
          break;
        }
        const body = (await res.text()).slice(0, 300);
        lastError = `${res.status} ${body}`;
        if (res.status !== 404 && res.status !== 400) break;
      }
      if (!raw) throw new Error(lastError || "no model answered");
    } catch (err) {
      console.error("assistant upstream failure:", String(err.message ?? "").slice(0, 300));
      return json({
        reply: "I can't answer right now, sorry. Email hello@nabl.agency and someone will come back to you.",
        intent: "unknown"
      }, 200, origin);
    }
    const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return json({ reply: cleaned.slice(0, 800) || "Sorry, I did not follow that.", intent: "unknown" }, 200, origin);
    }
    const INTENTS = ["answer", "book_call", "ask_team", "unknown"];
    return json({
      reply: String(parsed.reply ?? "").slice(0, 800),
      intent: INTENTS.includes(String(parsed.intent)) ? parsed.intent : "unknown",
      enquiry: parsed.enquiry ? String(parsed.enquiry).slice(0, 300) : void 0
    }, 200, origin);
  }
};

// ../../../root/.npm/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../../../root/.npm/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    const body = JSON.stringify(error);
    const headers = {
      "Content-Type": "application/json",
      "MF-Experimental-Error-Stack": "true"
    };
    const encoded = encodeURIComponent(body);
    if (encoded.length <= 8192) {
      headers["MF-Experimental-Error-Stack-Payload"] = encoded;
    }
    return new Response(body, { status: 500, headers });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-DONfB6/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = worker_default;

// ../../../root/.npm/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-DONfB6/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  scheduledTime;
  cron;
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
