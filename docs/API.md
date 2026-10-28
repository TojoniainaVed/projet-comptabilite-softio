# Référence de l'API REST — `/api/v1`

Base : `http://localhost:8000/api/v1`. Format : JSON (`Accept: application/json`). Les montants sont des **chaînes décimales** (`"1234.50"`), les dates `AAAA-MM-JJ`, les horodatages ISO 8601.

## Authentification

`POST /auth/login` renvoie un jeton à envoyer ensuite dans `Authorization: Bearer <jeton>`.

```http
POST /api/v1/auth/login
{ "email": "admin@softio.test", "password": "…", "device_name": "web" }

200 { "token": "12|abc…", "user": { "id": 1, "name": "…", "email": "…", "is_active": true,
        "company": null | { "id", "name", "currency", "locale" },
        "role": { "id", "slug", "name", "scope": "platform|company" },
        "permissions": ["users.view", …] } }
```

Identifiants invalides, compte désactivé ou entreprise suspendue → **422** identique (`errors.email = ["Identifiants invalides."]`). Limite : 5 tentatives/minute par e-mail+IP.

| Méthode | Route | Description |
| --- | --- | --- |
| GET | `/platform` | public : nom de la plateforme, couleur, langue |
| POST | `/auth/login` | connexion |
| POST | `/auth/register` | public : inscription libre-service (entreprise + administrateur), 201 |
| GET | `/auth/email/verify/{id}/{hash}` | lien signé reçu par e-mail ; redirige vers `/login?verified=1\|expired\|invalid` |
| POST | `/auth/email/resend` | public : renvoie le lien de confirmation (202, réponse identique si le compte n'existe pas) |
| POST | `/auth/password/forgot` | public : envoie un lien de réinitialisation (202, réponse identique si le compte n'existe pas) |
| POST | `/auth/password/reset` | public : `{ token, email, password, password_confirmation }` |
| GET | `/auth/me` | utilisateur courant + permissions (`{ data }`) |
| POST | `/auth/logout` | révoque le jeton courant (204) |

### Inscription libre-service

```http
POST /api/v1/auth/register
{ "company_name": "Rakoto & Fils", "name": "Jean Rakoto", "email": "jean@rakoto.test",
  "password": "…", "password_confirmation": "…", "accept_terms": true }

201 { "message": "…", "verification_required": true }
```

Crée en une transaction l'**entreprise** (plan comptable simplifié, 5 journaux, exercice de l'année) et son premier **administrateur d'entreprise** (rôle imposé côté serveur : aucun champ `role_id`/`company_id` n'est lu). Aucun jeton n'est renvoyé : si `REGISTRATION_REQUIRE_EMAIL_VERIFICATION=true` (défaut), la connexion répond **422 `code: "email_not_verified"`** (après un mot de passe correct) tant que le lien reçu par e-mail n'a pas été ouvert (valable 48 h). Inscriptions fermées (`REGISTRATION_ENABLED=false`) → **422 `code: "registration_disabled"`**. Limite : 10 inscriptions/heure par IP ; 3 e-mails/minute par adresse+IP pour renvoi et mot de passe oublié.

Réinitialisation : lien valable 60 minutes, à usage unique ; un lien invalide ou expiré → **422 `code: "invalid_reset_token"`**. Une réinitialisation réussie révoque tous les jetons du compte.

`GET /platform` expose aussi `registration_enabled`, `terms_url` et `password_min_length`.

## Conventions

- **Pagination** : `?page=1&per_page=15` (max 100). Réponse `{ "data": [...], "links": {...}, "meta": { "current_page", "last_page", "per_page", "total", … } }`. `?all=1` renvoie jusqu'à 500 éléments sans pagination (listes de choix de formulaires).
- **Recherche / filtres** : `search`, `status`, `from`, `to`… selon la ressource (voir tableaux).
- **Ressource unique** : `{ "data": { … } }`.
- **Codes HTTP** : `200`, `201` (création), `204` (suppression), `401` (non authentifié / jeton expiré), `403` (permission manquante), `404` (introuvable **ou appartenant à une autre entreprise**), `422` (validation ou règle de gestion), `429` (trop de requêtes, 120/min par utilisateur).
- **Erreur de validation** : `{ "message": "…", "errors": { "champ": ["message"] } }`.
- **Règle de gestion refusée** (422) : `{ "message": "…", "code": "entry_unbalanced" }` — liste des codes dans [COMPTABILITE.md](COMPTABILITE.md#codes-derreur-métier-http-422-champ-code).
- Les routes comptables exigent un compte **rattaché à une entreprise** ; un compte de plateforme reçoit 403.

## Espace comptable

Permission requise entre parenthèses. « v » = `*.view`.

### Tableau de bord et rapports

| Méthode | Route | Permission | Notes |
| --- | --- | --- | --- |
| GET | `/dashboard` | `reports.view` | indicateurs, série mensuelle, dernières écritures |
| GET | `/reports/trial-balance` | `reports.view` | `from`, `to` ; `format=csv` ⇒ téléchargement (`reports.export`) |
| GET | `/reports/income-statement` | `reports.view` | `from`, `to` |
| GET | `/reports/balance-sheet` | `reports.view` | `as_of` |
| GET | `/reports/treasury` | `reports.view` | soldes banque/caisse |

### Référentiels

| Ressource | Routes | Permissions | Filtres |
| --- | --- | --- | --- |
| Comptes | `GET/POST /accounts`, `GET/PUT /accounts/{id}` | `accounts.view/create/update` | `search`, `type`, `category`, `is_active` |
| Journaux | `GET/POST /journals`, `PUT /journals/{id}` | `journals.view/create/update` | — |
| Exercices | `GET/POST /fiscal-years`, `PUT /fiscal-years/{id}` | `fiscal_years.view/create/update` | — |
| Clients | `GET/POST /customers`, `GET/PUT /customers/{id}` | `partners.view/create/update` | `search`, `is_active` |
| Fournisseurs | `GET/POST /suppliers`, `GET/PUT /suppliers/{id}` | idem | idem |

Aucune suppression physique : on désactive (`is_active: false`).

Corps type — compte : `{ "code": "512", "name": "Banque", "type": "asset", "category": "bank", "is_active": true }` ; journal : `{ "code", "name", "type": "sales|purchases|bank|cash|general", "is_active" }` ; exercice : `{ "name", "starts_on", "ends_on", "status": "open|closed" }` ; partenaire : `{ "name", "email", "phone", "tax_id", "address", "is_active" }`.

### Écritures

| Méthode | Route | Permission |
| --- | --- | --- |
| GET | `/journal-entries` (`status`, `journal_id`, `from`, `to`, `search`) | `entries.view` |
| POST | `/journal-entries` | `entries.create` |
| GET | `/journal-entries/{id}` | `entries.view` |
| PUT | `/journal-entries/{id}` | `entries.update` (brouillon) |
| DELETE | `/journal-entries/{id}` | `entries.update` (brouillon) |
| POST | `/journal-entries/{id}/post` | `entries.validate` |
| POST | `/journal-entries/{id}/reverse` (`reason`, `entry_date` facultatifs) | `entries.cancel` |
| GET | `/journal-entries/export` (CSV des écritures validées) | `entries.export` |

```json
POST /journal-entries
{ "journal_id": 5, "entry_date": "2026-03-05", "description": "Apport en capital",
  "lines": [ { "account_id": 12, "label": "Apport", "debit": "1000000.00", "credit": null },
             { "account_id": 1,  "label": "Apport", "debit": null, "credit": "1000000.00" } ] }
```

Le brouillon peut être déséquilibré ; la **validation** (`/post`) vérifie l'équilibre, l'exercice ouvert et attribue la référence `OD-000001`.

### Factures

| Méthode | Route | Permission |
| --- | --- | --- |
| GET | `/invoices` (`type=customer|supplier`, `status`, `partner_id`, `overdue=1`, `search`) | `invoices.view` |
| POST | `/invoices` | `invoices.create` |
| GET | `/invoices/{id}` | `invoices.view` |
| PUT / DELETE | `/invoices/{id}` | `invoices.update` (brouillon) |
| POST | `/invoices/{id}/post` | `invoices.validate` |
| POST | `/invoices/{id}/cancel` (`reason`) | `invoices.cancel` |
| POST | `/invoices/{id}/payments` | `payments.create` + en-tête `Idempotency-Key` |

```json
POST /invoices
{ "type": "customer", "partner_id": 3, "invoice_date": "2026-03-01", "due_date": "2026-03-31",
  "notes": null,
  "lines": [ { "account_id": 20, "description": "Prestation", "quantity": "2", "unit_price": "100.00", "tax_rate": "20" } ] }
```

`type` n'est accepté qu'à la création. Les totaux envoyés par le client sont ignorés : le serveur recalcule.

### Paiements

```http
POST /invoices/42/payments
Idempotency-Key: 6f1c2d0e-… (8 à 64 caractères, unique par intention de paiement)
{ "amount": "120.00", "paid_on": "2026-03-10", "method": "bank_transfer|cash|check|card",
  "treasury_account_id": 7, "reference": "VIR-123" }
```

→ **201** à la création ; **200** avec le même paiement si la même clé est rejouée sur la même facture ; **422** `idempotency_conflict` si la clé a servi pour une autre facture ; **422** `payment_exceeds_due` en cas de sur-paiement.

`GET /payments` (`invoice_id`, `from`, `to`) et `GET /payments/{id}` — `payments.view` (lecture seule : on n'édite ni ne supprime un paiement).

### Dépenses

`GET/POST /expenses`, `GET/PUT/DELETE /expenses/{id}`, `POST /expenses/{id}/post` — `expenses.view/create/update/validate`. Corps : `{ "expense_date", "description", "amount", "account_id", "paid_from_account_id", "partner_id": null, "reference": null }`. Filtres : `status`, `from`, `to`, `search`.

## Espace d'administration (`/admin`)

Un **super administrateur** voit toute la plateforme ; un **administrateur d'entreprise** est limité à son entreprise (utilisateurs, audit, sessions) et aux rôles d'entreprise.

| Méthode | Route | Permission | Notes |
| --- | --- | --- | --- |
| GET | `/admin/dashboard` | `users.view` | statistiques réelles, alertes, connexions sur 7 jours |
| GET | `/admin/users` | `users.view` | `search`, `role_id`, `company_id`, `is_active` |
| POST | `/admin/users` | `users.create` | `name, email, password, role_id, company_id` |
| GET/PUT | `/admin/users/{id}` | `users.view` / `users.update` | `password` facultatif à la modification |
| PATCH | `/admin/users/{id}/status` | `users.administer` | `{ "is_active": false }` ferme aussi les sessions ; refuse de désactiver le dernier administrateur |
| GET | `/admin/roles` | `roles.view` | avec permissions et nombre d'utilisateurs |
| GET | `/admin/permissions` | `roles.view` | catalogue groupé par ressource |
| PUT | `/admin/roles/{id}/permissions` | `roles.administer` | `{ "permissions": ["entries.view", …] }` (remplace) |
| GET/POST | `/admin/companies` | `companies.view` / `companies.create` | création ⇒ plan, journaux, exercice |
| GET/PUT | `/admin/companies/{id}` | `companies.view` / `companies.update` | suspension/réactivation (`status`) : `companies.administer`, plateforme seulement |
| GET/PUT | `/admin/settings` | `settings.view` / `settings.update` | `platform_name, brand_color, default_locale, default_currency, password_min_length, features.expenses` |
| GET | `/admin/audit-logs` | `audit.view` | `action` (préfixe), `user_id`, `from`, `to` |
| GET | `/admin/sessions` | `sessions.view` | jetons non expirés |
| DELETE | `/admin/sessions/{id}` | `sessions.administer` | révoque un jeton |

Les mots de passe suivent la politique de la plateforme (`password_min_length`, majuscule, minuscule, chiffre).

## Actions journalisées

`auth.login`, `auth.login_failed`, `auth.logout`, `auth.registered`, `auth.email_verified`, `auth.password_reset_requested`, `auth.password_reset`, `user.created|updated|role_changed|activated|deactivated`, `company.created|updated|active|suspended`, `role.permissions_changed`, `settings.updated`, `session.revoked`, `account.created|updated`, `journal.created|updated`, `fiscal_year.created|updated|closed`, `partner.created|updated`, `journal_entry.created|updated|deleted|posted|reversed|exported`, `invoice.created|updated|deleted|posted|cancelled`, `payment.created`, `expense.created|deleted|posted`, `report.exported`.
