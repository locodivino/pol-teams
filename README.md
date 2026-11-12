# pol-teams — bibliothèque d'équipes de bots Pol

Équipes de bots prêtes à importer dans [Pol](https://github.com/locodivino/PolBot)
via **Templates › Explore**. Importer une équipe crée **un bot Pol par membre** ;
les skills sont stockées inertes (aucune exécution en V0.8), le salon et les
routines n'existent pas dans Pol.

## Équipes

| Équipe | Membres | Contenu |
|---|---|---|
| `pol-essentiels` | 5 | Les modèles intégrés de Pol (Pol, Tri de boîte mail, Veille newsletters, QA, Humanizer) |
| `suivi-boite-mail` | 2 | Conversations en suspens et relances fondées — jamais d'envoi automatique |
| `veille-concurrents` | 2 | Changements publics concurrentiels et notes de décision |

## Utilisation

Pol lit ce dépôt à un **commit figé** (constante `POL_TEAMS_COMMIT` de
`superbot/apps/api/src/library/source.ts`), jamais à `main`. Pour publier une
nouvelle version : pousser ce dépôt sur `github.com/locodivino/pol-teams`, noter
le SHA du commit de référence, le faire figer dans Pol par le propriétaire.

Format et règles : voir [FORMAT.md](FORMAT.md). Vérification locale :

```
node scripts/validate.mjs
```

## Licence

MIT — voir [LICENSE](LICENSE). Contenus adaptés de projets tiers :
voir [NOTICE](NOTICE).
