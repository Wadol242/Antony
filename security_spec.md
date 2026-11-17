# Spécification de Sécurité Firestore — Salonéo

## 1. Invariants de Données (Master Source of Truth)
1. **Un compte = Un seul salon** : Le document `/salons/{salonId}` doit impérativement avoir `salonId == request.auth.uid` et `ownerId == request.auth.uid`.
2. **Isolement strict (PII & données métier)** : Aucun utilisateur authentifié ne peut lire, lister, créer, modifier ou supprimer le salon, les prestations, les clients ou les rendez-vous d'un autre `uid`.
3. **Intégrité référentielle des sous-collections** : Aucune prestation, aucun client ni aucun rendez-vous ne peut exister sans l'existence préalable du document parent `/salons/{salonId}`. Un rendez-vous doit référencer un `clientId` et un `serviceId` existants dans le même salon lors de sa création.
4. **Immuabilité et horodatage serveur** : `ownerId` et `createdAt` sont immuables après création. `createdAt` (création) et `updatedAt` (création et mise à jour) doivent être strictement égaux à `request.time`.
5. **Verrouillage d'état terminal** : Un rendez-vous passé au statut `termine` ou `annule` ne peut plus être modifié via `update` (seule la suppression reste possible pour le propriétaire).
6. **Bornes volumétriques et champs stricts** : Chaque chaîne a une longueur bornée, chaque document refuse tout champ inconnu (`keys().hasOnly(...)` à la création et `affectedKeys().hasOnly(...)` à la mise à jour).

## 2. Les 12 Charges Malveillantes ("Dirty Dozen")
1. **Création d'un salon sous l'UID d'autrui** (`salonId != auth.uid`) -> `PERMISSION_DENIED`
2. **Usurpation d'identité dans `ownerId`** (`salonId == auth.uid` mais `ownerId: "autre_uid"`) -> `PERMISSION_DENIED`
3. **Champ fantôme ("Shadow Field") à la création** (`isAdmin: true` ou `verified: true`) -> `PERMISSION_DENIED`
4. **Lecture du salon ou des clients d'un autre compte** (`get` / `list` sur `/salons/autre_uid/clients`) -> `PERMISSION_DENIED`
5. **Requête `list` sans filtre ou sur une sous-collection étrangère** -> `PERMISSION_DENIED`
6. **Injection d'un ID malformé (Path Variable Poisoning)** (`serviceId: "abc/../../etc"` ou >128 caractères) -> `PERMISSION_DENIED`
7. **Falsification d'horodatage client** (`createdAt` différent de `request.time`) -> `PERMISSION_DENIED`
8. **Mutation de champ immuable** (`update` tentant de changer `ownerId` ou `createdAt`) -> `PERMISSION_DENIED`
9. **Rendez-vous orphelin** (création d'un rendez-vous avec `clientId` ou `serviceId` inexistant) -> `PERMISSION_DENIED`
10. **Dépassement de taille ("Denial of Wallet")** (`notes` > 500 caractères ou `name` > 100 caractères) -> `PERMISSION_DENIED`
11. **Contournement d'état terminal** (tentative de repasser un rendez-vous `termine` vers `planifie`) -> `PERMISSION_DENIED`
12. **Émulation de type invalide** (`priceFcfa: "15000"` string au lieu de `int`, ou `priceFcfa: -500`) -> `PERMISSION_DENIED`
