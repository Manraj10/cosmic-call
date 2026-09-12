# 3-minute pitch

## The one-liner

> **Keep Talking and Nobody Explodes — except the person holding the bomb can't hear you.**

Use that first. Every judge knows the reference, and it does 80% of the explaining for free.

## 0:00–0:25 — the hook

> Four of us are on a Mars hab in a dust storm. Ninety seconds to get through it.
>
> Three of us can see exactly what's going wrong. **One of us has the only hands on the ship — and she can't hear a single thing we say.**
>
> That's the whole game. Everything else is us trying to get one idea into her head before the air runs out.

Don't explain roles yet. Don't explain systems. Stop talking and demo.

## 0:25–1:40 — the live beat

Get three phones on camera. **Never show four consoles at once** — it reads as noise.

Show **Vega's screen** and **Rook's screen** side by side, and narrate one emergency:

1. "The pump jams. The ship says out loud: *turn off the oxygen.*" — let the voice line play.
2. "Everyone at this table heard that. She didn't."
3. Point at Vega's screen: air climbing past 90, needle in the red hatching. "She thinks this is good news. More air."
4. "I can't tell her. I get **one** icon, and PUMP OFF is the only one my console has." — press it.
5. Icon lands on Vega's glass, flashing, her phone buzzes. She kills the pump — and her acknowledge turns my line green.

That's your demo. One emergency, start to finish, in about 20 seconds of real play. Then say:

> Three of those happen in ninety seconds. Nobody at this table has ever won it quietly.

## 1:40–2:20 — why it's not just chaos

> Party games get chaotic by giving you too many buttons. We got chaotic by making the information asymmetric.
>
> Vega has every control and one number. Rook has the power reading. Idris has the storm clock. Chen has the alarm log. **Nobody can see anyone else's screen, and the one person who can act is cut off from all of it.**
>
> So the failure mode isn't fumbling. It's a real communication breakdown — three people shouting the right answer at someone who physically cannot receive it.

And the line that lands with judges who build things:

> Every icon is locked to one person's console. Chen is the only human alive who can tell Vega which valve is bleeding. There is exactly one order that gets you through ninety seconds, and we have a harness that proves it: silence any one of the four of us and the win rate is zero. **There are no passengers in this game.**

If you have 10 spare seconds, the accessibility line:

> Vega's constraint is modelled on a real one. Playing her is the closest most people get to being the person in the room who everyone assumes just heard that.

## 2:20–2:50 — build + sponsor

> Mobile web PWA, no installs — everyone joins by pointing a phone at a URL. Node and Socket.io holding one shared ship state, each phone rendering a different slice of it.
>
> The ship's voice is text-to-speech, and the server proxies xAI's voice API when a key is present — the astronaut you just heard interrupting us is Grok, and the key never leaves the host.
>
> Failures are scripted-but-randomised, so it's different every round and it can't wander off script on stage.

## 2:50–3:00 — the close

> It's ninety seconds. Four phones. Who wants to be Vega?

Ending on an invitation gets judges out of their chairs, which is worth more than another slide.

---

# Demo logistics

**Show 3 roles live, mention the 4th.** Four people crowding phones does not film.

Casting:
- **You are Rook.** The pump runaway is the clearest beat to narrate, and `PUMP OFF` is on your console and nobody else's.
- **A friend is Vega**, earplugs in, visibly not reacting when the room shouts. That silence is the pitch.
- **One judge or teammate is Chen** on the alarm log, if you want a third phone — hand them the valve leak and let them discover that only they can call it.

Before you present:
- Every phone on the same hotspot, not venue Wi‑Fi.
- One laptop runs the server. Confirm `curl localhost:43128/api/health` first.
- Volume up on the hearing phones. Vega's on silent.
- Have the round already in the lobby with seats claimed, so you launch on the first sentence.
- Refresh gives you a new round in about two seconds if a demo goes wrong.

**If the live demo dies:** switch to the hab monitor spectator view on the laptop and talk through the alarm log. It shows air, power, storm and every alarm in one screen.

# Questions you will get

**"Isn't this just Spaceteam?"**
Spaceteam is a bandwidth problem — too many instructions, too little time. This is a *routing* problem. The person who can act can't perceive, so you have to translate, not just shout faster.

**"Do you need the accessibility angle?"**
It's the reason the mechanic is interesting rather than arbitrary, and it's the reason people rotate seats. Lead with the game, land the point at the end.

**"What if nobody has phones?"**
Any browser works. Two laptops and a tablet are fine.

**"Did you use an LLM to generate the failures?"**
Deliberately not. Scripted-but-randomised, so it's demo-safe. The LLM is the astronaut's voice, which is where it actually adds atmosphere.
