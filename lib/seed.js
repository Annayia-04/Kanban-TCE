export const MEMBER_COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#ef4444', '#14b8a6'];

const now = Date.now();

const SAMPLE_REPORT = `CR - Reunion produit du 12 novembre
Participants : Marie, Thomas, Sofia, Karim

Ordre du jour
- Revue du backlog v1
- Preparation de la demo client
- Points bloquants

Decisions
- On garde le perimetre v1 centre sur l'inscription et le paiement.
- La demo client est reportee au 26 novembre.

Actions
- Thomas doit finaliser l'ecran d'inscription avant vendredi.
- Sofia va brancher l'API de paiement Stripe en v1, il faut prevoir la gestion des erreurs.
- Karim : creer les maquettes du parcours de paiement pour la v1.
- Il faut ajouter un mail de confirmation apres l'inscription (v1).
- Lea doit rediger le plan de recette de l'inscription.
- Marie s'occupe de contacter le client pour valider les tarifs.
- Prevoir un tableau de bord admin en v2.
- Corriger le bug d'affichage du header sur mobile, c'est urgent.
- Ajouter l'export CSV des commandes en v2, nice to have.
- Il faut mettre en place le suivi analytics des inscriptions pour la v1.

Prochaines etapes
- Point d'avancement jeudi prochain.
`;

/**
 * État de départ « production » : aucune donnée de démonstration.
 * Le projet est vide, l'équipe crée ses membres, versions et US depuis l'interface.
 */
export function makeEmptySeed() {
  return {
    project: {
      name: 'Mon équipe',
      description: '',
      sprint: '',
      nextKey: 1,
    },
    members: [],
    versions: [],
    stories: [],
    ideas: [],
    reports: [],
  };
}

export function makeSeed() {
  const members = [
    { id: 'mem_marie', name: 'Marie Lefèvre', email: 'marie@studio.fr', role: 'Product Owner', color: '#f59e0b', aliases: 'Marie' },
    { id: 'mem_thomas', name: 'Thomas Bernard', email: 'thomas@studio.fr', role: 'Développeur front', color: '#6366f1', aliases: 'Thomas' },
    { id: 'mem_sofia', name: 'Sofia Rossi', email: 'sofia@studio.fr', role: 'Développeuse back', color: '#8b5cf6', aliases: 'Sofia' },
    { id: 'mem_karim', name: 'Karim Haddad', email: 'karim@studio.fr', role: 'Designer UI/UX', color: '#10b981', aliases: 'Karim' },
    { id: 'mem_lea', name: 'Léa Moreau', email: 'lea@studio.fr', role: 'QA', color: '#ec4899', aliases: 'Léa' },
  ];

  const versions = [
    { id: 'ver_v1', name: 'v1', color: '#6366f1', description: 'Lancement public : inscription + paiement' },
    { id: 'ver_v11', name: 'v1.1', color: '#0ea5e9', description: 'Stabilisation et quick wins' },
    { id: 'ver_v2', name: 'v2', color: '#8b5cf6', description: 'Back-office et fonctionnalités avancées' },
  ];

  const S = (key, title, extra = {}) => ({
    id: `us_${key}`,
    key: `US-${key}`,
    title,
    asA: 'un utilisateur',
    iWant: '',
    soThat: '',
    description: '',
    status: 'todo',
    assigneeIds: [],
    versionId: 'ver_v1',
    priority: 'medium',
    points: null,
    due: '',
    tags: [],
    order: 0,
    createdAt: now,
    updatedAt: now,
    reportId: null,
    source: null,
    ...extra,
  });

  const stories = [
    S(1, "S'inscrire avec une adresse email", {
      asA: 'un nouveau visiteur',
      iWant: "créer un compte avec mon adresse email",
      soThat: 'accéder à mon espace personnel',
      status: 'done',
      assigneeIds: ['mem_thomas'],
      priority: 'high',
      points: 5,
      order: 0,
      tags: ['inscription'],
    }),
    S(2, 'Se connecter avec Google', {
      asA: 'un utilisateur',
      iWant: 'me connecter en un clic avec mon compte Google',
      soThat: 'gagner du temps à chaque connexion',
      status: 'done',
      assigneeIds: ['mem_sofia'],
      points: 3,
      order: 1,
      tags: ['auth'],
    }),
    S(3, "Parcours d'onboarding en 3 étapes", {
      asA: 'un nouvel utilisateur',
      iWant: 'être guidé en 3 étapes à la première ouverture',
      soThat: 'comprendre immédiatement la valeur du produit',
      status: 'review',
      assigneeIds: ['mem_karim'],
      priority: 'high',
      points: 5,
      order: 0,
      tags: ['ux', 'onboarding'],
    }),
    S(4, 'Paiement par carte via Stripe', {
      asA: 'un client',
      iWant: 'payer mon abonnement par carte bancaire',
      soThat: 'activer mon compte immédiatement',
      status: 'in_progress',
      assigneeIds: ['mem_sofia'],
      priority: 'high',
      points: 8,
      due: 'vendredi',
      order: 0,
      tags: ['paiement'],
    }),
    S(5, 'Gérer les erreurs de paiement', {
      asA: 'un client',
      iWant: "voir un message clair quand mon paiement échoue",
      soThat: 'pouvoir réessayer sans contacter le support',
      status: 'in_progress',
      assigneeIds: ['mem_sofia'],
      priority: 'high',
      points: 3,
      order: 1,
      tags: ['paiement', 'erreurs'],
    }),
    S(6, "Envoyer un mail de confirmation d'inscription", {
      asA: 'un nouvel inscrit',
      iWant: 'recevoir un mail de confirmation',
      soThat: 'être rassuré sur la création de mon compte',
      status: 'todo',
      assigneeIds: ['mem_thomas'],
      points: 2,
      order: 0,
      tags: ['email'],
    }),
    S(7, 'Maquettes du parcours de paiement', {
      asA: 'l’équipe produit',
      iWant: 'disposer des maquettes desktop et mobile du tunnel de paiement',
      soThat: 'développer sans ambiguïté',
      status: 'done',
      assigneeIds: ['mem_karim'],
      priority: 'high',
      points: 3,
      order: 2,
      tags: ['design'],
    }),
    S(8, "Rédiger le plan de recette de l'inscription", {
      asA: 'l’équipe QA',
      iWant: 'un plan de recette couvrant les cas nominaux et les erreurs',
      soThat: 'livrer la v1 sans régression',
      status: 'todo',
      assigneeIds: ['mem_lea'],
      priority: 'high',
      points: 3,
      due: 'jeudi',
      order: 1,
      tags: ['qa'],
    }),
    S(9, 'Corriger le header sur mobile', {
      title: 'Corriger le header sur mobile',
      asA: 'un utilisateur mobile',
      iWant: 'voir un header qui ne se superpose pas au contenu',
      soThat: 'naviguer confortablement',
      status: 'in_progress',
      assigneeIds: ['mem_thomas'],
      priority: 'high',
      points: 1,
      order: 2,
      tags: ['bug'],
      description: "Le header passe au-dessus du titre sur Safari iOS. Bug signalé en démo.",
    }),
    S(10, 'Tableau de bord administrateur', {
      asA: 'un administrateur',
      iWant: 'suivre les inscriptions et les paiements dans un tableau de bord',
      soThat: 'piloter l’activité sans passer par la base',
      status: 'todo',
      versionId: 'ver_v2',
      priority: 'low',
      points: 8,
      order: 2,
      tags: ['admin'],
    }),
    S(11, 'Exporter les commandes en CSV', {
      asA: 'un administrateur',
      iWant: 'exporter la liste des commandes en CSV',
      soThat: 'les partager avec la comptabilité',
      status: 'todo',
      assigneeIds: ['mem_sofia'],
      versionId: 'ver_v2',
      priority: 'low',
      points: 2,
      order: 3,
      tags: ['export'],
    }),
    S(12, 'Notifications push de suivi de commande', {
      asA: 'un client',
      iWant: 'recevoir une notification quand ma commande change de statut',
      soThat: 'ne pas avoir à revenir vérifier',
      status: 'todo',
      assigneeIds: ['mem_marie'],
      versionId: 'ver_v2',
      points: 5,
      order: 4,
      tags: ['notifications'],
    }),
    S(13, 'Valider les tarifs avec le client', {
      asA: 'l’équipe commerciale',
      iWant: 'faire valider la grille tarifaire',
      soThat: 'afficher les bons prix au lancement',
      status: 'todo',
      assigneeIds: ['mem_marie'],
      priority: 'high',
      points: 1,
      due: '26/11',
      order: 5,
      tags: ['client'],
    }),
    S(14, 'Suivi analytics des inscriptions', {
      asA: 'l’équipe produit',
      iWant: 'mesurer le taux de conversion de l’inscription',
      soThat: 'identifier les points de friction',
      status: 'todo',
      priority: 'medium',
      points: 3,
      order: 6,
      tags: ['analytics'],
      createdBy: 'marie@studio.fr',
      source: { line: 0, section: 'Boîte à idées', excerpt: 'Idée promue depuis la boîte à idées.' },
    }),
    // Pool de qualification : US sans version, soumises au vote de l'équipe.
    S(15, 'Mode hors ligne sur mobile', {
      asA: 'un utilisateur en déplacement',
      iWant: 'consulter mes commandes sans connexion',
      soThat: 'rester informé même dans le métro',
      status: 'todo',
      versionId: null,
      priority: 'medium',
      points: 8,
      order: 0,
      tags: ['mobile', 'hors-ligne'],
      votes: { up: 4, down: 1 },
      createdBy: 'thomas@studio.fr',
      suggestions: [
        {
          id: 'sug_demo1',
          author: 'sofia@studio.fr',
          text: 'Limiter le cache aux 20 dernières commandes pour maîtriser le stockage local.',
          createdAt: now - 5400000,
        },
        {
          id: 'sug_demo2',
          author: 'lea@studio.fr',
          text: 'Prévoir un état vide explicite quand aucune donnée n’est disponible hors connexion.',
          createdAt: now - 3600000,
        },
      ],
    }),
    S(16, 'Personnalisation du thème', {
      asA: 'un utilisateur',
      iWant: 'choisir un thème clair ou sombre',
      soThat: 'adapter l’application à mes préférences',
      status: 'todo',
      versionId: null,
      priority: 'low',
      points: 2,
      order: 1,
      tags: ['ux'],
      votes: { up: 2, down: 2 },
      createdBy: 'karim@studio.fr',
    }),
    S(17, 'Export PDF des factures', {
      asA: 'un client professionnel',
      iWant: 'télécharger mes factures en PDF',
      soThat: 'les transmettre à ma comptabilité',
      status: 'todo',
      versionId: null,
      priority: 'high',
      points: 5,
      order: 2,
      tags: ['facturation'],
      votes: { up: 5, down: 0 },
      createdBy: 'marie@studio.fr',
      suggestions: [
        {
          id: 'sug_demo3',
          author: 'thomas@studio.fr',
          text: 'Réutiliser le gabarit PDF déjà utilisé pour les reçus Stripe.',
          createdAt: now - 7200000,
        },
      ],
    }),
    S(18, 'Support multilingue', {
      asA: 'un utilisateur non francophone',
      iWant: 'utiliser l’application dans ma langue',
      soThat: 'comprendre chaque écran',
      status: 'todo',
      versionId: null,
      priority: 'low',
      points: 13,
      order: 3,
      tags: ['i18n'],
      votes: { up: 1, down: 3 },
    }),
  ];

  const ideas = [
    {
      id: 'idea_demo1',
      title: 'Notifications de paiement échoué',
      text: 'Prévenir le client par email et dans l’app quand un paiement est refusé, avec un lien pour réessayer.',
      author: 'marie@studio.fr',
      votes: { up: 3, down: 0 },
      createdAt: now - 7200000,
      promotedStoryId: null,
      promotedAt: null,
    },
    {
      id: 'idea_demo2',
      title: 'Travail à plusieurs sur une carte',
      text: 'Voir en temps réel qui consulte ou édite une user story, comme dans Notion.',
      author: 'karim@studio.fr',
      votes: { up: 2, down: 1 },
      createdAt: now - 10800000,
      promotedStoryId: null,
      promotedAt: null,
    },
    {
      id: 'idea_demo3',
      title: 'Suivi analytics des inscriptions',
      text: 'Mesurer le taux de conversion de l’inscription pour identifier les points de friction.',
      author: 'marie@studio.fr',
      votes: { up: 4, down: 0 },
      createdAt: now - 172800000,
      promotedStoryId: 'us_14',
      promotedAt: now - 86400000,
    },
  ];

  const reports = [
    {
      id: 'rep_demo',
      name: 'CR-reunion-produit-12-novembre.txt',
      createdAt: now - 86400000,
      participants: ['mem_marie', 'mem_thomas', 'mem_sofia', 'mem_karim'],
      storyIds: ['us_4', 'us_5', 'us_6', 'us_8', 'us_9', 'us_13'],
      engine: 'heuristique',
      text: SAMPLE_REPORT,
    },
  ];

  return {
    project: {
      name: 'Nova — App mobile',
      description: 'Kanban de l’équipe produit. Importez un compte rendu, l’outil en sort les user stories.',
      sprint: 'Sprint 12',
      nextKey: 19,
    },
    members,
    versions,
    stories,
    ideas,
    reports,
  };
}
