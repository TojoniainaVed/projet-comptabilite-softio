# Softio Comptabilité

Module de comptabilité de l'ERP **Softio** : espace comptable (écritures en partie double, plan comptable, factures, paiements, dépenses, rapports) et **espace d'administration** séparé (utilisateurs, rôles et permissions, entreprises, paramètres, journal d'audit, sessions).

| Couche | Technologies |
| --- | --- |
| Frontend | React 19, TypeScript (`strict`), Vite 7, Tailwind CSS 4, React Router 7, TanStack Query 5, React Hook Form + Zod, Lucide React, Vitest + Testing Library |
| Backend | PHP ≥ 8.2, Laravel 12, Laravel Sanctum (jetons Bearer), Eloquent, Form Requests, API Resources, Policies/Gates |
| Base de données | PostgreSQL (SQLite en mémoire pour les tests PHPUnit) |

> ⚠️ **État de vérification — lisez [« Ce qui a été vérifié »](#ce-qui-a-été-vérifié).**
> Le frontend a été compilé et testé. Le backend a été écrit et vérifié syntaxiquement (`php -l`) mais **ses tests PHPUnit, ses migrations et son exécution n'ont pas pu être lancés** dans l'environnement de génération (Composer/Packagist inaccessible). Lancez `composer install` puis `php artisan test` en premier.

## Structure

```
softio-comptabilite/
├── backend/      API Laravel (app/, config/, database/, routes/, tests/)
├── frontend/     Application React (src/, tests/)
├── docs/         ARCHITECTURE.md, API.md, COMPTABILITE.md
├── scripts/      setup.sh, check.sh
└── .vscode/      extensions et réglages recommandés
```

## Prérequis

- PHP ≥ 8.2 avec les extensions `pdo_pgsql`, `mbstring`, `openssl`, `xml`, `ctype`, `json`, `tokenizer` (et `pdo_sqlite` pour les tests)
- [Composer](https://getcomposer.org) 2
- Node.js ≥ 20.19 et npm
- PostgreSQL ≥ 14

## Installation

### 2. Backend

```bash
cd backend
composer install
cp .env.example .env          # Windows : copy .env.example .env
php artisan key:generate
# Éditez .env : DB_PASSWORD, et SEED_ADMIN_PASSWORD (voir ci-dessous)
php artisan migrate
php artisan db:seed
php artisan serve             # http://localhost:8000
```

`db:seed` crée les rôles, les permissions et **un super administrateur** (`SEED_ADMIN_EMAIL`, `admin@softio.test` par défaut).
Si `SEED_ADMIN_PASSWORD` est vide, un mot de passe aléatoire est généré et **affiché une seule fois** dans la console : notez-le. Aucun mot de passe n'est écrit dans le code.

Mot de passe perdu ou connexion impossible : `php artisan softio:reset-password admin@softio.test` (saisie masquée ; réactive aussi le compte).

Ne lancez pas `php artisan config:cache` avant `db:seed` : les seeders lisent `.env` directement.

Données de démonstration (développement uniquement) : `DEMO_DATA=true` dans `.env` avant `php artisan db:seed`. Elles créent une entreprise nommée « Entreprise Démo (données de démonstration) » et un compte par rôle d'entreprise, avec un mot de passe généré affiché une fois.

### 3. Frontend

```bash
cd frontend
npm install                   # un fichier .npmrc active legacy-peer-deps (voir Limitations)
cp .env.example .env          # facultatif : VITE_API_URL=/api/v1 par défaut
npm run dev                   # http://localhost:5173
```

Le serveur Vite redirige `/api` vers `http://localhost:8000` : aucune configuration CORS n'est nécessaire en développement. Pour un autre hébergement, définissez `VITE_API_URL` (par ex. `https://api.exemple.mg/api/v1`) et `FRONTEND_URL` côté backend.

### 4. Inscription des clients et e-mails

Vos clients créent **eux-mêmes** leur entreprise et leur compte administrateur sur `/register` (lien « Créer un compte » sur la page de connexion), puis confirment leur adresse e-mail. Le mot de passe oublié fonctionne aussi par e-mail.

- Après mise à jour, lancez `php artisan migrate` (nouvelle migration `…add_self_service_to_users`).
- Par défaut `MAIL_MAILER=log` : **aucun e-mail n'est réellement envoyé**, ils sont écrits dans `backend/storage/logs/laravel.log` (le lien de confirmation s'y trouve). Pour envoyer de vrais e-mails, configurez un serveur SMTP (`MAIL_MAILER=smtp`, `MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD`, `MAIL_FROM_ADDRESS`).
- `APP_URL` doit être l'adresse publique du backend (le lien de confirmation est une URL signée vers l'API) et `FRONTEND_URL` celle du frontend.
- `REGISTRATION_ENABLED=false` ferme les inscriptions ; `REGISTRATION_REQUIRE_EMAIL_VERIFICATION=false` les dispense de confirmation (déconseillé en production).
- `TERMS_URL` : adresse de vos conditions d'utilisation, affichée sur la page d'inscription. **Rédigez vos conditions et votre politique de confidentialité vous-même** : le projet n'en fournit pas.

### 5. Premiers pas
81y;3nZC3)vr1xxj

1. Connectez-vous avec le super administrateur sur http://localhost:5173/login → espace **Administration**.
2. Créez une **entreprise** (le plan comptable simplifié, 5 journaux et l'exercice de l'année en cours sont créés automatiquement).
3. Créez un utilisateur « Administrateur d'entreprise » rattaché à cette entreprise.
4. Connectez-vous avec ce compte : l'espace comptable s'ouvre.

Le super administrateur n'a volontairement **aucun accès** aux données comptables des entreprises.

## Commandes utiles

| Où | Commande | Rôle |
| --- | --- | --- |
| `backend` | `php artisan test` | Tests PHPUnit (SQLite en mémoire, aucune base à préparer) |
| `backend` | `vendor/bin/pint --test` | Style de code |
| `frontend` | `npm run dev` | Serveur de développement |
| `frontend` | `npm run typecheck` | TypeScript strict |
| `frontend` | `npm run lint` / `npm run format:check` | ESLint / Prettier |
| `frontend` | `npm run test` | Vitest |
| `frontend` | `npm run build` | Typecheck + build de production |
| `frontend` | `npm run check` | typecheck + lint + format + tests |
| racine | `./scripts/setup.sh` | Installe les dépendances des deux projets |
| racine | `./scripts/check.sh` | Lance toutes les vérifications |

## Ce qui a été vérifié

Vérifications **réellement exécutées** lors de la génération :

| Élément | Résultat |
| --- | --- |
| Frontend : `tsc --noEmit` (strict) | ✅ sans erreur |
| Frontend : ESLint | ✅ sans erreur ni avertissement |
| Frontend : Prettier `--check` | ✅ |
| Frontend : Vitest | ✅ **66 tests** (client API, calculs, composants, formulaires, gardes de routes, idempotence des paiements, inscription / mot de passe oublié) |
| Frontend : `vite build` | ✅ |
| Backend : `php -l` sur tous les fichiers PHP | ✅ aucune erreur de syntaxe |
| Backend : 14 tests unitaires purs (`Money`, `EntryBalance`, `InvoiceCalculator`, `PermissionCatalog`) | ✅ exécutés avec un mini-lanceur maison, car PHPUnit n'était pas installable |

**Non exécuté** (à faire chez vous) :

- `composer install`, `php artisan migrate`, `php artisan db:seed`, `php artisan serve` ;
- les tests fonctionnels PHPUnit (`backend/tests/Feature`, dont `SelfRegistrationTest` pour l'inscription) ;
- l'envoi réel d'e-mails (SMTP) : seuls des tests avec un envoi simulé ont été écrits (non exécutés) ;
- toute exécution contre PostgreSQL (contraintes `CHECK` et déclencheur d'immuabilité du journal d'audit, propres à PostgreSQL) ;
- un test de bout en bout navigateur ↔ API réelle (le frontend n'a été testé que contre une API simulée).

Le backend a été écrit sans pouvoir être exécuté : des erreurs d'intégration sont possibles. Lancez `php artisan test` d'abord et corrigez ce qu'il révèle.

## Limitations connues

- **Plan comptable simplifié, non conforme à un référentiel national.** Aucune conformité à un plan comptable officiel (PCG malgache, SYSCOHADA…) n'est revendiquée. Voir [docs/COMPTABILITE.md](docs/COMPTABILITE.md).
- **Pas d'écritures de clôture automatiques** : la clôture d'un exercice bloque seulement de nouvelles validations ; le report à nouveau est à saisir manuellement. Le bilan intègre le résultat non clôturé.
- **Rôles globaux** : les rôles et leurs permissions sont communs à toutes les entreprises ; un administrateur d'entreprise ne peut pas les modifier.
- **Jeton en `sessionStorage`** : choix pragmatique pour une SPA + API séparée ; un cookie `httpOnly` (Sanctum SPA) serait plus robuste face au XSS mais impose un même domaine. Voir docs/ARCHITECTURE.md.
- **`.npmrc` avec `legacy-peer-deps=true`** : nécessaire car npm plantait à la résolution des dépendances pairs dans l'environnement de génération.
- `npm audit` signale 1 vulnérabilité « high » sur `zod` 3.x (consommation mémoire sur des collections démesurées, corrigée en 4.6.7). Elle ne touche ici que la validation des formulaires dans le navigateur de l'utilisateur ; la migration vers Zod 4 n'a pas été faite (changement majeur, non testé).
- Pas de `composer.lock` : il sera créé par votre premier `composer install` (à commiter).
- `DatePicker` repose sur l'`<input type="date">` natif.
- Pas de pièces jointes, de rapprochement bancaire, d'import, de multi-devises par écriture.
- E-mails en texte brut uniquement (pas de gabarit HTML) ; pas de changement d'adresse e-mail avec re-confirmation.
- Interface en français uniquement (le paramètre « langue » est stocké mais non exploité par l'interface).

## Modifier le projet

Les évolutions doivent conserver le code existant. Pour livrer une nouvelle version, regénérez l'archive complète (`./scripts/package.sh`).

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — architecture, sécurité, isolation des entreprises
- [docs/API.md](docs/API.md) — référence de l'API REST `/api/v1`
- [docs/COMPTABILITE.md](docs/COMPTABILITE.md) — règles comptables implémentées
