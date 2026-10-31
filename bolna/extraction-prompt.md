From the coaching conversation, extract a JSON object with exactly these keys:
- "title": a short 3 to 6 word title for the session.
- "summary": 2 to 3 sentence summary of what the user discussed and realised, written to the user in second person ("You ...").
- "key_insights": array of 1 to 4 short strings, the most important realisations or patterns.
- "action_items": array of 0 to 3 short strings, concrete next steps the user committed to (include timeframe if mentioned).
- "mood": one word describing the user's emotional state at the end of the call.
- "mood_score": integer 1 to 10 (10 = very positive), your best estimate.
- "confidence_score": integer 1 to 10 the user gave for following through, or null if not given.
- "follow_up": one question the coach should ask at the start of the next session.
- "memory": 1 to 2 sentences of durable facts about the user worth remembering for future sessions (goals, context, preferences).
Return only valid JSON.
