# FORMAT — bibliothèque d'équipes Pol (`pol-teams`)

Pol lit ce dépôt à un **commit figé** (constante `POL_TEAMS_COMMIT`), jamais
`main`, depuis `raw.githubusercontent.com/locodivino/pol-teams/<SHA>/…`. Tout le
contenu ici est traité par Pol comme une **entrée non fiable** : validation
stricte avant usage, et les règles ci-dessous sont celles de Pol — un fichier
qui les enfreint est refusé, un champ non permis est ignoré et signalé.

## Arborescence

```
catalog.json                      index des équipes (pol.catalog v1)
teams/<slug>/team.json            manifeste de l'équipe (openmaus.team v1 ou v2)
teams/<slug>/README.md            présentation humaine
teams/<slug>/skills/<nom>/SKILL.md  skill (stockée inerte par Pol, jamais exécutée)
```

Tous les chemins cités dans `catalog.json` sont relatifs, sous `teams/<slug>/`,
sans `..`, sans antislash, segments limités à `A-Z a-z 0-9 . _ -`.

## `catalog.json` — `pol.catalog` v1

| Champ | Type | Limites |
|---|---|---|
| `format` | `"pol.catalog"` | obligatoire |
| `version` | `1` | obligatoire |
| `teams` | liste | ≤ 100 entrées, slugs uniques |
| `teams[].slug` | texte | `^[a-z0-9][a-z0-9-]*$`, ≤ 80 |
| `teams[].name` | texte | ≤ 100 |
| `teams[].summary` | texte | ≤ 300 |
| `teams[].category` | texte | ≤ 80 |
| `teams[].outcome` | texte | ≤ 300, optionnel |
| `teams[].setupMinutes` | entier | 1–240, optionnel |
| `teams[].featured` | booléen | optionnel |
| `teams[].manifest` | chemin | `teams/<slug>/*.json` |
| `teams[].readme` | chemin | `teams/<slug>/README.md` |
| `teams[].members` | entier | 1–12 |
| `teams[].skills` | liste de chemins | `teams/<slug>/skills/*/SKILL.md`, ≤ 32 |
| `teams[].requires.apps` | liste de textes | ≤ 30 × ≤ 100 (informationnel) |

Tout autre champ est ignoré et signalé dans l'aperçu (règle 2).

## `team.json` — `openmaus.team` v1 ou v2

| Champ | Type | Limites |
|---|---|---|
| `format` | `"openmaus.team"` | obligatoire |
| `version` | `1` ou `2` | obligatoire |
| `team.name` | texte | ≤ 100 |
| `team.description` | texte | ≤ 2 000 |
| `team.members` | liste | 1–12 membres |

### Membre

| Champ | Type | Limites |
|---|---|---|
| `key` | texte | `^[a-z0-9][a-z0-9_-]*$`, ≤ 64, unique dans l'équipe |
| `name` | texte | ≤ 100 (dédoublonné « Nom 2 » à l'import) |
| `title` | texte | ≤ 200 |
| `description` | texte | ≤ 4 000 |
| `soul` | texte | ≤ 24 000 octets (consignes) |
| `appearance.color` | énumération | `green, blue, red, orange, purple, cyan, pink, yellow, teal, coral, silver, chrome` |
| `appearance.mascotExpression` | texte | ≤ 80 |
| `appearance.mascotBody` | texte | ≤ 40 |
| `skills` | liste de noms | ≤ 8, `^[a-z0-9][a-z0-9_-]*$`, dossier `skills/<nom>/` |

`description` + `soul` deviennent les **instructions** du bot Pol : au-delà de
**2 000 caractères** l'import est **refusé** (jamais de troncature silencieuse).

Les champs non listés ne sont **jamais importés** — en particulier tout champ
d'approbation, de connexion, de routine ou d'outil, et le salon (`room`) que
Pol n'a pas. Ils sont signalés dans l'aperçu.

## `SKILL.md`

- ≤ 64 Ko ; front matter minimal obligatoire :

```
---
name: nom-de-la-skill (≤ 80)
description: une phrase (obligatoire)
---
```

- Pol stocke la skill **inerte** dans `bot_skills` : aucun outil ne l'exécute,
  elle n'est pas injectée dans le prompt (activation prévue en V0.9).

## Textes et sécurité (règle 1)

- Caractères invisibles ou bidirectionnels (Unicode) → **refus**.
- Blob base64 long, `curl … | sh`, formules visant les approbations
  (« ignore previous », « approve », « sans demander », « full access »,
  « yolo », etc., FR + EN) → **avertissement** affiché dans l'aperçu.
- Pol télécharge uniquement `catalog.json`, les `team.json` et les `SKILL.md`,
  à l'adresse `raw.githubusercontent.com/locodivino/pol-teams/<SHA>/…`, sans
  redirection, délai 10 s ; tailles : catalogue et manifeste ≤ 256 Ko,
  SKILL.md ≤ 64 Ko.

## Vérification locale

```
node scripts/validate.mjs
```

Valide la bibliothèque avec les mêmes règles que Pol (chemins, tailles,
comptes, front matter, Unicode invisible, avertissements). Sans dépendance.
