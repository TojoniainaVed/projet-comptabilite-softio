# Règles comptables implémentées

> **Avertissement.** Ce module implémente une comptabilité en partie double générique. Il **ne prétend pas** respecter un référentiel comptable national (PCG, SYSCOHADA, IFRS…) ni les obligations fiscales ou légales d'un pays. Le plan comptable fourni est **simplifié et indicatif**. Faites valider le paramétrage par un professionnel de la comptabilité avant tout usage en production. Les états produits (balance, résultat, bilan) sont des aides de gestion, pas des états financiers certifiés.

## Plan comptable

Chaque compte a un **type** : `asset` (actif), `liability` (passif), `equity` (capitaux propres), `income` (produit), `expense` (charge). Il peut porter un **rôle automatique** (`category`) que les services utilisent pour générer les écritures :

| Rôle | Utilisation |
| --- | --- |
| `receivable` | compte client des factures de vente |
| `payable` | compte fournisseur des factures d'achat |
| `bank`, `cash` | comptes de trésorerie (paiements, dépenses, rapport de trésorerie) |
| `vat_collected` | TVA collectée sur ventes |
| `vat_deductible` | TVA déductible sur achats |

À la création d'une entreprise, `CompanyAccountingBootstrap` provisionne (modifiable ensuite) :

- 16 comptes : 101 Capital, 110 Report à nouveau, 211 Matériel, 401 Fournisseurs, 411 Clients, 4456 TVA déductible, 4457 TVA collectée, 512 Banque, 530 Caisse, 601 Achats, 606 Fournitures, 613 Loyers, 626 Télécommunications, 641 Salaires, 701 Ventes de marchandises, 706 Prestations de services ;
- 5 journaux : `VEN` ventes, `ACH` achats, `BNK` banque, `CSH` caisse, `OD` opérations diverses ;
- l'exercice de l'année en cours (1er janvier – 31 décembre).

Les numéros de compte sont inspirés des usages courants mais n'impliquent aucune conformité.

## Écritures

Cycle de vie : **brouillon → validée → contrepassée**.

| Règle | Application |
| --- | --- |
| Au moins 2 lignes | refus `entry_too_few_lines` |
| Chaque ligne : débit **ou** crédit (jamais les deux), montant ≥ 0, 2 décimales max | validation + contraintes `CHECK` PostgreSQL |
| **Total débit = total crédit, strictement positif** | contrôlé par `EntryBalance` à la validation, dans la transaction, côté serveur uniquement ; refus `entry_unbalanced` |
| Comptes et journal actifs, de l'entreprise | refus `invalid_account`, `invalid_journal` |
| Exercice **ouvert** couvrant la date | refus `no_open_fiscal_year` |
| Numérotation `CODE-000001` par journal | attribuée à la validation, compteur verrouillé (`lockForUpdate`) : pas de doublon sous concurrence ; les brouillons n'ont pas de numéro |
| **Immuabilité** | une écriture validée (et ses lignes) ne peut ni être modifiée ni supprimée via l'application : `LogicException` au niveau des modèles `JournalEntry`, `JournalEntryLine` et `InvoiceLine`. Les contraintes `CHECK` PostgreSQL protègent les montants et les statuts, mais **aucun déclencheur SQL n'interdit une modification directe en base** (seul le journal d'audit en a un) |
| Correction | **contrepassation** : une écriture miroir (débits/crédits inversés) est créée et validée (`reversal_of_id`), l'originale passe à « contrepassée » ; on ne contrepasse pas une contrepassation (`entry_not_reversible`) |
| Écritures issues d'un document | une écriture liée à une facture, un paiement ou une dépense ne peut être annulée qu'en annulant le document |
| Suppression | uniquement des brouillons |

Chaque création, modification, validation, contrepassation et export est tracé dans le journal d'audit.

## Factures

Types : `customer` (vente) et `supplier` (achat). États : `draft` → `posted` → `paid`, ou `cancelled`.

- **Calcul** (`InvoiceCalculator`, jamais fait confiance aux montants du client) : pour chaque ligne, `HT = round(quantité × prix unitaire)` en centimes, `TVA = round(HT × taux / 100)` ; les totaux sont la somme des lignes. Arrondi « demi supérieur » (identique à l'aperçu du frontend).
- **Validation** (transaction + verrou) : génère et valide l'écriture, numérote la facture avec la référence de l'écriture.
  - Vente — débit **Clients** (TTC) ; crédit comptes de produits (HT par ligne) ; crédit **TVA collectée** (si > 0).
  - Achat — débit comptes de charges (HT par ligne) ; débit **TVA déductible** (si > 0) ; crédit **Fournisseurs** (TTC).
  - Journal : `sales` ou `purchases`.
- **Modification / suppression** : brouillons uniquement (`invoice_not_draft`).
- **Annulation** : facture validée **sans aucun paiement** (`invoice_has_payments` sinon) ; contrepasse l'écriture.
- Partenaire : doit être actif et du bon type (`invalid_partner`).

## Paiements

`POST /invoices/{id}/payments` avec l'en-tête obligatoire **`Idempotency-Key`** (8 à 64 caractères).

- La facture est verrouillée (`lockForUpdate`) ; elle doit être validée et non soldée (`invoice_not_payable`) ; le **sur-paiement est refusé** (`payment_exceeds_due`) ; un montant ≤ 0 aussi (`invalid_amount`).
- Compte de trésorerie : catégorie `bank` ou `cash` (`invalid_treasury_account`).
- Écriture générée — encaissement client : débit trésorerie / crédit Clients ; décaissement fournisseur : débit Fournisseurs / crédit trésorerie. Journal `BNK` ou `CSH` selon le compte.
- `amount_paid` est mis à jour ; la facture passe à `paid` quand le reste dû est nul.
- **Idempotence** : contrainte unique `(company_id, idempotency_key)`. Rejouer la même requête sur la même facture renvoie le paiement existant (HTTP **200**, aucun doublon) ; la clé réutilisée sur une autre facture donne `idempotency_conflict` (422). Le premier enregistrement répond **201**.

## Dépenses

Brouillon → validée. À la validation : débit du compte de charge, crédit du compte de règlement (banque, caisse, ou fournisseurs pour une dépense à payer). Journal `BNK`/`CSH` si le compte de règlement est banque/caisse, sinon `OD`. Le compte de charge doit être de type `expense` actif ; les deux comptes doivent différer.

## Exercices

Un exercice a un nom unique par entreprise, une période, et un statut `open`/`closed`. Une écriture ne peut être validée que dans un exercice **ouvert** couvrant sa date. La clôture est une simple fermeture : **aucune écriture de clôture, de solde ou de report à nouveau n'est générée** — à saisir manuellement via le journal OD.

## Rapports

Calculés en direct, uniquement à partir des écritures **validées ou contrepassées** (les brouillons sont exclus), avec filtre `company_id` explicite.

- **Balance générale** : débit, crédit et soldes par compte ; indicateur d'équilibre ; export CSV (UTF-8 avec BOM, séparateur `;`).
- **Compte de résultat** : produits (crédit − débit), charges (débit − crédit), résultat net.
- **Bilan simplifié** : actif, passif, capitaux propres à une date ; le **résultat non clôturé** est ajouté aux capitaux propres ; indicateur d'équilibre.
- **Trésorerie** : soldes des comptes `bank` et `cash`.
- **Tableau de bord** : trésorerie, créances et dettes ouvertes, produits/charges du mois, factures clients en retard, brouillons, série sur 6 mois.

## Codes d'erreur métier (HTTP 422, champ `code`)

`entry_not_draft`, `entry_too_few_lines`, `entry_unbalanced`, `entry_not_reversible`, `invalid_journal`, `invalid_account`, `no_open_fiscal_year`, `invoice_not_draft`, `invoice_empty`, `invoice_not_cancellable`, `invoice_has_payments`, `invoice_not_payable`, `invalid_partner`, `invalid_amount`, `payment_exceeds_due`, `invalid_treasury_account`, `idempotency_conflict`, `expense_not_draft`, `invalid_expense_account`, `invalid_paid_from_account`.

## Hors périmètre

TVA multi-taux déclarative, amortissements, stocks, paie, rapprochement bancaire, multi-devises par transaction, lettrage, états légaux, import/export normalisés (FEC, etc.).
