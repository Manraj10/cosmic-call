# AIRGAP — the 3-minute run

Casting. **You are ROOK.** `PUMP OFF` is on your console and nobody else's, and the pump runaway is the clearest beat to narrate. **A friend is VEGA.** If you have a third phone, put a judge or a teammate on **CHEN**, because Chen holds the key registry and you are going to need them to use it.

Show two phones at a time. Never four consoles at once — it reads as noise.

---

## 0:00–0:25 — the hook

Hold up your phone and Vega's phone, side by side.

> Four of us are on a Mars hab in a dust storm. Ninety seconds.
>
> Three of us can see exactly what is going wrong. **One of us has the only hands on the ship, and she cannot hear a single thing we say.**
>
> Everything she gets is a card that slams her screen. And there is something else on the comms bus sending her cards too.

Do not explain roles. Do not explain systems. Launch.

## 0:25–0:55 — one clean emergency

Let the pump runaway land. Narrate over it.

> The plant is getting loud. I am the only person at this table who can see the reactor draw.

Point at Vega's phone.

> She is the only person who can see the cabin air, and it is climbing past ninety. Neither of us can see the other's number, so we have to talk.
>
> I can't tell her. I get one card, and `PUMP OFF` is only on my console.

Press `PUMP OFF`. The card slams Vega's full screen. Her phone buzzes.

> Badge says `SEALED`. That stamp means the card came from my console and nowhere else. She kills the pump, and her acknowledge turns my line green. That is the only thing she can send back. One bit.

## 0:55–1:35 — the beat that has to land

Around t=26s GHOST starts writing. Stop narrating and point at Vega's screen.

An order slams her glass reading `PUMP ON`. The badge reads `BROKEN SEAL`.

> **Nobody at this table pressed that.**
>
> The signature on it does not verify, so the ship knows it is not from my console. The cabin is already over-pressure. If she does what that card says, she blows a seam.

Let the table shout at her. Let her sit on her hands. That silence is the pitch.

> And it keeps coming, because GHOST does not queue behind our four-second cooldown. We do. So the real order is somewhere underneath the forgeries, and she has to find it.

If she obeys one, do not rescue her. It costs air and it goes in the report, and that is a better demo than a clean round.

## 1:35–2:15 — the escalation

At t=58s GHOST stops guessing and steals a signing key.

> It just took my key.

The same forgery comes back. This time the badge reads `SEALED`.

> Look at her screen. It is a forgery, and her glass says it is fine. There is nothing on that phone that can tell her otherwise. That is what a stolen credential looks like from the inside.

Turn your own phone around and show your signing log.

> Here is the only evidence in the game. This is my log. These are orders signed under my key that I never pressed.
>
> And I cannot send that to her. She cannot receive. I have to say it out loud.

Shout it at Chen. Chen rotates your seat in the key registry. The alarm log prints `KEY ROTATED — ENGINEER WAS COMPROMISED`.

> Chen just rotated me on nothing but my word. If I had been wrong, that rotation voids my in-flight card and costs us a call. So it is not a button you mash. It is a call you make on somebody's word.

**Contingency:** GHOST picks between power and navigation. If it takes navigation instead of yours, say so, have Chen rotate navigation, and name what just happened — the tell was sitting on a seat nobody was watching, which is precisely why the seat matters.

## 2:15–2:35 — the report

Let the round end. Put the incident report on screen.

> No score. An incident report. Orders delivered. How many GHOST forged. How many replays. How many unsealed orders we obeyed. Whose key was stolen, and how many seconds it took us to revoke it.
>
> Time-to-detect a compromised credential, and whether anyone acted on an unauthenticated instruction. Those are the numbers a security team actually drills. This is a ninety-second version four strangers will play voluntarily.

## 2:35–2:50 — how it runs

> Mobile web, no installs, everyone scans a QR code. One Node server owns the hab, and each phone is sent a different slice of it — Vega's client is never *sent* the fields she is not allowed to know, and a harness asserts that.
>
> Every card is real HMAC-SHA256, signed on the phone before it leaves. Two implementations, because a phone on venue Wi-Fi has no `crypto.subtle`, and a harness pins them byte-for-byte.
>
> Mission Control's voice is ElevenLabs, with Grok and the browser engine behind it, so it talks with no keys at all.

## 2:50–3:00 — the close

> Ninety seconds. Four phones. Who wants to be Vega?

Ending on an invitation gets judges out of their chairs. That beats another slide.

---

# Demo logistics

Before you present:

- Every phone on **one phone hotspot**, not venue Wi-Fi. Campus networks block device-to-device traffic.
- One laptop runs the server. Confirm the voice path first: `curl localhost:43128/api/health`
- Volume up on the crew phones. Vega watches the glass.
- Have the round **already in the lobby with seats claimed**, so you launch on your first sentence.
- Refresh gives you a new round in about two seconds.

## If the live demo dies

Switch to the hab monitor spectator view on the laptop. It shows air, power, storm and every alarm on one screen. Talk through the alarm log and the bus alert: the leak that only comms can name, and the moment GHOST comes onto the bus. You lose the phone-slam moment; you keep the whole argument.

---

# Questions you will get

**"Isn't this just Spaceteam?"**
Spaceteam is a bandwidth problem: too many instructions, too little time. This is a routing problem and an integrity problem. The person who can act cannot perceive, so somebody has to translate rather than just shout faster. And the channel itself is untrusted, so half the instructions on it are hostile.

**"Is the crypto real, or is it a theme?"**
Real HMAC-SHA256 over a canonical order line, per-seat keys, a monotonic counter, constant-time compare, two implementations, and a harness that pins them together. The mechanic *is* the primitive: forgery is a failed verification, replay is a used counter, key theft is a leaked secret, and revocation is a rotation. Take the crypto out and there is no game left.

**"Is it end-to-end encrypted?"**
No, and we are not claiming that. The key is a symmetric server-issued secret, the same shape as an HS256 token. What it buys is integrity, not confidentiality: the hab can tell an order a crew member pressed from one GHOST wrote.

**"Why should I care beyond it being fun?"**
Two honest answers. Vega's constraint models a real one — playing her is the closest most people get to being the person in the room who everyone assumes just heard that, which is why seats rotate. And the round ends in an incident report, not a score. Time-to-detect a compromised credential, whether anyone acted on an unauthenticated instruction, and the cost of a false revocation are the actual measures a security team drills. We are not selling it as training and we have no research to cite. It is a drill people will play willingly, and the report is what they argue about afterwards.

**"Did an LLM generate the failures?"**
Deliberately not. Scripted but randomised, so it is different every round, demo-safe, and cannot wander off script on stage. The LLM is the radio voice, which is where it adds atmosphere.

**"What if nobody has a phone?"**
Any browser works. Two laptops and a tablet are fine. Empty seats are covered by the sim, so it plays with two people or one.
