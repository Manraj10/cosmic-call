# Cosmic Call — the 3-minute run

**Casting.** **You are ROOK.** `PUMP OFF` is on your console and nobody else's, and the pump runaway is the clearest beat to narrate. **VEGA is the fastest thumbs on your team**, and she has rehearsed the run to the comms bay. **CHEN** and **IDRIS** are teammates. Chen matters most after you: Chen holds the rotation cards, and the escalation dies without them.

**Staging.** The laptop drives the projector with the **hab monitor** seat (the Mission Control board), facing the judges and away from the table. It draws Vega's position, the key token, and every card on the bus with its seal. You hold up two phones at a time, never four.

**Clock.** The round is 90 seconds and you launch 15 seconds in, so **round time = pitch time − 0:15**. The first leak is t=8, the runaway t=24, and the key theft t=58. GHOST's first forgery wakes at a random second from t=26 to t=29, and the storm shifts by a few seconds each round. Lines are written to fit around those beats. The stage directions say which beat each line waits for.

---

## 0:00–0:15 — the hook

Hold up your phone and Vega's phone, side by side.

> Mars hab. Dust storm. Ninety seconds.
>
> Three of us can see what's breaking. **She has the only hands on the ship, and she can't hear us.**
>
> She gets a card that slams her screen. Something else on the bus is writing cards too.

Launch on the last word. Do not explain roles or systems.

## 0:15–0:40 — one clean emergency (round t=0–25)

The first leak lands at t=8. Chen shouts the valve and sends it. Point at the big screen as her dot leaves the spine.

> Every control she has is bolted to a different room. Chen just sent her to the air plant, so she runs. The rest of us never move.

While she seals it, set up the next beat.

> I'm the only one who can see the reactor. She's the only one who can see the air. I can't tell her anything. I get one card.

The runaway lands at t=24. Press `PUMP OFF`. The card slams Vega's full screen and her phone buzzes.

> `SEALED`. That stamp means it came from my console. Her own screen is telling her the air is fine and to keep the pump — so watch whether she trusts my card over her own number.

If she kills the pump, her acknowledge turns your line green. If she doesn't, say so: that argument is the game.

> One bit back. That's all she can say to me.

## 0:40–1:10 — the beat that has to land (round t=25–55)

GHOST wakes. Stop narrating and point at Vega's screen.

An order slams her glass: `SEAL` on a valve, with `RUN TO PLANT` on it. The badge reads `BROKEN SEAL`. Her air is somewhere around 50 to 57.

> **Nobody at this table pressed that.**

Two seconds of nothing. Then:

> The signature doesn't verify. It wants her to seal the valve that isn't leaking. That starves the air intake and runs her to the plant for nothing.

Let the table shout at her. Let her sit on her hands. That silence is the pitch.

When the second forgery lands (t=35 to 38):

> GHOST doesn't wait for our cooldown. The real order is under the forgeries somewhere, and she has to find it.

If she obeys one, do not rescue her. A failed round demos better than a clean one.

If an `OLD COUNTER` card lands (t=44 to 48):

> That's a real order from one of us, played back. The counter already went past it.

## 1:10–1:25 — the theft (round t=55–70)

**Storm first.** Impact lands somewhere from t=53 to t=61 (pitch 1:08–1:16). If Idris hasn't called it, one line and let the table handle it:

> Idris is the only one who can see that storm. BRACE only counts in the last three seconds.

Just before t=58:

> Watch what happens when GHOST gets a key.

At t=58 the crew phones say *"That did not come from any of you"* and your signing log instantly shows a line marked `NOT YOU`. Vega's phone shows nothing: she is never sent the voice and never sees a log. Turn your phone around and point at the red row; judges won't read it from their seats, so say what it is.

> My key. Not my thumb. Her phone has no idea.

At t=67 GHOST's first forgery with the stolen key lands reading `SEALED`, with a `RUN TO` on it. If Chen already sent the rotation and Vega ran the token to comms, it arrives `BROKEN SEAL` instead. Say that's the defence working.

> And I can't send her any of that.

**Shout it across the table:** "CHEN. ROTATE ROOK."

## 1:25–1:45 — the run (round t=70–90)

Chen sends `ROTATE ROOK`. It slams Vega's glass.

Say one line, then step back half a pace so the room watches the big screen and her hands:

> A key can't be rotated over the bus that's compromised. Somebody has to carry the token.

**You stop talking. The table does not.** Idris is calling the storm and Chen is reading the log, and none of it reaches her.

On the big screen her dot heads for the spine. She grabs the key and the board flips to `KEY IN HAND`. Then the comms bay. Every hop is 1.4 seconds, and every control on the ship is dead while she is in the corridor. At the registry she hits `ROOK`. Your log stops filling, and GHOST is back to broken seals.

The second leak lands at t=82, on top of the run. If she is in the comms bay, name it in one sentence:

> Other valve. She's as far from it as this hab allows.

Let the round end on her running.

**Contingency: GHOST took Idris's key instead of yours.** Idris shouts, Chen sends `ROTATE IDRIS`, and the run is the same. Swap your theft lines for one sentence: "The tell just showed up on a screen I can't see, which is why every seat needs a person."

## 1:45–2:15 — the report

Put the incident report on the big screen.

> No score. An incident report. What GHOST forged and replayed. Whose key it stole, and how long we took to rotate it. How many clean keys we rotated by mistake.
>
> Time to detect a stolen credential, and the cost of a false revocation. That's what security teams drill. Strangers play this one on purpose, and the report is what they argue about.

## 2:15–2:42 — how it runs

> Scan a QR code, no install. One server owns the hab and sends each phone a different slice. Her client is never sent what she can't know, and a harness fails the build if it leaks.
>
> Every card is real HMAC-SHA256, signed on the phone. A phone on plain http has no `crypto.subtle`, so we also wrote SHA-256 by hand, and a harness pins both byte for byte.
>
Before this line, check `<url>/api/health`. Say only the version it backs.

If it shows `"voice":"elevenlabs"`:

> Mission Control's voice is ElevenLabs, proxied through our server so no key ever reaches a phone — and Vega's phone is never sent a single speech event.

Otherwise:

> Mission Control talks through the browser's own voice, so there's nothing to install — and Vega's phone is never sent a single speech event.

## 2:42–3:00 — the close

Hold Vega's phone out toward the judges.

> Ninety seconds. You don't need four phones. One seat is enough.
>
> **Grab the Vega seat. We'll crew the rest.**

An invitation gets judges out of their chairs, and a slide does not. Hand the phone to whoever stands up first. Seat the table and tell them only "watch the glass". The one-page rules are at `<url>/how.html` if a judge wants them. After a rematch every seat has to tap **i am ready** again before the host can launch.

---

# Demo logistics

Before you present:

- Every phone joins through the **public Cloudflare tunnel URL**. Not a hotspot, not a LAN IP: those are the fallback below. The runbook is in `LEADER.md` under "Demo topology". The URL changes if the tunnel restarts, so reprint the QR if it does.
- Confirm the voice and radio path: `curl <url>/api/health`
- Put `<url>/how.html` on a second tab for judges who want the rules.
- The laptop claims the **hab monitor** seat and drives the projector, facing away from the table.
- Volume up on the crew phones. Vega's phone is never sent audio, so hers does not matter.
- Rehearse the run at least twice with your actual Vega: from the plant to the spine, pick up the key, on to comms, rotate, then two hops back to the plant.
- Have the hab **already in the lobby with seats claimed and everyone ready**, so you launch on the last word of the hook.
- For the judge round afterwards, the hab lead starts a rematch so nobody has to rejoin.

## If the live demo dies

**Phones drop, laptop is fine.** Keep the hab monitor on the projector and launch from a second tab on the laptop holding one seat. The sim covers every empty seat, so the round still runs, GHOST still attacks, and Vega's dot still walks. Talk through the command channel on the board: forgeries arriving `BROKEN SEAL`, the replay, the theft, the dot carrying the key to comms. You lose the phone-slam moment and keep the whole argument.

**The tunnel dies, the laptop is fine.** Fallback only. Put every phone and the laptop on one phone hotspot, since campus Wi-Fi blocks device-to-device traffic, and have phones open `http://<laptop LAN IP>:43200`, the port the production server listens on. Or restart the tunnel per `LEADER.md` and reprint the QR, because the URL changes.

**The server dies.** Open a terminal and run `npm run crypto`. It prints each assertion as it passes: forged tags refused, replays refused differently, a stolen key's forgeries verifying, a rotation shutting them out. Narrate the round over that output, then close on the report.

---

# Questions you will get

**"Isn't this just Spaceteam?"**
Spaceteam is a bandwidth problem: too many instructions, too little time. This is a routing problem and an integrity problem. The person who can act cannot perceive, so somebody has to translate rather than shout faster. And the channel itself is untrusted, so some of the instructions on it are hostile.

**"Is the crypto real, or is it a theme?"**
Real HMAC-SHA256 over a canonical order line, per-seat keys, a monotonic counter, a constant-time compare on the full tag, two implementations, and a harness that pins them together. The mechanic is the primitive: forgery is a failed verification, replay is a used counter, key theft is a leaked secret, and revocation is a rotation. Take the crypto out and there is no game left.

**"Is it end-to-end encrypted?"**
No, and we don't claim it. The key is a symmetric server-issued secret, the same shape as an HS256 token. What it buys is integrity, not confidentiality: the hab can tell an order a crew member pressed from one GHOST wrote.

**"Why can't Chen just rotate the key from comms?"**
Chen's console talks to the ship over the bus GHOST is sitting on. A rotation sent as an order is one more order GHOST could forge. So the registry only accepts a rotation from a hand holding the token, standing in the comms bay. In code that is a server rule. The idea behind it holds outside the game: you recover from a compromised channel outside that channel.

**"Isn't the walking busywork?"**
It is what makes a forgery cost more than attention. A forged `SEAL` runs her to the plant for nothing, and every control on the ship is dead while she is in the corridor.

**"Why should I care beyond it being fun?"**
Two answers. Vega's constraint models a real one. Playing her is the closest most people get to being the person in the room who everyone assumes just heard that, which is why the seats rotate. And the round ends in an incident report, not a score. Time to detect a compromised credential, whether anyone acted on an unauthenticated instruction, and the cost of a false revocation are what a security team drills. We are not selling it as training and there is no research to cite. It is a drill people will play willingly, and the report is what they argue about afterwards.

**"Did an LLM generate the failures?"**
Deliberately not. The failures are scripted and randomised per round: which valve goes first, when the storm warns, when GHOST wakes. GHOST picks each forgery by rules from the live state, and it never sends the order that happens to be correct. That keeps it demo-safe, because nothing can wander off script on stage. The only language-model call is the debrief radio line, written after the round is graded. It runs down a fallback chain: K2 Horizon, then Gemini, then Grok, then a line written into the game. It never touches the grading.

**"What if I only have one phone?"**
Take any seat and launch, and the sim covers the rest. Two browser tabs on one laptop make a two-seat crew. On a short crew one console carries the empty seats' cards, so every system still has someone on it.

**"Where did this come from?"**
Two builds from this hackathon, welded together, and both are in git. The crosstalk build gave it the deaf operator, the order cards and the asymmetry harness. The habitat build gave it rooms you walk between and a thing you carry, which became the key token.
