# Architecture

## Vue d'ensemble

```
Navigateur ── React SPA (Vite) ──HTTP/JSON, Bearer──▶ Laravel API (/api/v1) ──▶ PostgreSQL
```

Deux applications indépendantes, communiquant uniquement par l'API REST. Le frontend est servi statiquement (`npm run build` → `dist/`) ; le backend est une API sans état (sessions `array`, authentification par jetons Sanctum).

## Deux espaces séparés

| | Espace comptable | Espace d'administration |
| --- | --- | --- |
| URL frontend | `/dashboard`, `/accounts`, `/journal-entries`, … | `/admin/*` |
| Layout | `AppLayout` (barre latérale claire) | `AdminLayout` (barre latérale sombre) |
| Routes API | `/api/v1/dashboard`, `accounts`, `journal-entries`, … (middleware `company`) | `/api/v1/admin/*` |
| Public | Comptes rattachés à une entreprise | Super administrateur (plateforme) ; administrateur d'entreprise (périmètre de son entreprise) |

Un compte de plateforme (rôle `super-admin`, sans entreprise) est refusé sur toutes les routes comptables par le middleware `EnsureCompanyContext` : il administre la plateforme sans jamais voir de données comptables.

## Backend (`backend/`)

```
app/
├── Exceptions/BusinessRuleException   règle de gestion violée → HTTP 422 {message, code}
├── Http/
│   ├── Controllers/Api/V1/{Admin,Accounting}/   contrôleurs fins
│   ├── Middleware/                              EnsureUserIsActive, EnsureCompanyContext
│   ├── Requests/                                validation (Form Requests)
│   └── Resources/                               formes JSON stables (API Resources)
├── Models/ (+ Concerns/BelongsToCompany, Scopes/CompanyScope)
├── Policies/                                    autorisation par ressource
├── Providers/AppServiceProvider                 une Gate par permission, limiteurs de débit
├── Services/
│   ├── Audit/AuditLogger
│   ├── Admin/{SettingsService, AdminDashboardService, UserAdminGuard}
│   └── Accounting/{JournalEntryService, InvoiceService, PaymentService, ExpenseService,
│                   ReportService, AccountResolver, CompanyAccountingBootstrap, …}
└── Support/{Money, PermissionCatalog}
```

Principes :

- **Contrôleurs fins** : validation (Form Request) → autorisation (`authorize`) → service → Resource.
- **Logique métier dans les services**, exécutée dans des transactions (`DB::transaction`) avec verrous (`lockForUpdate`) là où une course est possible (numérotation, validation, paiement).
- **Classes pures testables sans base** : `Money` (montants en centimes entiers), `EntryBalance`, `InvoiceCalculator`, `PermissionCatalog`.
- **Montants** : colonnes `decimal(15,2)` ; calculs en centimes entiers (`App\Support\Money`) ; JSON en chaînes (`"1234.50"`) pour ne jamais passer par un flottant côté client.

### Authentification

Laravel Sanctum, jetons personnels **Bearer** (pas de cookies, donc pas de CSRF). Durée de vie : `SANCTUM_EXPIRATION` (480 min par défaut). La connexion est limitée (`throttle:login`, 5/min par e-mail+IP, 30/min par IP) et répond identiquement pour compte inconnu, mot de passe erroné, compte désactivé ou entreprise suspendue. Un compte désactivé voit ses jetons supprimés et est rejeté par `EnsureUserIsActive`.

### Inscription libre-service et e-mails

`RegistrationService` crée l'entreprise (`CompanyAccountingBootstrap`) et son administrateur (rôle `company-admin`) dans une transaction. `users.must_verify_email` n'est vrai que pour les comptes inscrits seuls et non confirmés : les comptes existants ne sont jamais bloqués. Le lien de confirmation est une **URL signée temporaire** (48 h) dont le hash lie le lien à l'adresse ; il redirige vers le frontend. La réinitialisation de mot de passe utilise le *broker* Laravel (`password_reset_tokens`, jetons hachés, 60 min). Les envois passent par `AccountMailer` (texte brut), remplaçable dans les tests ; une panne d'envoi est journalisée mais n'annule pas l'inscription (le renvoi reste possible). Renvoi et mot de passe oublié répondent de la même façon que le compte existe ou non ; seul le formulaire d'inscription révèle qu'une adresse est déjà utilisée (compromis d'ergonomie, limité par `throttle:register`). Les adresses sont enregistrées en minuscules.

### Autorisation (RBAC)

- `PermissionCatalog` définit les permissions sous la forme `ressource.action` (`entries.validate`, `users.administer`, …) et les rôles par défaut. `RolesAndPermissionsSeeder` les crée (idempotent ; il ne réécrit pas les permissions d'un rôle existant, pour ne pas écraser les choix d'un administrateur).
- `AppServiceProvider` enregistre **une Gate par permission** ; les **Policies** (`User`, `Company`, `Role`, `JournalEntry`, `Invoice`, `Expense`) ne vérifient que des permissions. Les règles d'état (brouillon, validée…) sont vérifiées dans les services et renvoient un 422 explicite.
- **Chaque contrôleur appelle `authorize`** : le masquage d'un bouton dans l'interface n'est qu'une commodité.
- Garde-fous : impossible de désactiver ou rétrograder le **dernier administrateur** (`UserAdminGuard`) ; un administrateur d'entreprise ne peut créer que des utilisateurs de son entreprise, avec un rôle d'entreprise.

Matrice des rôles par défaut :

| Rôle | Portée | Résumé |
| --- | --- | --- |
| `super-admin` | plateforme | utilisateurs, rôles, entreprises, paramètres, audit, sessions — aucune donnée comptable |
| `company-admin` | entreprise | comptabilité complète + utilisateurs de son entreprise, audit et sessions de son entreprise |
| `finance-manager` | entreprise | comptabilité complète (valider, annuler, exporter) |
| `accountant` | entreprise | saisie et validation ; ni annulation ni export ; consulte les rapports |
| `billing-manager` | entreprise | partenaires, factures (sans annulation ni export), paiements |
| `auditor` | entreprise | consultation + exports + audit |

### Isolation des entreprises

Trois couches se renforcent :

1. **Global scope Eloquent** (`CompanyScope` via le trait `BelongsToCompany`) : toute requête sur un modèle comptable est filtrée sur `company_id` de l'utilisateur connecté ; un utilisateur sans entreprise ne voit **rien**. Un enregistrement d'une autre entreprise répond **404**, jamais 403 (on ne révèle pas son existence).
2. **Règles de validation** : les `exists` sur clés étrangères (`account_id`, `journal_id`, `partner_id`…) sont restreints à l'entreprise.
3. **Requêtes SQL brutes des rapports** (`ReportService`) : filtre `company_id` explicite — les scopes Eloquent ne s'appliquent pas au query builder. Les contraintes uniques sont composées avec `company_id`.

`tests/Feature/CompanyIsolationTest.php` vérifie ces points (tests écrits, **non exécutés** — voir README).

### Intégrité comptable

Détails dans [COMPTABILITE.md](COMPTABILITE.md). En bref : débit = crédit validé côté serveur dans une transaction ; écritures validées **immuables** côté application (garde au niveau des modèles ; contraintes `CHECK` PostgreSQL sur les montants et statuts — pas de déclencheur SQL sur les écritures) ; correction par contrepassation ; paiements protégés par clé d'idempotence.

### Journal d'audit

`AuditLogger` enregistre qui/quoi/quand/où (utilisateur, action, objet, adresse IP, métadonnées). Les clés `password`, `token`, `secret`… sont masquées récursivement. Le modèle `AuditLog` refuse `update`/`delete` et, sous PostgreSQL, un **déclencheur** (migration 5) interdit aussi toute modification ou suppression directe en SQL.

### Base de données

PostgreSQL : clés étrangères, index sur `company_id` et colonnes de filtre, contraintes `CHECK` (montants positifs, débit XOR crédit, statuts valides, `amount_paid ≤ total`) et déclencheur d'immuabilité du journal d'audit — ces dernières sont créées uniquement quand le pilote est `pgsql` (les tests utilisent SQLite en mémoire, qui ne les connaît pas).

## Frontend (`frontend/`)

```
src/
├── app/            routes.tsx (routes lazy), providers.tsx, queryClient.ts, App.tsx
├── components/
│   ├── ui/         Button, Input, Select, Textarea, Checkbox, DatePicker, FormField, Modal,
│   │               ConfirmDialog, DropdownMenu, Badge, StatusBadges, Card/StatCard, DataTable,
│   │               Pagination, SearchInput, Tabs, PageHeader/Breadcrumbs, Spinner/Skeleton
│   └── feedback/   Toast (provider + useToast), States (EmptyState, ErrorState, InlineAlert)
├── features/       un dossier par domaine : auth, dashboard, accounts, entries, partners,
│                   invoices, payments, expenses, reports, settings, administration/
├── hooks/          useListParams
├── layouts/        Shell (commun), AppLayout, AdminLayout, AuthLayout
├── lib/            api-client, auth-storage, resource (hooks TanStack), validation, labels, utils
├── styles/         index.css (tokens Tailwind v4 @theme)
└── types/api.ts    types des réponses de l'API
tests/              Vitest + Testing Library
```

Principes :

- **Données serveur = TanStack Query** (cache, invalidation après mutation) ; aucun état serveur recopié dans un état local. `createResource` fournit `useList/useOne/useOptions/useCreate/useUpdate` par ressource.
- **Formulaires = React Hook Form + Zod** ; les erreurs 422 de l'API sont reportées champ par champ (`applyApiErrors`). Les **montants restent des chaînes** de bout en bout ; les totaux d'aperçu sont calculés en centimes entiers.
- **Design system Tailwind** : jetons sémantiques (`brand`, `success`, `warning`, `danger`, `info`, `canvas`, `surface`, `line`, `ink`, `admin`) définis une fois dans `index.css` ; aucune couleur codée en dur dans les composants.
- **Accessibilité** : lien d'évitement, `Modal` (`role="dialog"`, `aria-modal`, piège à focus, Échap, restitution du focus), champs reliés à leur libellé et à leur erreur (`aria-invalid`, `aria-describedby`, `role="alert"`), tableaux avec `caption` et `scope`, onglets et menus navigables au clavier, graphiques doublés d'un tableau masqué visuellement.
- **Responsive** : barre latérale fixe ≥ `lg`, tiroir en dessous ; tableaux à défilement horizontal ; modales en feuille basse sur mobile.
- **Routes** : chargement différé par page ; gardes `RequireAuth` → `RequireCompany` / `RequireAdminAccess` → `RequirePermission`. La racine `/` redirige vers la première page autorisée du rôle.
- **Session** : le jeton est conservé dans `sessionStorage` (disparaît à la fermeture de l'onglet, non partagé entre onglets). C'est un compromis : il reste lisible par un éventuel script injecté (XSS). L'application n'utilise aucun `dangerouslySetInnerHTML` et React échappe les contenus ; une migration vers des cookies `httpOnly` (Sanctum SPA, même domaine) renforcerait l'ensemble. Un 401 sur une session ouverte vide le cache et ramène à la connexion.
- **Double soumission** : les boutons de soumission sont désactivés pendant l'envoi ; les paiements portent une clé `Idempotency-Key` générée à l'ouverture du formulaire et conservée en cas d'échec réseau.

## Limites et pistes

- Rôles globaux (non personnalisables par entreprise) ; pas de permissions par enregistrement.
- Pas d'écritures de clôture / d'ouverture automatiques, ni de rapprochement bancaire, ni de pièces jointes, ni d'e-mails transactionnels.
- Pas de file d'attente ni de cache applicatif (pilotes `sync` / `file`) : suffisant pour démarrer, à revoir pour de gros volumes (rapports calculés en direct).
