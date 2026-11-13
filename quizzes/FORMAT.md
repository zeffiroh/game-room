# Quiz pack format

Every quiz in Game Room uses this one format: the built-in packs in this folder, quizzes a teacher uploads,
and the rounds dropped into a party. A pack is a JSON file:

```json
{
  "id": "ap-stats",                 // lowercase letters, digits, dashes
  "title": "AP Statistics",
  "subject": "Statistics",          // short shelf label
  "icon": "chart",                  // a name from engine/icons.js (optional)
  "blurb": "One sentence for the shelf card.",
  "level": "AP / intro college",    // optional
  "rounds": [
    {
      "id": "r1",
      "title": "Round 1: Sampling and bias",
      "intro": "One or two plain sentences read out before the round.",
      "questions": [
        {
          "q": "The question. Plain text, no HTML.",
          "scene": "Optional setup/data shown above the question (a study, a table in words, a sequence).",
          "choices": ["A", "B", "C", "D"],   // exactly 4
          "answer": 2,                         // index 0-3 of the right choice
          "why": "Shown after the reveal: why the right one is right and the tempting wrong one is wrong.",
          "seconds": 45,                       // optional time limit, 10-120 (default 30)
          "boss": true                         // optional, double points (use on the last question of a round)
        }
      ]
    }
  ]
}
```

A file that is just one round (`{ "title": ..., "questions": [...] }`) or just a list of questions also uploads fine.

## CSV upload
One question per row. First row is the header:

```
question,a,b,c,d,answer,why,seconds,scene,round
```

`answer` is A, B, C or D. `seconds`, `scene` and `round` are optional. Rows with the same `round` value
become one round; with no `round` column every 10 rows become a round.
