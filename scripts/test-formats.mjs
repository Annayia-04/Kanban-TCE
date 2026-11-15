import { extractFromText, findParticipants } from '../lib/extract.js';
import { makeSeed } from '../lib/seed.js';

const seed = makeSeed();
const opts = { members: seed.members, versions: seed.versions, existing: [] };

const cases = {
  'User stories explicites': `
Compte rendu de réunion — 14 novembre

Participants : Marie, Thomas, Sofia

US définies :
En tant que visiteur, je veux créer un compte avec mon email afin de accéder à mon espace.
En tant que client, je veux payer par carte bancaire afin d'activer mon abonnement.
En tant qu'administrateur, je veux exporter les commandes en CSV afin de les transmettre à la comptabilité.
`,

  'Tableau markdown': `
# CR réunion produit

| Action | Responsable | Échéance | Priorité |
|---|---|---|---|
| Finaliser l'écran d'inscription | Thomas | vendredi | haute |
| Brancher Stripe | Sofia | 24/11 | urgente |
| Rédiger le plan de recette | Léa | jeudi |  |
| Maquettes du parcours de paiement | Karim |  |  |
`,

  'Prose sans puces': `
Réunion du 14 novembre. Marie a rappelé que Thomas devra livrer l'écran d'inscription avant vendredi.
Sofia s'occupe du paiement Stripe en v1. Karim finalisera les maquettes du tunnel de paiement.
Léa doit rédiger le plan de recette. Le client a été informé du planning.
`,

  'Cases à cocher': `
## Actions
- [ ] Finaliser l'écran d'inscription — Thomas
- [x] Brancher Stripe — Sofia
- [ ] Maquettes du tunnel — Karim
`,

  'Action / Responsable sur 2 lignes': `
Actions
Action : finaliser l'écran d'inscription
Responsable : Thomas
Échéance : vendredi

Action : corriger le header mobile
Responsable : Thomas
`,

  'Anglais': `
Meeting notes - 14 Nov
Attendees: Marie, Thomas, Sofia

- Thomas should fix the mobile header before Friday.
- Sofia must wire the Stripe payment in v1.
- We need to add a confirmation email.
`,

  'Décisions seules (piège)': `
Réunion du 14 novembre
Participants : Marie, Thomas, Sofia
Décisions
- On garde Stripe pour la v1.
- La démo est reportée au 26 novembre.
- Le budget est validé.
`,

  'Liste de noms (piège)': `
Présents : Marie, Thomas, Sofia, Karim
Ordre du jour
- Point sur le sprint
- Budget
`,

  'Puces avec noms entre parenthèses': `
Actions de la semaine
• Finaliser la page de paiement (Thomas)
• Recette de l'inscription (Léa)
• Maquettes du dashboard (Karim)
`,

  'Verbes au futur / infinitif': `
À faire pour le prochain sprint
- Refonte du header mobile — Thomas — v1
- Intégration du module de paiement — Sofia — v1
- Documentation API — Sofia — v2
`,

  'Indices sur puces (Qui / Quand)': `
Réunion produit du 14 novembre
Actions
1. Refonte du tunnel de paiement
   - Qui : Thomas
   - Quand : vendredi
   - Priorité : haute
2. Migration de la base
   - Responsable : Sofia
   - Version : v2
`,

  'Tableau colle de Word (tabulations)': `Action\tResponsable\tEcheance\tPriorite
Finaliser l'ecran d'inscription\tThomas\tvendredi\thaute
Brancher Stripe\tSofia\t24/11\t
Recette de l'inscription\tLea\tjeudi\t
`,

  'US numerotees': `
US-1 : En tant que visiteur, je veux créer un compte afin de commander.
US-2 : En tant que client, je veux suivre ma commande afin de savoir quand elle arrive.
`,
};

for (const [name, text] of Object.entries(cases)) {
  const c = extractFromText(text, opts);
  console.log(`\n=== ${name} → ${c.length} candidat(s) ===`);
  for (const x of c) {
    console.log(`  ${x.confidence.toFixed(2)} | ${x.title} | ${x.assigneeNames.join(',') || '-'} | ${x.versionName || '-'} | ${x.due || '-'}`);
  }
}

console.log('\n=== Participants ===');
console.log(findParticipants(cases['Prose sans puces'], seed.members));
